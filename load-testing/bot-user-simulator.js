const axios = require('axios');

class BotUserSimulator {
  constructor(baseURL = 'http://localhost:5000') {
    this.baseURL = baseURL;
    this.userSessions = [];
    this.results = {
      totalActions: 0,
      successfulActions: 0,
      failedActions: 0,
      actionsByType: {}
    };
  }

  createUser(userId, username = null) {
    const user = {
      userId,
      username: username || `user_${userId}`,
      sessionStart: Date.now(),
      actions: [],
      balance: 0,
      subscriptions: []
    };
    this.userSessions.push(user);
    return user;
  }

  async simulateUserAction(user, actionType, actionFn) {
    const startTime = Date.now();
    this.results.totalActions++;

    if (!this.results.actionsByType[actionType]) {
      this.results.actionsByType[actionType] = { total: 0, success: 0, failed: 0 };
    }
    this.results.actionsByType[actionType].total++;

    try {
      const result = await actionFn();
      const duration = Date.now() - startTime;

      this.results.successfulActions++;
      this.results.actionsByType[actionType].success++;

      user.actions.push({
        type: actionType,
        success: true,
        duration,
        timestamp: new Date().toISOString()
      });

      return { success: true, duration, result };
    } catch (error) {
      const duration = Date.now() - startTime;

      this.results.failedActions++;
      this.results.actionsByType[actionType].failed++;

      user.actions.push({
        type: actionType,
        success: false,
        duration,
        error: error.message,
        timestamp: new Date().toISOString()
      });

      return { success: false, duration, error: error.message };
    }
  }

  async simulateGetUserData(user) {
    return this.simulateUserAction(user, 'getUserData', async () => {
      const response = await axios.post(`${this.baseURL}/api/user`, {
        user_id: user.userId
      }, { timeout: 10000 });
      
      if (response.data.success && response.data.user) {
        user.balance = response.data.user.balance || 0;
        user.subscriptions = response.data.user.subscribed_analysts || [];
      }
      
      return response.data;
    });
  }

  async simulateGetPrice(user, symbol = 'BTCUSDT') {
    return this.simulateUserAction(user, 'getPrice', async () => {
      const response = await axios.post(`${this.baseURL}/api/price`, {
        symbol,
        market: 'crypto'
      }, { timeout: 10000 });
      return response.data;
    });
  }

  async simulateAnalysis(user, symbol = 'BTCUSDT') {
    return this.simulateUserAction(user, 'performAnalysis', async () => {
      const response = await axios.post(`${this.baseURL}/api/analyze`, {
        user_id: user.userId,
        symbol,
        market: 'crypto',
        timeframe: '1h',
        indicators: {
          rsi: true,
          macd: true,
          ema: true,
          sma: true,
          bollinger: true
        },
        analysis_type: 'regular'
      }, { timeout: 30000 });
      return response.data;
    });
  }

  async simulateSearch(user, query = 'BTC') {
    return this.simulateUserAction(user, 'searchAssets', async () => {
      const response = await axios.post(`${this.baseURL}/api/search-assets`, {
        query
      }, { timeout: 10000 });
      return response.data;
    });
  }

  async simulateUserJourney(userId, actions = 10) {
    const user = this.createUser(userId);
    
    const actionTypes = [
      () => this.simulateGetUserData(user),
      () => this.simulateGetPrice(user, 'BTCUSDT'),
      () => this.simulateGetPrice(user, 'ETHUSDT'),
      () => this.simulateSearch(user, 'BTC'),
      () => this.simulateSearch(user, 'ETH'),
      () => this.simulateAnalysis(user, 'BTCUSDT')
    ];

    for (let i = 0; i < actions; i++) {
      const randomAction = actionTypes[Math.floor(Math.random() * actionTypes.length)];
      await randomAction();
      
      await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 800));
    }

    return user;
  }

  async simulateMultipleUsers(numUsers = 10, actionsPerUser = 5) {
    console.log(`\n👥 محاكاة ${numUsers} مستخدم (${actionsPerUser} إجراء لكل مستخدم)...`);
    
    const userPromises = [];
    for (let i = 0; i < numUsers; i++) {
      userPromises.push(this.simulateUserJourney(1000000 + i, actionsPerUser));
      
      if (i % 10 === 0 && i > 0) {
        console.log(`  ✓ بدء محاكاة: ${i}/${numUsers} مستخدم`);
      }
    }

    await Promise.all(userPromises);
    console.log(`✅ تم الانتهاء من محاكاة جميع المستخدمين`);
  }

  async simulateConcurrentUsers(numUsers = 20, duration = 10000) {
    console.log(`\n🔥 محاكاة ${numUsers} مستخدم متزامن لمدة ${duration}ms...`);
    const startTime = Date.now();

    const simulateUser = async (userId) => {
      const user = this.createUser(userId);
      
      while (Date.now() - startTime < duration) {
        const actions = [
          () => this.simulateGetUserData(user),
          () => this.simulateGetPrice(user, 'BTCUSDT'),
          () => this.simulateSearch(user, 'BTC')
        ];
        
        const randomAction = actions[Math.floor(Math.random() * actions.length)];
        await randomAction();
        
        await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 400));
      }
    };

    const userPromises = Array(numUsers).fill(0).map((_, i) => 
      simulateUser(2000000 + i)
    );

    await Promise.all(userPromises);
    console.log(`✅ انتهت محاكاة المستخدمين المتزامنين`);
  }

  generateReport() {
    const successRate = this.results.totalActions > 0 
      ? ((this.results.successfulActions / this.results.totalActions) * 100).toFixed(2)
      : 0;

    const actionStats = {};
    Object.entries(this.results.actionsByType).forEach(([type, stats]) => {
      actionStats[type] = {
        total: stats.total,
        success: stats.success,
        failed: stats.failed,
        successRate: ((stats.success / stats.total) * 100).toFixed(2) + '%'
      };
    });

    return {
      summary: {
        totalUsers: this.userSessions.length,
        totalActions: this.results.totalActions,
        successfulActions: this.results.successfulActions,
        failedActions: this.results.failedActions,
        successRate: successRate + '%'
      },
      actionStats,
      userSessions: this.userSessions.map(u => ({
        userId: u.userId,
        username: u.username,
        totalActions: u.actions.length,
        successfulActions: u.actions.filter(a => a.success).length,
        sessionDuration: Date.now() - u.sessionStart
      }))
    };
  }

  printReport(report) {
    console.log('\n' + '='.repeat(80));
    console.log('👥 تقرير محاكاة المستخدمين');
    console.log('='.repeat(80));

    console.log('\n📊 الملخص:');
    console.log(`  عدد المستخدمين: ${report.summary.totalUsers}`);
    console.log(`  إجمالي الإجراءات: ${report.summary.totalActions}`);
    console.log(`  الإجراءات الناجحة: ${report.summary.successfulActions}`);
    console.log(`  الإجراءات الفاشلة: ${report.summary.failedActions}`);
    console.log(`  معدل النجاح: ${report.summary.successRate}`);

    console.log('\n📈 إحصائيات الإجراءات:');
    Object.entries(report.actionStats).forEach(([type, stats]) => {
      console.log(`  ${type}:`);
      console.log(`    الإجمالي: ${stats.total}`);
      console.log(`    النجاح: ${stats.success}`);
      console.log(`    الفشل: ${stats.failed}`);
      console.log(`    معدل النجاح: ${stats.successRate}`);
    });

    console.log('\n' + '='.repeat(80));
  }
}

async function runBotUserSimulation() {
  const simulator = new BotUserSimulator('http://localhost:5000');

  try {
    console.log('🤖 بدء محاكاة مستخدمي البوت...\n');

    await simulator.simulateMultipleUsers(20, 5);
    
    await simulator.simulateConcurrentUsers(30, 10000);

    const report = simulator.generateReport();
    simulator.printReport(report);

    const fs = require('fs').promises;
    await fs.writeFile(
      'load-testing/bot-user-simulation-report.json',
      JSON.stringify(report, null, 2)
    );
    console.log('\n✅ تم حفظ التقرير في: load-testing/bot-user-simulation-report.json');

    return report;
  } catch (error) {
    console.error('\n❌ خطأ في محاكاة المستخدمين:', error.message);
    throw error;
  }
}

if (require.main === module) {
  runBotUserSimulation()
    .then(() => {
      console.log('\n✨ محاكاة المستخدمين منتهية بنجاح');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 فشلت محاكاة المستخدمين:', error.message);
      process.exit(1);
    });
}

module.exports = { BotUserSimulator, runBotUserSimulation };
