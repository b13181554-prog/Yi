const axios = require('axios');
const { performance } = require('perf_hooks');
const os = require('os');

class LoadTester {
  constructor(baseURL = 'http://localhost:5000') {
    this.baseURL = baseURL;
    this.results = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      errors: [],
      responseTimes: [],
      statusCodes: {},
      memoryUsage: [],
      cpuUsage: [],
      startTime: null,
      endTime: null
    };
    this.testUsers = [];
  }

  async measureSystemResources() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    
    return {
      timestamp: new Date().toISOString(),
      memory: {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024),
        rss: Math.round(memUsage.rss / 1024 / 1024),
        systemTotal: Math.round(totalMem / 1024 / 1024),
        systemFree: Math.round(freeMem / 1024 / 1024),
        systemUsedPercent: Math.round(((totalMem - freeMem) / totalMem) * 100)
      },
      cpu: {
        user: Math.round(cpuUsage.user / 1000),
        system: Math.round(cpuUsage.system / 1000)
      }
    };
  }

  async makeRequest(method, endpoint, data = null, headers = {}) {
    const startTime = performance.now();
    this.results.totalRequests++;

    try {
      const config = {
        method,
        url: `${this.baseURL}${endpoint}`,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        timeout: 30000
      };

      if (data) {
        config.data = data;
      }

      const response = await axios(config);
      const endTime = performance.now();
      const responseTime = endTime - startTime;

      this.results.successfulRequests++;
      this.results.responseTimes.push(responseTime);
      
      const statusCode = response.status;
      this.results.statusCodes[statusCode] = (this.results.statusCodes[statusCode] || 0) + 1;

      return {
        success: true,
        responseTime,
        statusCode,
        data: response.data
      };
    } catch (error) {
      const endTime = performance.now();
      const responseTime = endTime - startTime;

      this.results.failedRequests++;
      this.results.responseTimes.push(responseTime);

      const errorInfo = {
        endpoint,
        message: error.message,
        code: error.code,
        status: error.response?.status,
        timestamp: new Date().toISOString()
      };

      this.results.errors.push(errorInfo);

      if (error.response?.status) {
        this.results.statusCodes[error.response.status] = 
          (this.results.statusCodes[error.response.status] || 0) + 1;
      }

      return {
        success: false,
        responseTime,
        error: errorInfo
      };
    }
  }

  async testHealthEndpoint(iterations = 10) {
    console.log(`\n🏥 اختبار Health Endpoint (${iterations} طلب)...`);
    const results = [];

    for (let i = 0; i < iterations; i++) {
      const result = await this.makeRequest('GET', '/api/health');
      results.push(result);
      
      if (i % 10 === 0 && i > 0) {
        console.log(`  ✓ تم: ${i}/${iterations}`);
      }
    }

    return results;
  }

  async testUserDataEndpoint(userIds, iterations = 5) {
    console.log(`\n👤 اختبار User Data Endpoint (${userIds.length} مستخدم × ${iterations} مرة)...`);
    const results = [];

    for (let i = 0; i < iterations; i++) {
      const promises = userIds.map(userId => 
        this.makeRequest('POST', '/api/user', { user_id: userId })
      );
      const batchResults = await Promise.all(promises);
      results.push(...batchResults);
      
      console.log(`  ✓ دفعة ${i + 1}/${iterations} منتهية`);
    }

    return results;
  }

  async testPriceEndpoint(symbols, iterations = 5) {
    console.log(`\n💰 اختبار Price Endpoint (${symbols.length} رمز × ${iterations} مرة)...`);
    const results = [];

    for (let i = 0; i < iterations; i++) {
      const promises = symbols.map(symbol => 
        this.makeRequest('POST', '/api/price', { symbol, market: 'crypto' })
      );
      const batchResults = await Promise.all(promises);
      results.push(...batchResults);
      
      console.log(`  ✓ دفعة ${i + 1}/${iterations} منتهية`);
    }

    return results;
  }

  async testAnalysisEndpoint(testCases, concurrentRequests = 5) {
    console.log(`\n📊 اختبار Analysis Endpoint (${testCases.length} حالة، ${concurrentRequests} متزامن)...`);
    const results = [];

    for (let i = 0; i < testCases.length; i += concurrentRequests) {
      const batch = testCases.slice(i, i + concurrentRequests);
      const promises = batch.map(testCase => 
        this.makeRequest('POST', '/api/analyze', testCase)
      );
      const batchResults = await Promise.all(promises);
      results.push(...batchResults);
      
      console.log(`  ✓ تم: ${Math.min(i + concurrentRequests, testCases.length)}/${testCases.length}`);
    }

    return results;
  }

  async testSearchEndpoint(queries, iterations = 3) {
    console.log(`\n🔍 اختبار Search Endpoint (${queries.length} استعلام × ${iterations} مرة)...`);
    const results = [];

    for (let i = 0; i < iterations; i++) {
      const promises = queries.map(query => 
        this.makeRequest('POST', '/api/search-assets', { query })
      );
      const batchResults = await Promise.all(promises);
      results.push(...batchResults);
      
      console.log(`  ✓ دفعة ${i + 1}/${iterations} منتهية`);
    }

    return results;
  }

  async stressTestConcurrent(endpoint, requestData, concurrentUsers = 50, duration = 10000) {
    console.log(`\n🔥 اختبار الضغط المتزامن: ${concurrentUsers} مستخدم لمدة ${duration}ms...`);
    const startTime = Date.now();
    let activeRequests = 0;
    const maxActiveRequests = concurrentUsers;

    const makeRequestLoop = async (userId) => {
      while (Date.now() - startTime < duration) {
        if (activeRequests < maxActiveRequests) {
          activeRequests++;
          await this.makeRequest('POST', endpoint, { ...requestData, userId });
          activeRequests--;
        } else {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }
    };

    const userPromises = Array(concurrentUsers)
      .fill(0)
      .map((_, i) => makeRequestLoop(i));

    await Promise.all(userPromises);
    
    console.log(`  ✓ اختبار الضغط المتزامن منتهي`);
  }

  async rampUpTest(endpoint, requestData, maxUsers = 100, rampUpTime = 30000) {
    console.log(`\n📈 اختبار التدرج: من 0 إلى ${maxUsers} مستخدم خلال ${rampUpTime}ms...`);
    const startTime = Date.now();
    const userInterval = rampUpTime / maxUsers;
    const activeUsers = [];

    const makeRequestLoop = async (userId) => {
      while (Date.now() - startTime < rampUpTime + 10000) {
        await this.makeRequest('POST', endpoint, { ...requestData, userId });
        await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 400));
      }
    };

    const rampUpInterval = setInterval(() => {
      const currentTime = Date.now() - startTime;
      if (currentTime > rampUpTime) {
        clearInterval(rampUpInterval);
        return;
      }

      const userId = activeUsers.length;
      activeUsers.push(makeRequestLoop(userId));
      
      if (userId % 10 === 0) {
        console.log(`  ✓ مستخدمون نشطون: ${userId + 1}/${maxUsers}`);
      }
    }, userInterval);

    await new Promise(resolve => setTimeout(resolve, rampUpTime + 10000));
    
    console.log(`  ✓ اختبار التدرج منتهي`);
  }

  calculateStats() {
    const responseTimes = this.results.responseTimes;
    const sorted = [...responseTimes].sort((a, b) => a - b);

    const sum = responseTimes.reduce((a, b) => a + b, 0);
    const avg = responseTimes.length > 0 ? sum / responseTimes.length : 0;

    const p50 = sorted[Math.floor(sorted.length * 0.5)] || 0;
    const p90 = sorted[Math.floor(sorted.length * 0.9)] || 0;
    const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
    const p99 = sorted[Math.floor(sorted.length * 0.99)] || 0;

    const min = sorted.length > 0 ? sorted[0] : 0;
    const max = sorted.length > 0 ? sorted[sorted.length - 1] : 0;

    const duration = this.results.endTime - this.results.startTime;
    const requestsPerSecond = (this.results.totalRequests / (duration / 1000)).toFixed(2);

    return {
      totalRequests: this.results.totalRequests,
      successfulRequests: this.results.successfulRequests,
      failedRequests: this.results.failedRequests,
      successRate: ((this.results.successfulRequests / this.results.totalRequests) * 100).toFixed(2) + '%',
      responseTimes: {
        min: min.toFixed(2) + 'ms',
        max: max.toFixed(2) + 'ms',
        avg: avg.toFixed(2) + 'ms',
        p50: p50.toFixed(2) + 'ms',
        p90: p90.toFixed(2) + 'ms',
        p95: p95.toFixed(2) + 'ms',
        p99: p99.toFixed(2) + 'ms'
      },
      duration: (duration / 1000).toFixed(2) + 's',
      requestsPerSecond,
      statusCodes: this.results.statusCodes,
      errorTypes: this.categorizeErrors()
    };
  }

  categorizeErrors() {
    const errorCategories = {
      timeout: 0,
      networkError: 0,
      serverError: 0,
      clientError: 0,
      other: 0
    };

    this.results.errors.forEach(error => {
      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        errorCategories.timeout++;
      } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        errorCategories.networkError++;
      } else if (error.status >= 500) {
        errorCategories.serverError++;
      } else if (error.status >= 400 && error.status < 500) {
        errorCategories.clientError++;
      } else {
        errorCategories.other++;
      }
    });

    return errorCategories;
  }

  async generateReport() {
    const stats = this.calculateStats();
    const systemResources = await this.measureSystemResources();

    const report = {
      testSummary: {
        testDate: new Date().toISOString(),
        duration: stats.duration,
        baseURL: this.baseURL
      },
      requestStats: stats,
      systemResources,
      topErrors: this.results.errors.slice(0, 10),
      recommendations: this.generateRecommendations(stats)
    };

    return report;
  }

  generateRecommendations(stats) {
    const recommendations = [];

    const successRate = parseFloat(stats.successRate);
    if (successRate < 95) {
      recommendations.push({
        priority: 'HIGH',
        category: 'Reliability',
        issue: `معدل النجاح منخفض: ${stats.successRate}`,
        recommendation: 'فحص أسباب الأخطاء وتحسين معالجة الاستثناءات'
      });
    }

    const avgResponseTime = parseFloat(stats.responseTimes.avg);
    if (avgResponseTime > 1000) {
      recommendations.push({
        priority: 'HIGH',
        category: 'Performance',
        issue: `متوسط وقت الاستجابة بطيء: ${stats.responseTimes.avg}`,
        recommendation: 'تحسين الاستعلامات، إضافة التخزين المؤقت، أو زيادة الموارد'
      });
    }

    const p95ResponseTime = parseFloat(stats.responseTimes.p95);
    if (p95ResponseTime > 3000) {
      recommendations.push({
        priority: 'MEDIUM',
        category: 'Performance',
        issue: `P95 وقت الاستجابة مرتفع: ${stats.responseTimes.p95}`,
        recommendation: 'بعض الطلبات تأخذ وقت طويل - فحص العمليات البطيئة'
      });
    }

    if (stats.errorTypes.timeout > 0) {
      recommendations.push({
        priority: 'HIGH',
        category: 'Timeout',
        issue: `عدد أخطاء Timeout: ${stats.errorTypes.timeout}`,
        recommendation: 'زيادة مهلة الطلبات أو تحسين أداء العمليات الطويلة'
      });
    }

    if (stats.errorTypes.serverError > 0) {
      recommendations.push({
        priority: 'CRITICAL',
        category: 'Server Errors',
        issue: `عدد أخطاء الخادم (5xx): ${stats.errorTypes.serverError}`,
        recommendation: 'فحص logs الخادم وإصلاح الأخطاء البرمجية'
      });
    }

    const rps = parseFloat(stats.requestsPerSecond);
    if (rps < 10) {
      recommendations.push({
        priority: 'MEDIUM',
        category: 'Throughput',
        issue: `معدل الطلبات منخفض: ${stats.requestsPerSecond} req/s`,
        recommendation: 'تحسين قدرة الخادم على معالجة الطلبات المتزامنة'
      });
    }

    if (recommendations.length === 0) {
      recommendations.push({
        priority: 'INFO',
        category: 'System Health',
        issue: 'لا توجد مشاكل كبيرة',
        recommendation: 'النظام يعمل بشكل جيد في الظروف الحالية'
      });
    }

    return recommendations;
  }

  printReport(report) {
    console.log('\n' + '='.repeat(80));
    console.log('📊 تقرير اختبار الضغط الشامل');
    console.log('='.repeat(80));

    console.log('\n📅 ملخص الاختبار:');
    console.log(`  تاريخ الاختبار: ${report.testSummary.testDate}`);
    console.log(`  المدة الكلية: ${report.testSummary.duration}`);
    console.log(`  عنوان URL: ${report.testSummary.baseURL}`);

    console.log('\n📈 إحصائيات الطلبات:');
    console.log(`  إجمالي الطلبات: ${report.requestStats.totalRequests}`);
    console.log(`  الطلبات الناجحة: ${report.requestStats.successfulRequests}`);
    console.log(`  الطلبات الفاشلة: ${report.requestStats.failedRequests}`);
    console.log(`  معدل النجاح: ${report.requestStats.successRate}`);
    console.log(`  الطلبات في الثانية: ${report.requestStats.requestsPerSecond} req/s`);

    console.log('\n⏱️  أوقات الاستجابة:');
    console.log(`  الحد الأدنى: ${report.requestStats.responseTimes.min}`);
    console.log(`  المتوسط: ${report.requestStats.responseTimes.avg}`);
    console.log(`  الحد الأقصى: ${report.requestStats.responseTimes.max}`);
    console.log(`  P50 (Median): ${report.requestStats.responseTimes.p50}`);
    console.log(`  P90: ${report.requestStats.responseTimes.p90}`);
    console.log(`  P95: ${report.requestStats.responseTimes.p95}`);
    console.log(`  P99: ${report.requestStats.responseTimes.p99}`);

    console.log('\n📊 أكواد الحالة:');
    Object.entries(report.requestStats.statusCodes).forEach(([code, count]) => {
      console.log(`  ${code}: ${count} طلب`);
    });

    console.log('\n❌ أنواع الأخطاء:');
    Object.entries(report.requestStats.errorTypes).forEach(([type, count]) => {
      if (count > 0) {
        console.log(`  ${type}: ${count}`);
      }
    });

    console.log('\n💾 استهلاك الموارد (حالي):');
    console.log(`  الذاكرة المستخدمة: ${report.systemResources.memory.heapUsed}MB / ${report.systemResources.memory.heapTotal}MB`);
    console.log(`  RSS: ${report.systemResources.memory.rss}MB`);
    console.log(`  استخدام النظام: ${report.systemResources.memory.systemUsedPercent}%`);
    console.log(`  الذاكرة الحرة: ${report.systemResources.memory.systemFree}MB`);

    console.log('\n💡 التوصيات:');
    report.recommendations.forEach((rec, i) => {
      const priorityEmoji = {
        'CRITICAL': '🔴',
        'HIGH': '🟠',
        'MEDIUM': '🟡',
        'INFO': '🟢'
      };
      console.log(`${i + 1}. ${priorityEmoji[rec.priority]} [${rec.priority}] ${rec.category}`);
      console.log(`   المشكلة: ${rec.issue}`);
      console.log(`   التوصية: ${rec.recommendation}`);
    });

    if (report.topErrors.length > 0) {
      console.log('\n⚠️  أهم الأخطاء:');
      report.topErrors.slice(0, 5).forEach((error, i) => {
        console.log(`${i + 1}. ${error.endpoint} - ${error.message} (${error.timestamp})`);
      });
    }

    console.log('\n' + '='.repeat(80));
  }

  async saveReport(report, filename = 'load-test-report.json') {
    const fs = require('fs').promises;
    await fs.writeFile(filename, JSON.stringify(report, null, 2));
    console.log(`\n✅ تم حفظ التقرير في: ${filename}`);
  }
}

module.exports = LoadTester;
