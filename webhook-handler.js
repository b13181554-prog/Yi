/**
 * Webhook Handler
 * معالج موحد لـ Telegram Webhook في جميع البيئات
 */

const crypto = require('crypto');
const pino = require('pino');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname'
    }
  }
});

class WebhookHandler {
  constructor() {
    this.webhookSecret = process.env.WEBHOOK_SECRET || crypto.randomBytes(32).toString('hex');
    this.processUpdate = null;
    this.trackBotUpdate = null;
  }

  setProcessUpdateFunction(fn) {
    this.processUpdate = fn;
  }

  setTrackBotUpdateFunction(fn) {
    this.trackBotUpdate = fn;
  }

  getWebhookSecret() {
    return this.webhookSecret;
  }

  async handleWebhookRequest(req, res) {
    try {
      const secretToken = req.headers['x-telegram-bot-api-secret-token'];
      
      if (process.env.WEBHOOK_SECRET && secretToken !== this.webhookSecret) {
        logger.warn('⚠️ Unauthorized webhook request - invalid secret token');
        return res.status(403).json({ error: 'Forbidden' });
      }
      
      const update = req.body;
      
      if (!update || !update.update_id) {
        return res.status(400).json({ error: 'Invalid update' });
      }
      
      res.status(200).json({ ok: true });
      
      setImmediate(async () => {
        const start = Date.now();
        try {
          if (this.processUpdate) {
            await this.processUpdate(update);
          }
          
          if (this.trackBotUpdate) {
            const duration = (Date.now() - start) / 1000;
            const updateType = update.message ? 'message' : 
                             update.callback_query ? 'callback_query' : 'other';
            this.trackBotUpdate(updateType, duration);
          }
        } catch (error) {
          logger.error(`Error processing update ${update.update_id}:`, error);
          if (this.trackBotUpdate) {
            this.trackBotUpdate('error', null);
          }
        }
      });
      
    } catch (error) {
      logger.error('Webhook error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  getExpressMiddleware() {
    return this.handleWebhookRequest.bind(this);
  }

  logWebhookInfo(environment, port, webhookUrl) {
    logger.info(`📡 Webhook configured for ${environment} environment`);
    logger.info(`🔢 Port: ${port}`);
    logger.info(`🌐 Webhook URL: ${webhookUrl}`);
    logger.info(`🔒 Secret: ${this.webhookSecret ? 'ENABLED' : 'DISABLED'}`);
  }
}

const webhookHandler = new WebhookHandler();

module.exports = {
  WebhookHandler,
  webhookHandler
};
