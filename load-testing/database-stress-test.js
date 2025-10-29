const { MongoClient } = require('mongodb');
const { performance } = require('perf_hooks');

class DatabaseStressTester {
  constructor(connectionString) {
    this.connectionString = connectionString;
    this.client = null;
    this.db = null;
    this.results = {
      operations: [],
      errors: [],
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0
    };
  }

  async connect() {
    console.log('📡 الاتصال بقاعدة البيانات...');
    this.client = await MongoClient.connect(this.connectionString, {
      maxPoolSize: 100,
      minPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000
    });
    this.db = this.client.db();
    console.log('✅ تم الاتصال بقاعدة البيانات');
  }

  async disconnect() {
    if (this.client) {
      await this.client.close();
      console.log('✅ تم قطع الاتصال بقاعدة البيانات');
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

  async testConcurrentReads(collectionName, numReads = 100) {
    console.log(`\n📖 اختبار القراءة المتزامنة: ${numReads} عملية...`);
    const collection = this.db.collection(collectionName);

    const readPromises = Array(numReads).fill(0).map((_, i) => 
      this.measureOperation(
        `concurrent_read_${i}`,
        () => collection.findOne({ _id: { $exists: true } })
      )
    );

    await Promise.all(readPromises);
    console.log(`✅ اختبار القراءة المتزامنة منتهي`);
  }

  async testConcurrentWrites(collectionName, numWrites = 50) {
    console.log(`\n✍️  اختبار الكتابة المتزامنة: ${numWrites} عملية...`);
    const collection = this.db.collection(collectionName);

    const writePromises = Array(numWrites).fill(0).map((_, i) => 
      this.measureOperation(
        `concurrent_write_${i}`,
        () => collection.insertOne({
          test_data: true,
          index: i,
          timestamp: new Date(),
          random_value: Math.random()
        })
      )
    );

    await Promise.all(writePromises);
    console.log(`✅ اختبار الكتابة المتزامنة منتهي`);
  }

  async testConcurrentUpdates(collectionName, numUpdates = 50) {
    console.log(`\n🔄 اختبار التحديث المتزامن: ${numUpdates} عملية...`);
    const collection = this.db.collection(collectionName);

    const updatePromises = Array(numUpdates).fill(0).map((_, i) => 
      this.measureOperation(
        `concurrent_update_${i}`,
        () => collection.updateOne(
          { test_data: true },
          { $set: { updated_at: new Date(), update_index: i } }
        )
      )
    );

    await Promise.all(updatePromises);
    console.log(`✅ اختبار التحديث المتزامن منتهي`);
  }

  async testComplexAggregation(collectionName, numQueries = 20) {
    console.log(`\n🔍 اختبار Aggregation المعقدة: ${numQueries} استعلام...`);
    const collection = this.db.collection(collectionName);

    const aggregationPromises = Array(numQueries).fill(0).map((_, i) => 
      this.measureOperation(
        `aggregation_${i}`,
        () => collection.aggregate([
          { $match: { test_data: true } },
          { $group: { _id: '$index', count: { $sum: 1 }, avgValue: { $avg: '$random_value' } } },
          { $sort: { count: -1 } },
          { $limit: 10 }
        ]).toArray()
      )
    );

    await Promise.all(aggregationPromises);
    console.log(`✅ اختبار Aggregation المعقدة منتهي`);
  }

  async testIndexPerformance(collectionName) {
    console.log(`\n📇 اختبار أداء الفهارس...`);
    const collection = this.db.collection(collectionName);

    console.log('  - إنشاء فهرس على timestamp...');
    await this.measureOperation(
      'create_index_timestamp',
      () => collection.createIndex({ timestamp: 1 })
    );

    console.log('  - إنشاء فهرس مركب...');
    await this.measureOperation(
      'create_compound_index',
      () => collection.createIndex({ test_data: 1, index: -1 })
    );

    console.log('  - اختبار استعلام مع الفهرس...');
    const promises = Array(50).fill(0).map((_, i) =>
      this.measureOperation(
        `indexed_query_${i}`,
        () => collection.findOne({ test_data: true, index: { $gte: 0 } })
      )
    );
    await Promise.all(promises);

    console.log(`✅ اختبار أداء الفهارس منتهي`);
  }

  async cleanupTestData(collectionName) {
    console.log(`\n🧹 تنظيف بيانات الاختبار...`);
    const collection = this.db.collection(collectionName);
    
    await this.measureOperation(
      'cleanup_test_data',
      () => collection.deleteMany({ test_data: true })
    );
    
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
    console.log('📊 تقرير اختبار ضغط قاعدة البيانات');
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

async function runDatabaseStressTest() {
  const mongoUri = process.env.MONGODB_URI;
  
  if (!mongoUri) {
    console.error('❌ MONGODB_URI غير موجود في متغيرات البيئة');
    process.exit(1);
  }

  const tester = new DatabaseStressTester(mongoUri);

  try {
    await tester.connect();

    const testCollection = 'stress_test_temp';

    await tester.testConcurrentReads('users', 100);
    await tester.testConcurrentWrites(testCollection, 50);
    await tester.testConcurrentUpdates(testCollection, 50);
    await tester.testComplexAggregation(testCollection, 20);
    await tester.testIndexPerformance(testCollection);
    await tester.cleanupTestData(testCollection);

    const report = tester.generateReport();
    tester.printReport(report);

    const fs = require('fs').promises;
    await fs.writeFile(
      'load-testing/database-stress-test-report.json',
      JSON.stringify(report, null, 2)
    );
    console.log('\n✅ تم حفظ التقرير في: load-testing/database-stress-test-report.json');

    await tester.disconnect();

    return report;
  } catch (error) {
    console.error('\n❌ خطأ في اختبار قاعدة البيانات:', error.message);
    await tester.disconnect();
    throw error;
  }
}

if (require.main === module) {
  runDatabaseStressTest()
    .then(() => {
      console.log('\n✨ اختبار قاعدة البيانات منتهي بنجاح');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 فشل اختبار قاعدة البيانات:', error.message);
      process.exit(1);
    });
}

module.exports = { DatabaseStressTester, runDatabaseStressTest };
