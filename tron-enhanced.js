const { TronWeb } = require('tronweb');
const Bottleneck = require('bottleneck');
const config = require('./config');
const cache = require('./cache-manager');
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

const TRON_APIS = [
  { url: 'https://api.trongrid.io', name: 'TronGrid Main', priority: 1 },
  { url: 'https://api.tronstack.io', name: 'TronStack', priority: 2 },
  { url: 'https://api.shasta.trongrid.io', name: 'Shasta (Testnet)', priority: 3 }
];

const USDT_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';

const limiter = new Bottleneck({
  minTime: 100,
  maxConcurrent: 50,
  reservoir: 100,
  reservoirRefreshAmount: 100,
  reservoirRefreshInterval: 1000
});

class TronEnhanced {
  constructor() {
    this.apis = TRON_APIS.map(api => ({
      ...api,
      client: new TronWeb({ fullHost: api.url }),
      healthy: true,
      lastError: null,
      errorCount: 0
    }));
    
    this.currentApiIndex = 0;
    this.healthCheckInterval = null;
    this.startHealthCheck();
  }

  startHealthCheck() {
    this.healthCheckInterval = setInterval(async () => {
      for (const api of this.apis) {
        try {
          const block = await api.client.trx.getCurrentBlock();
          if (block) {
            api.healthy = true;
            api.errorCount = 0;
            api.lastError = null;
          }
        } catch (error) {
          api.healthy = false;
          api.errorCount++;
          api.lastError = error.message;
          logger.warn(`⚠️ API ${api.name} health check failed: ${error.message}`);
        }
      }
    }, 30000);
  }

  getHealthyApi() {
    const healthyApis = this.apis.filter(api => api.healthy);
    
    if (healthyApis.length === 0) {
      logger.warn('⚠️ No healthy APIs available, using first API anyway');
      return this.apis[0];
    }
    
    healthyApis.sort((a, b) => {
      if (a.errorCount !== b.errorCount) {
        return a.errorCount - b.errorCount;
      }
      return a.priority - b.priority;
    });
    
    return healthyApis[0];
  }

  async executeWithRetry(operation, maxRetries = 3) {
    let lastError;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const api = this.getHealthyApi();
      
      try {
        const result = await limiter.schedule(() => operation(api.client));
        return result;
      } catch (error) {
        lastError = error;
        api.errorCount++;
        api.healthy = false;
        logger.warn(`⚠️ Attempt ${attempt + 1}/${maxRetries} failed with ${api.name}: ${error.message}`);
        
        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }
    }
    
    throw lastError;
  }

  async verifyUSDTTransaction(txId, expectedAddress, expectedAmount) {
    const cacheKey = `tx:${txId}`;
    
    try {
      const cached = await cache.get(cacheKey);
      if (cached) {
        logger.info(`📦 Transaction ${txId} retrieved from cache`);
        return cached;
      }

      const result = await this.executeWithRetry(async (tronWeb) => {
        const transaction = await tronWeb.trx.getTransaction(txId);
        
        if (!transaction) {
          return { success: false, error: 'المعاملة غير موجودة' };
        }
        
        const contract = transaction.raw_data.contract[0];
        
        if (contract.type !== 'TriggerSmartContract') {
          return { success: false, error: 'ليست معاملة USDT' };
        }
        
        const contractAddress = tronWeb.address.fromHex(contract.parameter.value.contract_address);
        
        if (contractAddress !== USDT_CONTRACT) {
          return { success: false, error: 'ليست معاملة USDT TRC20' };
        }
        
        const data = contract.parameter.value.data;
        const method = data.substring(0, 8);
        
        if (method !== 'a9059cbb') {
          return { success: false, error: 'طريقة غير صحيحة' };
        }
        
        const toAddress = '41' + data.substring(8, 72);
        const toAddressBase58 = tronWeb.address.fromHex(toAddress);
        
        const amountHex = data.substring(72);
        const amount = parseInt(amountHex, 16) / 1000000;
        
        if (toAddressBase58 !== expectedAddress) {
          return { 
            success: false, 
            error: 'عنوان المستلم غير صحيح',
            details: { received: toAddressBase58, expected: expectedAddress }
          };
        }
        
        if (expectedAmount && Math.abs(amount - expectedAmount) > 0.01) {
          return { 
            success: false, 
            error: 'المبلغ غير مطابق',
            details: { received: amount, expected: expectedAmount }
          };
        }
        
        const transactionInfo = await tronWeb.trx.getTransactionInfo(txId);
        
        if (!transactionInfo || !transactionInfo.receipt) {
          return { 
            success: false, 
            error: 'المعاملة لم تكتمل بعد',
            status: 'pending',
            message: 'يرجى الانتظار حتى يتم تأكيد المعاملة على blockchain'
          };
        }
        
        if (transactionInfo.receipt.result !== 'SUCCESS') {
          return { 
            success: false, 
            error: 'فشلت المعاملة على blockchain',
            status: 'failed',
            message: 'المعاملة تمت معالجتها ولكنها فشلت'
          };
        }
        
        const fromAddress = tronWeb.address.fromHex(transaction.raw_data.contract[0].parameter.value.owner_address);
        
        const successResult = {
          success: true,
          data: {
            txId,
            from: fromAddress,
            to: toAddressBase58,
            amount,
            timestamp: transaction.raw_data.timestamp,
            confirmed: true
          }
        };
        
        await cache.set(cacheKey, successResult, 3600);
        
        return successResult;
      });

      logger.info(`✅ Transaction ${txId} verified successfully`);
      return result;
      
    } catch (error) {
      logger.error(`❌ Error verifying transaction ${txId}: ${error.message}`);
      return { success: false, error: 'فشل في التحقق من المعاملة: ' + error.message };
    }
  }

  async sendUSDT(toAddress, amount, privateKey) {
    try {
      const result = await this.executeWithRetry(async (tronWeb) => {
        tronWeb.setPrivateKey(privateKey);
        
        const contract = await tronWeb.contract().at(USDT_CONTRACT);
        const amountInSun = amount * 1000000;
        
        const txResult = await contract.transfer(toAddress, amountInSun).send({
          feeLimit: 100000000
        });
        
        return {
          success: true,
          txId: txResult
        };
      });

      logger.info(`✅ USDT sent successfully to ${toAddress}`);
      return result;
      
    } catch (error) {
      logger.error(`❌ Error sending USDT: ${error.message}`);
      return { success: false, error: 'فشل في إرسال USDT: ' + error.message };
    }
  }

  async getUSDTBalance(address) {
    const cacheKey = `balance:${address}`;
    
    try {
      const cached = await cache.get(cacheKey);
      if (cached) {
        return cached;
      }

      const result = await this.executeWithRetry(async (tronWeb) => {
        const contract = await tronWeb.contract().at(USDT_CONTRACT);
        const balance = await contract.balanceOf(address).call();
        
        return {
          success: true,
          balance: balance / 1000000
        };
      });

      await cache.set(cacheKey, result, 60);
      
      logger.info(`✅ Balance retrieved for ${address}: ${result.balance} USDT`);
      return result;
      
    } catch (error) {
      logger.error(`❌ Error getting balance: ${error.message}`);
      return { success: false, error: 'فشل في جلب الرصيد: ' + error.message };
    }
  }

  getApiStatus() {
    return this.apis.map(api => ({
      name: api.name,
      url: api.url,
      healthy: api.healthy,
      errorCount: api.errorCount,
      lastError: api.lastError,
      priority: api.priority
    }));
  }

  destroy() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
  }
}

module.exports = new TronEnhanced();
