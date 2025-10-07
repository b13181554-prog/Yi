const crypto = require('crypto');
const axios = require('axios');
const config = require('./config');

class BinanceService {
  constructor() {
    this.apiKey = config.BINANCE_API_KEY;
    this.apiSecret = config.BINANCE_SECRET_KEY;
    this.baseURL = 'https://api.binance.com';
  }

  createSignature(queryString) {
    return crypto
      .createHmac('sha256', this.apiSecret)
      .update(queryString)
      .digest('hex');
  }

  async makeRequest(endpoint, params = {}, method = 'GET') {
    try {
      const timestamp = Date.now();
      const queryString = new URLSearchParams({
        ...params,
        timestamp,
        recvWindow: 5000
      }).toString();

      const signature = this.createSignature(queryString);
      const url = `${this.baseURL}${endpoint}?${queryString}&signature=${signature}`;

      const response = await axios({
        method,
        url,
        headers: {
          'X-MBX-APIKEY': this.apiKey
        },
        timeout: 30000
      });

      return { success: true, data: response.data };
    } catch (error) {
      console.error('Binance API Error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.msg || error.message
      };
    }
  }

  async withdrawUSDT(address, amount, network = 'TRX') {
    try {
      if (!this.apiKey || !this.apiSecret) {
        return {
          success: false,
          error: 'لم يتم تكوين مفاتيح Binance API'
        };
      }

      if (!address || !address.startsWith('T')) {
        return {
          success: false,
          error: 'عنوان TRON غير صحيح'
        };
      }

      if (amount < 1) {
        return {
          success: false,
          error: 'الحد الأدنى للسحب هو 1 USDT'
        };
      }

      const params = {
        coin: 'USDT',
        network: network,
        address: address,
        amount: amount.toString()
      };

      const result = await this.makeRequest('/sapi/v1/capital/withdraw/apply', params, 'POST');

      if (result.success) {
        return {
          success: true,
          data: {
            withdrawId: result.data.id,
            amount: amount,
            address: address,
            network: network
          }
        };
      } else {
        return result;
      }
    } catch (error) {
      console.error('Error in withdrawUSDT:', error);
      return {
        success: false,
        error: 'فشل في تنفيذ عملية السحب: ' + error.message
      };
    }
  }

  async getWithdrawHistory(limit = 10) {
    try {
      const params = {
        coin: 'USDT',
        limit: limit
      };

      return await this.makeRequest('/sapi/v1/capital/withdraw/history', params);
    } catch (error) {
      console.error('Error getting withdraw history:', error);
      return {
        success: false,
        error: 'فشل في جلب سجل السحوبات'
      };
    }
  }

  async getAccountBalance() {
    try {
      const result = await this.makeRequest('/api/v3/account');
      
      if (result.success) {
        const usdtBalance = result.data.balances.find(b => b.asset === 'USDT');
        return {
          success: true,
          data: {
            free: parseFloat(usdtBalance?.free || 0),
            locked: parseFloat(usdtBalance?.locked || 0)
          }
        };
      }
      
      return result;
    } catch (error) {
      console.error('Error getting account balance:', error);
      return {
        success: false,
        error: 'فشل في جلب رصيد الحساب'
      };
    }
  }

  async getWithdrawStatus(withdrawId) {
    try {
      const params = {
        withdrawOrderId: withdrawId
      };

      return await this.makeRequest('/sapi/v1/capital/withdraw/history', params);
    } catch (error) {
      console.error('Error getting withdraw status:', error);
      return {
        success: false,
        error: 'فشل في جلب حالة السحب'
      };
    }
  }

  isConfigured() {
    return !!(this.apiKey && this.apiSecret);
  }
}

module.exports = new BinanceService();
