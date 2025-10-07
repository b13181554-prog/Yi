const cron = require('node-cron');
const db = require('./database');

class RankingScheduler {
  constructor() {
    this.isRunning = false;
  }

  start() {
    cron.schedule('0 0 * * *', async () => {
      console.log('🔄 Starting daily analyst ranking update...');
      await this.updateRankings();
    });
    
    console.log('✅ Analyst ranking scheduler started (runs daily at midnight)');
  }

  async updateRankings() {
    if (this.isRunning) {
      console.log('⏭️ Ranking update already in progress, skipping...');
      return;
    }

    this.isRunning = true;

    try {
      const count = await db.updateAllAnalystRankings();
      console.log(`✅ Daily ranking update completed for ${count} analysts`);
    } catch (error) {
      console.error('❌ Error updating analyst rankings:', error);
    } finally {
      this.isRunning = false;
    }
  }

  async updateNow() {
    console.log('🔄 Manual ranking update triggered...');
    await this.updateRankings();
  }
}

module.exports = new RankingScheduler();
