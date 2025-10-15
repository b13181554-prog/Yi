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

async function safeSendMessage(bot, chatId, text, options = {}) {
  try {
    return await bot.sendMessage(chatId, text, options);
  } catch (error) {
    if (error.response && error.response.body) {
      const errorBody = error.response.body;
      
      if (errorBody.error_code === 403 && errorBody.description && errorBody.description.includes('bot was blocked by the user')) {
        logger.warn(`⚠️ User ${chatId} has blocked the bot. Skipping message.`);
        return null;
      }
      
      if (errorBody.error_code === 403 && errorBody.description && errorBody.description.includes('user is deactivated')) {
        logger.warn(`⚠️ User ${chatId} account is deactivated. Skipping message.`);
        return null;
      }
      
      if (errorBody.error_code === 400 && errorBody.description && errorBody.description.includes('chat not found')) {
        logger.warn(`⚠️ Chat ${chatId} not found. Skipping message.`);
        return null;
      }
    }
    
    logger.error(`❌ Error sending message to ${chatId}: ${error.message}`);
    throw error;
  }
}

async function safeSendPhoto(bot, chatId, photo, options = {}) {
  try {
    return await bot.sendPhoto(chatId, photo, options);
  } catch (error) {
    if (error.response && error.response.body) {
      const errorBody = error.response.body;
      
      if (errorBody.error_code === 403 && errorBody.description && errorBody.description.includes('bot was blocked by the user')) {
        logger.warn(`⚠️ User ${chatId} has blocked the bot. Skipping photo.`);
        return null;
      }
      
      if (errorBody.error_code === 403 && errorBody.description && errorBody.description.includes('user is deactivated')) {
        logger.warn(`⚠️ User ${chatId} account is deactivated. Skipping photo.`);
        return null;
      }
      
      if (errorBody.error_code === 400 && errorBody.description && errorBody.description.includes('chat not found')) {
        logger.warn(`⚠️ Chat ${chatId} not found. Skipping photo.`);
        return null;
      }
    }
    
    logger.error(`❌ Error sending photo to ${chatId}: ${error.message}`);
    throw error;
  }
}

async function safeEditMessageText(bot, text, options = {}) {
  try {
    return await bot.editMessageText(text, options);
  } catch (error) {
    if (error.response && error.response.body) {
      const errorBody = error.response.body;
      
      if (errorBody.error_code === 403 && errorBody.description && errorBody.description.includes('bot was blocked by the user')) {
        logger.warn(`⚠️ User has blocked the bot. Skipping message edit.`);
        return null;
      }
      
      if (errorBody.error_code === 400 && errorBody.description && errorBody.description.includes('message is not modified')) {
        logger.debug(`Message not modified, skipping edit.`);
        return null;
      }
    }
    
    logger.error(`❌ Error editing message: ${error.message}`);
    throw error;
  }
}

async function safeAnswerCallbackQuery(bot, callbackQueryId, options = {}) {
  try {
    return await bot.answerCallbackQuery(callbackQueryId, options);
  } catch (error) {
    logger.warn(`⚠️ Error answering callback query: ${error.message}`);
    return null;
  }
}

module.exports = {
  safeSendMessage,
  safeSendPhoto,
  safeEditMessageText,
  safeAnswerCallbackQuery
};
