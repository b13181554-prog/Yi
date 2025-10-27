
const db = require('./database');
const config = require('./config');
const { safeSendMessage } = require('./safe-message');
const { t } = require('./languages');

class AnalystSignalsManager {
  // إنشاء إشارة جديدة
  async createSignal(analystId, signalData) {
    const signal = {
      analyst_id: analystId,
      symbol: signalData.symbol,
      type: signalData.type, // buy or sell
      entry_price: signalData.entry_price,
      target_price: signalData.target_price,
      stop_loss: signalData.stop_loss,
      timeframe: signalData.timeframe,
      market_type: signalData.market_type,
      analysis: signalData.analysis,
      status: 'active', // active, success, failed
      created_at: new Date()
    };
    
    const result = await db.createAnalystSignal(signal);
    
    // تحديث تاريخ آخر نشر للمحلل
    try {
      await db.updateAnalystLastPost(analystId);
    } catch (error) {
      console.error('خطأ في تحديث تاريخ آخر نشر للمحلل:', error);
    }
    
    return result;
  }
  
  // تحديث حالة الإشارة
  async updateSignalStatus(signalId, status, actualPrice) {
    return await db.updateAnalystSignal(signalId, {
      status: status,
      closed_at: new Date(),
      closed_price: actualPrice
    });
  }
  
  // حساب نسبة نجاح المحلل
  async calculateAnalystSuccessRate(analystId) {
    const signals = await db.getAnalystSignals(analystId);
    
    const closedSignals = signals.filter(s => s.status !== 'active');
    const successfulSignals = signals.filter(s => s.status === 'success');
    
    if (closedSignals.length === 0) return 0;
    
    const successRate = (successfulSignals.length / closedSignals.length) * 100;
    
    // تحديث نسبة النجاح في قاعدة البيانات
    await db.updateAnalystStats(analystId, {
      success_rate: successRate.toFixed(2),
      total_signals: signals.length,
      successful_signals: successfulSignals.length
    });
    
    return successRate;
  }
  
  // إرسال إشعار للمشتركين
  async notifySubscribers(analystId, signal) {
    const subscribers = await db.getAnalystSubscribers(analystId);
    const bot = require('./bot');
    
    for (const subscriber of subscribers) {
      const user = await db.getUser(subscriber.user_id);
      const lang = user ? user.language : 'ar';
      const message = this.formatSignalMessage(signal, lang);
      try {
        await safeSendMessage(bot, subscriber.user_id, message, { parse_mode: 'HTML' });
      } catch (error) {
        console.error(`Failed to notify subscriber ${subscriber.user_id}:`, error.message);
      }
    }
  }
  
  formatSignalMessage(signal, lang = 'ar') {
    const typeEmoji = signal.type === 'buy' ? '🟢' : '🔴';
    const typeText = signal.type === 'buy' ? t(lang, 'analyst_signal_buy') : t(lang, 'analyst_signal_sell');
    const marketText = signal.market_type === 'crypto' ? t(lang, 'analyst_market_crypto') : t(lang, 'analyst_market_forex');
    
    return `
${typeEmoji} <b>${t(lang, 'analyst_new_signal')}: ${typeText}</b>

📊 <b>${t(lang, 'analyst_currency')}:</b> ${signal.symbol}
💰 <b>${t(lang, 'analyst_market')}:</b> ${marketText}
⏰ <b>${t(lang, 'analyst_timeframe')}:</b> ${signal.timeframe}

<b>━━━━━━━━━━━━━━━━━━</b>

💵 <b>${t(lang, 'analyst_entry_price')}:</b> ${signal.entry_price}
🎯 <b>${t(lang, 'analyst_target')}:</b> ${signal.target_price}
🛑 <b>${t(lang, 'analyst_stop_loss')}:</b> ${signal.stop_loss}

<b>━━━━━━━━━━━━━━━━━━</b>

📝 <b>${t(lang, 'analyst_analysis')}:</b>
${signal.analysis}
    `;
  }
  
  // مراقبة الإشارات النشطة
  async monitorActiveSignals() {
    const activeSignals = await db.getActiveSignals();
    const marketData = require('./market-data');
    const forexService = require('./forex-service');
    
    for (const signal of activeSignals) {
      try {
        let currentPrice;
        
        if (signal.market_type === 'forex') {
          currentPrice = await forexService.getCurrentPrice(signal.symbol);
        } else {
          currentPrice = await marketData.getCurrentPrice(signal.symbol);
        }
        
        // فحص إذا وصل السعر للهدف أو وقف الخسارة
        if (signal.type === 'buy') {
          if (currentPrice >= parseFloat(signal.target_price)) {
            await this.updateSignalStatus(signal._id, 'success', currentPrice);
            await this.calculateAnalystSuccessRate(signal.analyst_id);
          } else if (currentPrice <= parseFloat(signal.stop_loss)) {
            await this.updateSignalStatus(signal._id, 'failed', currentPrice);
            await this.calculateAnalystSuccessRate(signal.analyst_id);
          }
        } else { // sell
          if (currentPrice <= parseFloat(signal.target_price)) {
            await this.updateSignalStatus(signal._id, 'success', currentPrice);
            await this.calculateAnalystSuccessRate(signal.analyst_id);
          } else if (currentPrice >= parseFloat(signal.stop_loss)) {
            await this.updateSignalStatus(signal._id, 'failed', currentPrice);
            await this.calculateAnalystSuccessRate(signal.analyst_id);
          }
        }
      } catch (error) {
        console.error(`Error monitoring signal ${signal._id}:`, error.message);
      }
    }
  }
}

module.exports = new AnalystSignalsManager();
