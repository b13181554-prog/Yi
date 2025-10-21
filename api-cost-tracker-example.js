const { trackAPICall, wrapAPICall, getCostStats, getAPIBreakdown, getOptimizationSuggestions } = require('./api-cost-tracker');
const axios = require('axios');

async function exampleUsage() {
  console.log('📚 API Cost Tracker - Usage Examples\n');

  console.log('Example 1: Track a single API call manually');
  console.log('==========================================');
  const startTime = Date.now();
  try {
    const response = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
      params: { ids: 'bitcoin', vs_currencies: 'usd' }
    });
    
    await trackAPICall('CoinGecko', '/api/v3/simple/price', {
      status: 'success',
      responseTime: Date.now() - startTime,
      userId: 12345,
      cacheHit: false,
      dataSize: JSON.stringify(response.data).length
    });
    
    console.log('✅ Tracked CoinGecko API call');
  } catch (error) {
    await trackAPICall('CoinGecko', '/api/v3/simple/price', {
      status: 'error',
      responseTime: Date.now() - startTime,
      userId: 12345,
      cacheHit: false
    });
    console.log('❌ Tracked failed API call');
  }

  console.log('\nExample 2: Wrap an API call function (Recommended)');
  console.log('==================================================');
  
  const getCoinPrice = async (coinId) => {
    const response = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
      params: { ids: coinId, vs_currencies: 'usd' }
    });
    return response.data;
  };

  try {
    const price = await wrapAPICall(
      'CoinGecko',
      '/api/v3/simple/price',
      () => getCoinPrice('ethereum'),
      { userId: 12345 }
    );
    
    console.log('✅ Ethereum price fetched:', price);
  } catch (error) {
    console.log('❌ Error fetching price:', error.message);
  }

  console.log('\nExample 3: Get cost statistics for today');
  console.log('========================================');
  const todayStats = await getCostStats('today');
  console.log('Today Stats:', {
    totalCalls: todayStats.totalCalls,
    totalCost: `$${todayStats.totalCost.toFixed(6)}`,
    totalErrors: todayStats.totalErrors,
    cacheHitRate: `${todayStats.cacheHitRate.toFixed(1)}%`,
    avgResponseTime: `${todayStats.avgResponseTime.toFixed(0)}ms`
  });

  console.log('\nExample 4: Get API breakdown');
  console.log('===========================');
  const breakdown = await getAPIBreakdown();
  console.log('API Breakdown (Top 5):');
  breakdown.slice(0, 5).forEach((api, index) => {
    console.log(`${index + 1}. ${api.apiName}:`, {
      calls: api.calls,
      cost: `$${api.cost.toFixed(6)}`,
      errorRate: `${api.errorRate.toFixed(1)}%`,
      cacheHitRate: `${api.cacheHitRate.toFixed(1)}%`
    });
  });

  console.log('\nExample 5: Get optimization suggestions');
  console.log('======================================');
  const suggestions = await getOptimizationSuggestions();
  console.log(`Found ${suggestions.length} optimization suggestions:`);
  suggestions.slice(0, 3).forEach((suggestion, index) => {
    console.log(`${index + 1}. [${suggestion.priority.toUpperCase()}] ${suggestion.type}:`);
    console.log(`   API: ${suggestion.apiName}`);
    console.log(`   Message: ${suggestion.message}`);
    if (suggestion.potentialSavings > 0) {
      console.log(`   Potential Savings: $${suggestion.potentialSavings.toFixed(2)}`);
    }
  });

  console.log('\n' + '='.repeat(60));
  console.log('✅ Examples completed successfully!');
  console.log('='.repeat(60));
}

async function integrateWithMarketData() {
  console.log('\n📊 Integration Example with market-data.js');
  console.log('==========================================\n');

  console.log('Before (without tracking):');
  console.log(`
  async getPriceFromCoinGecko(symbol) {
    const response = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
      params: { ids: coinId, vs_currencies: 'usd' }
    });
    return response.data[coinId]?.usd;
  }
  `);

  console.log('After (with tracking - Method 1: Manual):');
  console.log(`
  const { trackAPICall } = require('./api-cost-tracker');
  
  async getPriceFromCoinGecko(symbol) {
    const startTime = Date.now();
    try {
      const response = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
        params: { ids: coinId, vs_currencies: 'usd' }
      });
      
      await trackAPICall('CoinGecko', '/api/v3/simple/price', {
        status: 'success',
        responseTime: Date.now() - startTime,
        cacheHit: false
      });
      
      return response.data[coinId]?.usd;
    } catch (error) {
      await trackAPICall('CoinGecko', '/api/v3/simple/price', {
        status: 'error',
        responseTime: Date.now() - startTime
      });
      throw error;
    }
  }
  `);

  console.log('After (with tracking - Method 2: Wrapper - RECOMMENDED):');
  console.log(`
  const { wrapAPICall } = require('./api-cost-tracker');
  
  async getPriceFromCoinGecko(symbol) {
    return wrapAPICall('CoinGecko', '/api/v3/simple/price', async () => {
      const response = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
        params: { ids: coinId, vs_currencies: 'usd' }
      });
      return response.data[coinId]?.usd;
    });
  }
  `);

  console.log('\n✅ Method 2 (wrapAPICall) is recommended because:');
  console.log('   • Automatic tracking of success/error');
  console.log('   • Automatic response time measurement');
  console.log('   • Cleaner code with less boilerplate');
  console.log('   • Consistent error handling');
}

async function dashboardExample() {
  console.log('\n🎯 Dashboard API Endpoints');
  console.log('=========================\n');

  console.log('Available endpoints:');
  console.log('1. GET /api/admin/costs');
  console.log('   Returns: Complete dashboard data with all metrics\n');

  console.log('2. GET /api/admin/costs/stats/:period');
  console.log('   Params: period = hour|today|week|month');
  console.log('   Returns: Cost statistics for the specified period\n');

  console.log('3. GET /api/admin/costs/breakdown');
  console.log('   Returns: Cost breakdown by API\n');

  console.log('4. GET /api/admin/costs/suggestions');
  console.log('   Returns: Optimization suggestions\n');

  console.log('5. GET /api/admin/costs/export/:format/:period');
  console.log('   Params: format = json|csv, period = hour|today|week|month');
  console.log('   Returns: Exportable report\n');

  console.log('6. POST /api/admin/costs/alerts');
  console.log('   Body: { hourlyBudget, dailyBudget, monthlyBudget, perAPILimit, enabled }');
  console.log('   Returns: Updated alert configuration\n');

  console.log('Example usage with curl:');
  console.log(`
  # Get complete dashboard
  curl http://localhost:5000/api/admin/costs
  
  # Get today's stats
  curl http://localhost:5000/api/admin/costs/stats/today
  
  # Get breakdown
  curl http://localhost:5000/api/admin/costs/breakdown
  
  # Export as CSV
  curl http://localhost:5000/api/admin/costs/export/csv/today > report.csv
  
  # Set alerts
  curl -X POST http://localhost:5000/api/admin/costs/alerts \\
    -H "Content-Type: application/json" \\
    -d '{"hourlyBudget": 5, "dailyBudget": 50, "enabled": true}'
  `);
}

if (require.main === module) {
  (async () => {
    try {
      await exampleUsage();
      await integrateWithMarketData();
      await dashboardExample();
      
      process.exit(0);
    } catch (error) {
      console.error('❌ Error running examples:', error);
      process.exit(1);
    }
  })();
}

module.exports = {
  exampleUsage,
  integrateWithMarketData,
  dashboardExample
};
