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

class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.successThreshold = options.successThreshold || 2;
    this.timeout = options.timeout || 60000;
    this.resetTimeout = options.resetTimeout || 30000;
    
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttempt = Date.now();
    this.name = options.name || 'CircuitBreaker';
  }

  async execute(fn, fallback = null) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        logger.warn(`⚡ Circuit ${this.name} is OPEN - rejecting request`);
        if (fallback) return fallback();
        throw new Error(`Circuit breaker ${this.name} is OPEN`);
      }
      
      this.state = 'HALF_OPEN';
      logger.info(`🔄 Circuit ${this.name} entering HALF_OPEN state`);
    }

    try {
      const result = await this._executeWithTimeout(fn);
      return this._onSuccess(result);
    } catch (error) {
      return this._onFailure(error, fallback);
    }
  }

  async _executeWithTimeout(fn) {
    return Promise.race([
      fn(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), this.timeout)
      )
    ]);
  }

  _onSuccess(result) {
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      
      if (this.successCount >= this.successThreshold) {
        this.state = 'CLOSED';
        this.failureCount = 0;
        this.successCount = 0;
        logger.info(`✅ Circuit ${this.name} is now CLOSED`);
      }
    } else {
      this.failureCount = 0;
    }
    
    return result;
  }

  _onFailure(error, fallback) {
    this.failureCount++;
    logger.error(`❌ Circuit ${this.name} failure ${this.failureCount}/${this.failureThreshold}: ${error.message}`);
    
    if (this.state === 'HALF_OPEN' || this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.resetTimeout;
      this.successCount = 0;
      logger.error(`🔴 Circuit ${this.name} is now OPEN - will retry at ${new Date(this.nextAttempt).toISOString()}`);
    }
    
    if (fallback) {
      logger.info(`🔄 Using fallback for ${this.name}`);
      return fallback();
    }
    
    throw error;
  }

  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      nextAttempt: new Date(this.nextAttempt).toISOString()
    };
  }

  reset() {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttempt = Date.now();
    logger.info(`🔄 Circuit ${this.name} manually reset`);
  }
}

module.exports = CircuitBreaker;
