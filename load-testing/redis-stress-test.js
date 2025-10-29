const Redis = require('ioredis');
const { performance } = require('perf_hooks');

class RedisStressTester {
  constructor() {
    this.redis = null;
    this.results = {
      operations: [],
      errors: [],
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0
    };
  }

  async connect() {
    console.log('📡 الاتصال بـ Redis...');
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false
    });

    await this.redis.ping();
    console.log('✅ تم الاتصال بـ Redis');
  }

  async disconnect() {
    if (this.redis) {
      await this.redis.quit();
      console.log('✅ تم قطع الاتصال من Redis');
    }
  }

  async measureOperation(operationName, operationFn) {
    const startTime = performance.now();
    this.results.totalOperations++;

    try {
      const result = await operationFn();
      const endTime = performance.now();
      const duration = endTime - startTime;

      this.results.successfulOperations++;
      this.results.operations.push({
        name: operationName,
        duration,
        success: true,
        timestamp: new Date().toISOString()
      });

      return { success: true, duration, result };
    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;

      this.results.failedOperations++;
      this.results.errors.push({
        operation: operationName,
        error: error.message,
        timestamp: new Date().toISOString()
      });

      this.results.operations.push({
        name: operationName,
        duration,
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });

      return { success: false, duration, error: error.message };
    }
  }

  async testSetOperations(numOperations = 100) {
    console.log(`\n✍️  اختبار SET: ${numOperations} عملية...`);

    const promises = Array(numOperations).fill(0).map((_, i) =>
      this.measureOperation(
        `set_${i}`,
        () => this.redis.set(`test_key_${i}`, `test_value_${i}`)
      )
    );

    await Promise.all(promises);
    console.log(`✅ اختبار SET منتهي`);
  }

  async testGetOperations(numOperations = 100) {
    console.log(`\n📖 اختبار GET: ${numOperations} عملية...`);

    const promises = Array(numOperations).fill(0).map((_, i) =>
      this.measureOperation(
        `get_${i}`,
        () => this.redis.get(`test_key_${i}`)
      )
    );

    await Promise.all(promises);
    console.log(`✅ اختبار GET منتهي`);
  }

  async testHashOperations(numOperations = 50) {
    console.log(`\n📦 اختبار HASH: ${numOperations} عملية...`);

    const setPromises = Array(numOperations).fill(0).map((_, i) =>
      this.measureOperation(
        `hset_${i}`,
        () => this.redis.hset(`test_hash_${i}`, 'field1', 'value1', 'field2', 'value2')
      )
    );
    await Promise.all(setPromises);

    const getPromises = Array(numOperations).fill(0).map((_, i) =>
      this.measureOperation(
        `hgetall_${i}`,
        () => this.redis.hgetall(`test_hash_${i}`)
      )
    );
    await Promise.all(getPromises);

    console.log(`✅ اختبار HASH منتهي`);
  }

  async testListOperations(numOperations = 50) {
    console.log(`\n📝 اختبار LIST: ${numOperations} عملية...`);

    const pushPromises = Array(numOperations).fill(0).map((_, i) =>
      this.measureOperation(
        `lpush_${i}`,
        () => this.redis.lpush(`test_list_${i}`, 'item1', 'item2', 'item3')
      )
    );
    await Promise.all(pushPromises);

    const rangePromises = Array(numOperations).fill(0).map((_, i) =>
      this.measureOperation(
        `lrange_${i}`,
        () => this.redis.lrange(`test_list_${i}`, 0, -1)
      )
    );
    await Promise.all(rangePromises);

    console.log(`✅ اختبار LIST منتهي`);
  }

  async testSetDataStructure(numOperations = 50) {
    console.log(`\n🔢 اختبار SET: ${numOperations} عملية...`);

    const addPromises = Array(numOperations).fill(0).map((_, i) =>
      this.measureOperation(
        `sadd_${i}`,
        () => this.redis.sadd(`test_set_${i}`, 'member1', 'member2', 'member3')
      )
    );
    await Promise.all(addPromises);

    const membersPromises = Array(numOperations).fill(0).map((_, i) =>
      this.measureOperation(
        `smembers_${i}`,
        () => this.redis.smembers(`test_set_${i}`)
      )
    );
    await Promise.all(membersPromises);

    console.log(`✅ اختبار SET منتهي`);
  }

  async testExpireOperations(numOperations = 50) {
    console.log(`\n⏰ اختبار EXPIRE: ${numOperations} عملية...`);

    const promises = Array(numOperations).fill(0).map((_, i) =>
      this.measureOperation(
        `expire_${i}`,
        () => this.redis.expire(`test_key_${i}`, 60)
      )
    );

    await Promise.all(promises);
    console.log(`✅ اختبار EXPIRE منتهي`);
  }

  async testPipeline(numOperations = 100) {
    console.log(`\n🚀 اختبار PIPELINE: ${numOperations} عملية...`);

    await this.measureOperation('pipeline_batch', async () => {
      const pipeline = this.redis.pipeline();
      
      for (let i = 0; i < numOperations; i++) {
        pipeline.set(`pipeline_key_${i}`, `pipeline_value_${i}`);
        pipeline.get(`pipeline_key_${i}`);
      }
      
      return await pipeline.exec();
    });

    console.log(`✅ اختبار PIPELINE منتهي`);
  }

  async testConcurrentOperations(numConcurrent = 100) {
    console.log(`\n🔥 اختبار العمليات المتزامنة: ${numConcurrent} عملية...`);

    const operations = [];
    for (let i = 0; i < numConcurrent; i++) {
      operations.push(
        this.measureOperation(`concurrent_set_${i}`, () => 
          this.redis.set(`concurrent_key_${i}`, `concurrent_value_${i}`)
        ),
        this.measureOperation(`concurrent_get_${i}`, () => 
          this.redis.get(`concurrent_key_${i}`)
        ),
        this.measureOperation(`concurrent_del_${i}`, () => 
          this.redis.del(`concurrent_key_${i}`)
        )
      );
    }

    await Promise.all(operations);
    console.log(`✅ اختبار العمليات المتزامنة منتهي`);
  }

  async cleanupTestData() {
    console.log(`\n🧹 تنظيف بيانات الاختبار...`);

    await this.measureOperation('cleanup', async () => {
      const keys = await this.redis.keys('test_*');
      const pipelineKeys = await this.redis.keys('pipeline_*');
      const concurrentKeys = await this.redis.keys('concurrent_*');
      
      const allKeys = [...keys, ...pipelineKeys, ...concurrentKeys];
      
      if (allKeys.length > 0) {
        await this.redis.del(...allKeys);
      }
      
      return allKeys.length;
    });

    console.log(`✅ تم تنظيف بيانات الاختبار`);
  }

  generateReport() {
    const operations = this.results.operations;
    const durations = operations.map(op => op.duration);
    const sorted = [...durations].sort((a, b) => a - b);

    const sum = durations.reduce((a, b) => a + b, 0);
    const avg = durations.length > 0 ? sum / durations.length : 0;

    const p50 = sorted[Math.floor(sorted.length * 0.5)] || 0;
    const p90 = sorted[Math.floor(sorted.length * 0.9)] || 0;
    const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
    const p99 = sorted[Math.floor(sorted.length * 0.99)] || 0;

    const min = sorted.length > 0 ? sorted[0] : 0;
    const max = sorted.length > 0 ? sorted[sorted.length - 1] : 0;

    const successRate = ((this.results.successfulOperations / this.results.totalOperations) * 100).toFixed(2);

    const operationsByType = {};
    operations.forEach(op => {
      const type = op.name.split('_')[0];
      if (!operationsByType[type]) {
        operationsByType[type] = { count: 0, totalDuration: 0, errors: 0 };
      }
      operationsByType[type].count++;
      operationsByType[type].totalDuration += op.duration;
      if (!op.success) {
        operationsByType[type].errors++;
      }
    });

    Object.keys(operationsByType).forEach(type => {
      const stats = operationsByType[type];
      stats.avgDuration = (stats.totalDuration / stats.count).toFixed(2);
    });

    return {
      summary: {
        totalOperations: this.results.totalOperations,
        successfulOperations: this.results.successfulOperations,
        failedOperations: this.results.failedOperations,
        successRate: successRate + '%'
      },
      performance: {
        min: min.toFixed(2) + 'ms',
        max: max.toFixed(2) + 'ms',
        avg: avg.toFixed(2) + 'ms',
        p50: p50.toFixed(2) + 'ms',
        p90: p90.toFixed(2) + 'ms',
        p95: p95.toFixed(2) + 'ms',
        p99: p99.toFixed(2) + 'ms'
      },
      operationsByType,
      errors: this.results.errors
    };
  }

  printReport(report) {
    console.log('\n' + '='.repeat(80));
    console.log('📊 تقرير اختبار ضغط Redis');
    console.log('='.repeat(80));

    console.log('\n📈 الملخص:');
    console.log(`  إجمالي العمليات: ${report.summary.totalOperations}`);
    console.log(`  العمليات الناجحة: ${report.summary.successfulOperations}`);
    console.log(`  العمليات الفاشلة: ${report.summary.failedOperations}`);
    console.log(`  معدل النجاح: ${report.summary.successRate}`);

    console.log('\n⏱️  الأداء:');
    console.log(`  الحد الأدنى: ${report.performance.min}`);
    console.log(`  المتوسط: ${report.performance.avg}`);
    console.log(`  الحد الأقصى: ${report.performance.max}`);
    console.log(`  P50: ${report.performance.p50}`);
    console.log(`  P90: ${report.performance.p90}`);
    console.log(`  P95: ${report.performance.p95}`);
    console.log(`  P99: ${report.performance.p99}`);

    console.log('\n📊 العمليات حسب النوع:');
    Object.entries(report.operationsByType).forEach(([type, stats]) => {
      console.log(`  ${type}:`);
      console.log(`    العدد: ${stats.count}`);
      console.log(`    متوسط الوقت: ${stats.avgDuration}ms`);
      console.log(`    الأخطاء: ${stats.errors}`);
    });

    if (report.errors.length > 0) {
      console.log('\n❌ الأخطاء:');
      report.errors.slice(0, 10).forEach((error, i) => {
        console.log(`  ${i + 1}. ${error.operation}: ${error.error}`);
      });
    }

    console.log('\n' + '='.repeat(80));
  }
}

async function runRedisStressTest() {
  const tester = new RedisStressTester();

  try {
    await tester.connect();

    await tester.testSetOperations(200);
    await tester.testGetOperations(200);
    await tester.testHashOperations(100);
    await tester.testListOperations(100);
    await tester.testSetDataStructure(100);
    await tester.testExpireOperations(100);
    await tester.testPipeline(200);
    await tester.testConcurrentOperations(150);
    await tester.cleanupTestData();

    const report = tester.generateReport();
    tester.printReport(report);

    const fs = require('fs').promises;
    await fs.writeFile(
      'load-testing/redis-stress-test-report.json',
      JSON.stringify(report, null, 2)
    );
    console.log('\n✅ تم حفظ التقرير في: load-testing/redis-stress-test-report.json');

    await tester.disconnect();

    return report;
  } catch (error) {
    console.error('\n❌ خطأ في اختبار Redis:', error.message);
    await tester.disconnect();
    throw error;
  }
}

if (require.main === module) {
  runRedisStressTest()
    .then(() => {
      console.log('\n✨ اختبار Redis منتهي بنجاح');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 فشل اختبار Redis:', error.message);
      process.exit(1);
    });
}

module.exports = { RedisStressTester, runRedisStressTest };
