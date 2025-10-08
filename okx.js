const crypto = require('crypto');
const axios = require('axios');
const config = require('./config');

class OKXWithdrawal {
  constructor() {
    this.apiKey = config.OKX_API_KEY;
    this.apiSecret = config.OKX_SECRET_KEY;
    this.passphrase = config.OKX_PASSPHRASE;
    this.baseUrl = 'https://www.okx.com';
  }

  isConfigured() {
    return !!(this.apiKey && this.apiSecret && this.passphrase);
  }

  generateSignature(timestamp, method, requestPath, body = '') {
    const prehash = timestamp + method + requestPath + body;
    const signature = crypto.createHmac('sha256', this.apiSecret)
                            .update(prehash)
                            .digest('base64');
    return signature;
  }

  async withdrawUSDT(address, amount, chain = 'USDT-TRC20') {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'OKX API غير مكوّن. يرجى إضافة المفاتيح في إعدادات البيئة'
      };
    }

    try {
      const timestamp = new Date().toISOString();
      const method = 'POST';
      const requestPath = '/api/v5/asset/withdrawal';
      
      const body = JSON.stringify({
        ccy: 'USDT',
        amt: amount.toString(),
        dest: '4',
        toAddr: address,
        chain: chain,
        fee: '1'
      });

      const signature = this.generateSignature(timestamp, method, requestPath, body);

      const response = await axios({
        method: method,
        url: this.baseUrl + requestPath,
        headers: {
          'Content-Type': 'application/json',
          'OK-ACCESS-KEY': this.apiKey,
          'OK-ACCESS-SIGN': signature,
          'OK-ACCESS-TIMESTAMP': timestamp,
          'OK-ACCESS-PASSPHRASE': this.passphrase,
        },
        data: body,
        timeout: 30000
      });

      console.log('✅ OKX Withdrawal Response:', response.data);

      if (response.data && response.data.code === '0' && response.data.data && response.data.data.length > 0) {
        return {
          success: true,
          data: {
            withdrawId: response.data.data[0].wdId,
            currency: response.data.data[0].ccy,
            amount: amount,
            address: address,
            chain: chain
          }
        };
      } else {
        const errorMsg = response.data?.msg || 'خطأ غير معروف';
        console.error('❌ OKX Withdrawal Error:', response.data);
        return {
          success: false,
          error: `فشل السحب عبر OKX: ${errorMsg}`
        };
      }

    } catch (error) {
      console.error('❌ OKX API Error:', error.response?.data || error.message);
      
      const errorMsg = error.response?.data?.msg || 
                       error.response?.data?.error || 
                       error.message || 
                       'خطأ في الاتصال بـ OKX';
      
      return {
        success: false,
        error: errorMsg
      };
    }
  }

  async getWithdrawalHistory(currency = 'USDT', limit = 20) {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'OKX API غير مكوّن'
      };
    }

    try {
      const timestamp = new Date().toISOString();
      const method = 'GET';
      const requestPath = `/api/v5/asset/withdrawal-history?ccy=${currency}&limit=${limit}`;
      
      const signature = this.generateSignature(timestamp, method, requestPath);

      const response = await axios({
        method: method,
        url: this.baseUrl + requestPath,
        headers: {
          'OK-ACCESS-KEY': this.apiKey,
          'OK-ACCESS-SIGN': signature,
          'OK-ACCESS-TIMESTAMP': timestamp,
          'OK-ACCESS-PASSPHRASE': this.passphrase,
        },
        timeout: 15000
      });

      if (response.data && response.data.code === '0') {
        return {
          success: true,
          data: response.data.data
        };
      } else {
        return {
          success: false,
          error: response.data?.msg || 'فشل جلب السجل'
        };
      }

    } catch (error) {
      console.error('❌ OKX History Error:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new OKXWithdrawal();
