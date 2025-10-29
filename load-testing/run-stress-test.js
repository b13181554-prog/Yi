const LoadTester = require('./load-tester');

async function runComprehensiveStressTest() {
  console.log('🚀 بدء اختبار الضغط الشامل على OBENTCHI Trading Bot\n');
  
  const tester = new LoadTester('http://localhost:5000');
  tester.results.startTime = Date.now();

  const testUserIds = Array.from({ length: 50 }, (_, i) => `test_user_${1000000 + i}`);
  
  const cryptoSymbols = [
    'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'DOGEUSDT',
    'XRPUSDT', 'DOTUSDT', 'UNIUSDT', 'SOLUSDT', 'LINKUSDT'
  ];

  const searchQueries = [
    'BTC', 'ETH', 'bitcoin', 'ethereum', 'doge',
    'cardano', 'polkadot', 'solana', 'chainlink', 'uniswap'
  ];

  const analysisTestCases = [
    {
      user_id: testUserIds[0],
      symbol: 'BTCUSDT',
      market: 'crypto',
      timeframe: '1h',
      indicators: { rsi: true, macd: true, ema: true }
    },
    {
      user_id: testUserIds[1],
      symbol: 'ETHUSDT',
      market: 'crypto',
      timeframe: '4h',
      indicators: { rsi: true, bollinger: true, sma: true }
    },
    {
      user_id: testUserIds[2],
      symbol: 'BNBUSDT',
      market: 'crypto',
      timeframe: '1d',
      indicators: { macd: true, ema: true, stochastic: true }
    }
  ];

  try {
    console.log('📊 المرحلة 1: اختبارات أساسية');
    console.log('─'.repeat(80));
    
    await tester.testHealthEndpoint(100);
    
    const systemResources1 = await tester.measureSystemResources();
    tester.results.memoryUsage.push(systemResources1);
    console.log(`💾 استخدام الذاكرة: ${systemResources1.memory.heapUsed}MB`);

    console.log('\n📊 المرحلة 2: اختبار بيانات المستخدمين');
    console.log('─'.repeat(80));
    
    await tester.testUserDataEndpoint(testUserIds.slice(0, 20), 3);
    
    const systemResources2 = await tester.measureSystemResources();
    tester.results.memoryUsage.push(systemResources2);
    console.log(`💾 استخدام الذاكرة: ${systemResources2.memory.heapUsed}MB`);

    console.log('\n📊 المرحلة 3: اختبار بيانات الأسعار');
    console.log('─'.repeat(80));
    
    await tester.testPriceEndpoint(cryptoSymbols, 5);
    
    const systemResources3 = await tester.measureSystemResources();
    tester.results.memoryUsage.push(systemResources3);
    console.log(`💾 استخدام الذاكرة: ${systemResources3.memory.heapUsed}MB`);

    console.log('\n📊 المرحلة 4: اختبار البحث');
    console.log('─'.repeat(80));
    
    await tester.testSearchEndpoint(searchQueries, 5);
    
    const systemResources4 = await tester.measureSystemResources();
    tester.results.memoryUsage.push(systemResources4);
    console.log(`💾 استخدام الذاكرة: ${systemResources4.memory.heapUsed}MB`);

    console.log('\n📊 المرحلة 5: اختبار التحليل الفني');
    console.log('─'.repeat(80));
    
    await tester.testAnalysisEndpoint(analysisTestCases, 3);
    
    const systemResources5 = await tester.measureSystemResources();
    tester.results.memoryUsage.push(systemResources5);
    console.log(`💾 استخدام الذاكرة: ${systemResources5.memory.heapUsed}MB`);

    console.log('\n📊 المرحلة 6: اختبار الضغط المتزامن (50 مستخدم متزامن)');
    console.log('─'.repeat(80));
    
    await tester.stressTestConcurrent(
      '/api/health',
      {},
      50,
      10000
    );
    
    const systemResources6 = await tester.measureSystemResources();
    tester.results.memoryUsage.push(systemResources6);
    console.log(`💾 استخدام الذاكرة: ${systemResources6.memory.heapUsed}MB`);

    console.log('\n📊 المرحلة 7: اختبار التدرج (0 إلى 100 مستخدم)');
    console.log('─'.repeat(80));
    
    await tester.rampUpTest(
      '/api/health',
      {},
      100,
      30000
    );
    
    const systemResources7 = await tester.measureSystemResources();
    tester.results.memoryUsage.push(systemResources7);
    console.log(`💾 استخدام الذاكرة: ${systemResources7.memory.heapUsed}MB`);

    console.log('\n📊 المرحلة 8: اختبار الحمل الأقصى (200 مستخدم متزامن)');
    console.log('─'.repeat(80));
    console.log('⚠️  تحذير: هذا الاختبار قد يسبب ضغط كبير على النظام');
    
    await tester.stressTestConcurrent(
      '/api/price',
      { symbol: 'BTCUSDT', market: 'crypto' },
      200,
      15000
    );
    
    const systemResources8 = await tester.measureSystemResources();
    tester.results.memoryUsage.push(systemResources8);
    console.log(`💾 استخدام الذاكرة: ${systemResources8.memory.heapUsed}MB`);

    tester.results.endTime = Date.now();

    console.log('\n📊 إنشاء التقرير النهائي...');
    const report = await tester.generateReport();
    
    report.memoryUsageHistory = tester.results.memoryUsage.map((usage, i) => ({
      phase: i + 1,
      heapUsed: usage.memory.heapUsed,
      rss: usage.memory.rss,
      systemUsedPercent: usage.memory.systemUsedPercent
    }));

    tester.printReport(report);
    
    await tester.saveReport(report, 'load-testing/stress-test-report.json');

    console.log('\n✅ اختبار الضغط الشامل منتهي!');
    
    return report;

  } catch (error) {
    console.error('\n❌ خطأ في اختبار الضغط:', error.message);
    console.error(error.stack);
    
    tester.results.endTime = Date.now();
    const report = await tester.generateReport();
    await tester.saveReport(report, 'load-testing/stress-test-report-error.json');
    
    throw error;
  }
}

if (require.main === module) {
  runComprehensiveStressTest()
    .then(() => {
      console.log('\n✨ جميع الاختبارات منتهية بنجاح');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 فشل الاختبار:', error.message);
      process.exit(1);
    });
}

module.exports = { runComprehensiveStressTest };
