const CryptAPI = require('@cryptapi/api');
const config = require('./config');
const axios = require('axios');
const crypto = require('crypto');
const pino = require('pino');

const logger = pino({
  level: 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname'
    }
  }
});

class CryptAPIService {
  constructor() {
    this.coin = 'trc20_usdt';
    this.walletAddress = config.BOT_WALLET_ADDRESS;
    this.baseUrl = 'https://api.cryptapi.io';
    this.publicKey = null;
    this.publicKeyExpiry = null;
  }

  async getPublicKey() {
    if (this.publicKey && this.publicKeyExpiry && Date.now() < this.publicKeyExpiry) {
      return this.publicKey;
    }

    try {
      const response = await axios.get(`${this.baseUrl}/public_key/`, {
        timeout: 10000
      });
      
      this.publicKey = response.data;
      this.publicKeyExpiry = Date.now() + (24 * 60 * 60 * 1000);
      
      logger.info('✅ CryptAPI public key fetched and cached');
      return this.publicKey;
    } catch (error) {
      logger.error(`❌ Failed to fetch CryptAPI public key: ${error.message}`);
      throw new Error('Failed to fetch CryptAPI public key');
    }
  }

  async verifySignature(rawBody, signature) {
    try {
      const publicKey = await this.getPublicKey();
      
      const signatureBuffer = Buffer.from(signature, 'base64');
      
      const verify = crypto.createVerify('RSA-SHA256');
      verify.update(rawBody);
      verify.end();
      
      const isValid = verify.verify(publicKey, signatureBuffer);
      
      if (isValid) {
        logger.info('✅ CryptAPI signature verified successfully');
      } else {
        logger.error('❌ Invalid CryptAPI signature');
      }
      
      return isValid;
    } catch (error) {
      logger.error(`❌ Signature verification error: ${error.message}`);
      return false;
    }
  }

  getCallbackUrl() {
    if (config.CRYPTAPI_CALLBACK_URL) {
      return config.CRYPTAPI_CALLBACK_URL;
    }
    
    if (process.env.REPLIT_DOMAINS) {
      return `https://${process.env.REPLIT_DOMAINS}/api/cryptapi/callback`;
    }
    
    return `${config.WEBAPP_URL}/api/cryptapi/callback`;
  }

  async createPaymentAddress(userId, amount) {
    try {
      const callbackUrl = this.getCallbackUrl();
      
      logger.info(`🔗 Creating CryptAPI payment address for user ${userId}, amount: ${amount} USDT`);
      logger.info(`📞 Callback URL: ${callbackUrl}`);

      const cryptapi = new CryptAPI(
        this.coin,
        this.walletAddress,
        callbackUrl,
        {
          user_id: userId,
          amount: amount
        },
        {
          post: 1,
          confirmations: 1
        }
      );

      const paymentAddress = await cryptapi.getAddress();
      
      logger.info(`📦 CryptAPI Response: ${paymentAddress}`);
      
      if (!paymentAddress || typeof paymentAddress !== 'string') {
        throw new Error(`فشل إنشاء عنوان الدفع من CryptAPI: ${paymentAddress}`);
      }

      logger.info(`✅ Payment address created: ${paymentAddress}`);

      return {
        success: true,
        data: {
          payment_address: paymentAddress,
          callback_url: callbackUrl,
          wallet_address: this.walletAddress,
          qr_code_url: `${this.baseUrl}/${this.coin}/qrcode/?address=${paymentAddress}&value=${amount}&size=512`,
          amount: amount,
          coin: this.coin
        }
      };
    } catch (error) {
      logger.error(`❌ CryptAPI Error: ${error.message}`);
      return {
        success: false,
        error: error.message || 'حدث خطأ في إنشاء عنوان الدفع'
      };
    }
  }

  async convertToUSDT(amountUSD) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/${this.coin}/convert/?value=${amountUSD}&from=usd`
      );

      if (response.data && response.data.value_coin) {
        return {
          success: true,
          amount_usdt: parseFloat(response.data.value_coin),
          exchange_rate: parseFloat(response.data.exchange_rate || 1)
        };
      }

      return { success: false, error: 'فشل تحويل السعر' };
    } catch (error) {
      logger.error(`❌ Conversion Error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async getPaymentLogs(callbackUrl) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/${this.coin}/logs/?callback=${encodeURIComponent(callbackUrl)}`
      );

      if (response.data && response.data.status === 'success') {
        return {
          success: true,
          logs: response.data.callbacks || []
        };
      }

      return { success: false, error: 'فشل جلب سجلات الدفع' };
    } catch (error) {
      logger.error(`❌ Logs Error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async estimateFees() {
    try {
      const response = await axios.get(
        `${this.baseUrl}/${this.coin}/estimate/?addresses=1&priority=default`
      );

      if (response.data && response.data.estimated_cost) {
        return {
          success: true,
          fee_crypto: response.data.estimated_cost,
          fee_usd: response.data.estimated_cost_usd || 'N/A'
        };
      }

      return { success: false, error: 'فشل تقدير الرسوم' };
    } catch (error) {
      logger.error(`❌ Fee Estimation Error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async getSupportedCoins() {
    try {
      const response = await axios.get(`${this.baseUrl}/info/`);
      return {
        success: true,
        coins: response.data || []
      };
    } catch (error) {
      logger.error(`❌ Supported Coins Error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  validateCallback(callbackData) {
    const required = ['address_in', 'address_out', 'txid_in', 'confirmations', 'value', 'value_coin'];
    
    for (const field of required) {
      if (!callbackData[field]) {
        return { valid: false, error: `Missing required field: ${field}` };
      }
    }

    if (callbackData.address_out !== this.walletAddress) {
      return { valid: false, error: 'Invalid destination wallet' };
    }

    return { valid: true };
  }

  isPaymentConfirmed(callbackData) {
    return callbackData.pending === '0' && parseInt(callbackData.confirmations) >= 1;
  }
}

module.exports = new CryptAPIService();
