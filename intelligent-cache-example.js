/**
 * Intelligent Cache - أمثلة الاستخدام
 * هذا الملف يوضح كيفية استخدام نظام Intelligent Caching في المشروع
 */

const {
  cacheGet,
  cacheSet,
  cacheWrap,
  cacheInvalidate,
  cacheWarm,
  getCacheStats,
  backgroundRefresh
} = require('./intelligent-cache');

async function examples() {
  console.log('🚀 Intelligent Cache Examples\n');

  console.log('Example 1: Basic cacheGet/cacheSet');
  await cacheSet('user:123', { name: 'Ahmed', balance: 100 }, 'user_data');
  const user = await cacheGet('user:123');
  console.log('User:', user);
  console.log('');

  console.log('Example 2: cacheWrap with API call simulation');
  const btcPrice = await cacheWrap(
    'price:BTCUSDT',
    async () => {
      console.log('  📡 Fetching from API (expensive operation)...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      return { symbol: 'BTCUSDT', price: 45000 };
    },
    { dataType: 'market_prices' }
  );
  console.log('BTC Price:', btcPrice);
  console.log('');

  console.log('Example 3: Second call (should be cached)');
  const btcPriceCached = await cacheWrap(
    'price:BTCUSDT',
    async () => {
      console.log('  📡 This should NOT be called!');
      return { symbol: 'BTCUSDT', price: 45000 };
    },
    { dataType: 'market_prices' }
  );
  console.log('BTC Price (cached):', btcPriceCached);
  console.log('');

  console.log('Example 4: Request Coalescing (multiple simultaneous requests)');
  const promises = Array(5).fill(0).map((_, i) => 
    cacheWrap(
      'trending:coins',
      async () => {
        console.log(`  📡 API call ${i + 1} started...`);
        await new Promise(resolve => setTimeout(resolve, 500));
        return ['BTC', 'ETH', 'BNB'];
      },
      { dataType: 'trending_coins' }
    )
  );
  const results = await Promise.all(promises);
  console.log('Results count:', results.length, '(but only 1 API call was made!)');
  console.log('');

  console.log('Example 5: Cache with parameters');
  await cacheWrap(
    'candles:ETHUSDT',
    async () => {
      console.log('  📡 Fetching candles...');
      return [{ open: 2000, close: 2100 }];
    },
    { 
      params: { interval: '1h', limit: 100 },
      dataType: 'candles'
    }
  );
  console.log('');

  console.log('Example 6: Cache Warming (pre-populate)');
  await cacheWarm([
    {
      key: 'price:ETHUSDT',
      fn: async () => ({ symbol: 'ETHUSDT', price: 2100 }),
      options: { dataType: 'market_prices' }
    },
    {
      key: 'price:BNBUSDT',
      fn: async () => ({ symbol: 'BNBUSDT', price: 350 }),
      options: { dataType: 'market_prices' }
    }
  ]);
  console.log('✅ Cache warmed');
  console.log('');

  console.log('Example 7: Cache Invalidation');
  await cacheInvalidate('price:*');
  console.log('✅ All prices invalidated');
  console.log('');

  console.log('Example 8: Cache Statistics');
  const stats = getCacheStats();
  console.log('Cache Stats:', JSON.stringify(stats, null, 2));
  console.log('');

  console.log('✅ All examples completed!');
}

async function marketDataIntegrationExample() {
  console.log('\n🔗 Market Data Integration Example\n');

  const mockMarketDataCall = async (symbol) => {
    console.log(`  📡 Fetching real price for ${symbol}...`);
    await new Promise(resolve => setTimeout(resolve, 500));
    return Math.random() * 50000;
  };

  console.log('First call (cache miss, API called):');
  const price1 = await cacheWrap(
    'market:BTCUSDT',
    () => mockMarketDataCall('BTCUSDT'),
    { dataType: 'market_prices_fast' }
  );
  console.log(`Price: $${price1.toFixed(2)}`);

  console.log('\nSecond call (cache hit, no API call):');
  const price2 = await cacheWrap(
    'market:BTCUSDT',
    () => mockMarketDataCall('BTCUSDT'),
    { dataType: 'market_prices_fast' }
  );
  console.log(`Price: $${price2.toFixed(2)}`);

  console.log('\n📊 Final Stats:');
  const stats = getCacheStats();
  console.log(`Memory Hit Rate: ${stats.memory.hitRate}`);
  console.log(`Overall Hit Rate: ${stats.overall.hitRate}`);
  console.log(`API Calls Saved: ${stats.savings.apiCallsSaved}`);
  console.log(`Estimated Time Saved: ${stats.savings.estimatedTimeSaved}`);
}

if (require.main === module) {
  examples()
    .then(() => marketDataIntegrationExample())
    .then(() => {
      console.log('\n✅ All examples completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
}

module.exports = { examples, marketDataIntegrationExample };
