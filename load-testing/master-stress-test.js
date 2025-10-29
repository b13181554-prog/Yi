const { runComprehensiveStressTest } = require('./run-stress-test');
const { runDatabaseStressTest } = require('./database-stress-test');
const { runBotUserSimulation } = require('./bot-user-simulator');
const { runRedisStressTest } = require('./redis-stress-test');
const fs = require('fs').promises;

async function runMasterStressTest() {
  console.log('🚀 بدء اختبار الضغط الشامل لجميع المكونات');
  console.log('='.repeat(80));
  console.log('هذا الاختبار سيقوم بفحص:');
  console.log('  ✓ HTTP Server & API Endpoints');
  console.log('  ✓ MongoDB Database');
  console.log('  ✓ Redis Cache');
  console.log('  ✓ محاكاة المستخدمين');
  console.log('='.repeat(80));
  console.log('');

  const masterStartTime = Date.now();
  const results = {
    timestamp: new Date().toISOString(),
    components: {},
    totalDuration: 0,
    overallHealth: 'unknown',
    criticalIssues: [],
    recommendations: []
  };

  try {
    console.log('\n' + '━'.repeat(80));
    console.log('📡 المرحلة 1/4: اختبار HTTP Server & API Endpoints');
    console.log('━'.repeat(80));
    
    const httpTestStart = Date.now();
    try {
      const httpReport = await runComprehensiveStressTest();
      results.components.httpServer = {
        status: 'completed',
        duration: Date.now() - httpTestStart,
        report: httpReport
      };
      console.log('✅ اختبار HTTP Server منتهي');
    } catch (error) {
      results.components.httpServer = {
        status: 'failed',
        duration: Date.now() - httpTestStart,
        error: error.message
      };
      results.criticalIssues.push({
        component: 'HTTP Server',
        severity: 'CRITICAL',
        issue: error.message
      });
      console.error('❌ فشل اختبار HTTP Server:', error.message);
    }

    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('\n' + '━'.repeat(80));
    console.log('💾 المرحلة 2/4: اختبار MongoDB Database');
    console.log('━'.repeat(80));
    
    const dbTestStart = Date.now();
    try {
      const dbReport = await runDatabaseStressTest();
      results.components.database = {
        status: 'completed',
        duration: Date.now() - dbTestStart,
        report: dbReport
      };
      console.log('✅ اختبار MongoDB منتهي');
    } catch (error) {
      results.components.database = {
        status: 'failed',
        duration: Date.now() - dbTestStart,
        error: error.message
      };
      results.criticalIssues.push({
        component: 'MongoDB',
        severity: 'CRITICAL',
        issue: error.message
      });
      console.error('❌ فشل اختبار MongoDB:', error.message);
    }

    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('\n' + '━'.repeat(80));
    console.log('🔴 المرحلة 3/4: اختبار Redis Cache');
    console.log('━'.repeat(80));
    
    const redisTestStart = Date.now();
    try {
      const redisReport = await runRedisStressTest();
      results.components.redis = {
        status: 'completed',
        duration: Date.now() - redisTestStart,
        report: redisReport
      };
      console.log('✅ اختبار Redis منتهي');
    } catch (error) {
      results.components.redis = {
        status: 'failed',
        duration: Date.now() - redisTestStart,
        error: error.message
      };
      results.criticalIssues.push({
        component: 'Redis',
        severity: 'HIGH',
        issue: error.message
      });
      console.error('❌ فشل اختبار Redis:', error.message);
    }

    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('\n' + '━'.repeat(80));
    console.log('👥 المرحلة 4/4: محاكاة المستخدمين');
    console.log('━'.repeat(80));
    
    const userSimStart = Date.now();
    try {
      const userReport = await runBotUserSimulation();
      results.components.userSimulation = {
        status: 'completed',
        duration: Date.now() - userSimStart,
        report: userReport
      };
      console.log('✅ محاكاة المستخدمين منتهية');
    } catch (error) {
      results.components.userSimulation = {
        status: 'failed',
        duration: Date.now() - userSimStart,
        error: error.message
      };
      console.error('⚠️  فشلت محاكاة المستخدمين:', error.message);
    }

    results.totalDuration = Date.now() - masterStartTime;

    analyzeResults(results);
    
    printMasterReport(results);

    await fs.writeFile(
      'load-testing/master-stress-test-report.json',
      JSON.stringify(results, null, 2)
    );
    console.log('\n✅ تم حفظ التقرير الرئيسي في: load-testing/master-stress-test-report.json');

    await generateExecutiveSummary(results);

    return results;

  } catch (error) {
    console.error('\n❌ خطأ عام في اختبار الضغط الرئيسي:', error.message);
    results.totalDuration = Date.now() - masterStartTime;
    results.overallHealth = 'critical_failure';
    
    await fs.writeFile(
      'load-testing/master-stress-test-report-error.json',
      JSON.stringify(results, null, 2)
    );
    
    throw error;
  }
}

function analyzeResults(results) {
  let healthScore = 100;
  const issues = [];

  Object.entries(results.components).forEach(([component, data]) => {
    if (data.status === 'failed') {
      healthScore -= 25;
      issues.push(`${component} فشل بشكل كامل`);
    } else if (data.report) {
      if (data.report.summary || data.report.requestStats) {
        const summary = data.report.summary || data.report.requestStats;
        const successRate = parseFloat(summary.successRate);
        
        if (successRate < 80) {
          healthScore -= 15;
          issues.push(`${component} لديه معدل نجاح منخفض: ${summary.successRate}`);
        } else if (successRate < 95) {
          healthScore -= 5;
          issues.push(`${component} لديه معدل نجاح متوسط: ${summary.successRate}`);
        }
      }

      if (data.report.performance) {
        const avgTime = parseFloat(data.report.performance.avg);
        if (avgTime > 1000) {
          healthScore -= 10;
          issues.push(`${component} بطيء: متوسط ${data.report.performance.avg}`);
        }
      }

      if (data.report.responseTimes) {
        const avgTime = parseFloat(data.report.responseTimes.avg);
        if (avgTime > 1000) {
          healthScore -= 10;
          issues.push(`${component} بطيء: متوسط ${data.report.responseTimes.avg}`);
        }
      }
    }
  });

  if (healthScore >= 90) {
    results.overallHealth = 'excellent';
  } else if (healthScore >= 70) {
    results.overallHealth = 'good';
  } else if (healthScore >= 50) {
    results.overallHealth = 'fair';
  } else if (healthScore >= 30) {
    results.overallHealth = 'poor';
  } else {
    results.overallHealth = 'critical';
  }

  results.healthScore = healthScore;
  results.issues = issues;

  generateRecommendations(results);
}

function generateRecommendations(results) {
  const recommendations = [];

  if (results.components.httpServer?.report?.recommendations) {
    recommendations.push(...results.components.httpServer.report.recommendations);
  }

  if (results.healthScore < 70) {
    recommendations.push({
      priority: 'HIGH',
      category: 'System Health',
      issue: `الصحة العامة للنظام منخفضة: ${results.healthScore}/100`,
      recommendation: 'مراجعة جميع المكونات وحل المشاكل الحرجة'
    });
  }

  if (results.components.httpServer?.status === 'failed') {
    recommendations.push({
      priority: 'CRITICAL',
      category: 'HTTP Server',
      issue: 'خادم HTTP لا يستجيب',
      recommendation: 'التحقق من تشغيل الخادم وحل أي أخطاء في الكود'
    });
  }

  if (results.components.database?.status === 'failed') {
    recommendations.push({
      priority: 'CRITICAL',
      category: 'Database',
      issue: 'قاعدة البيانات غير متاحة',
      recommendation: 'التحقق من اتصال MongoDB وصلاحيات الوصول'
    });
  }

  if (results.components.redis?.status === 'failed') {
    recommendations.push({
      priority: 'HIGH',
      category: 'Cache',
      issue: 'Redis غير متاح',
      recommendation: 'التحقق من تشغيل Redis Server'
    });
  }

  const successfulComponents = Object.values(results.components)
    .filter(c => c.status === 'completed').length;
  const totalComponents = Object.keys(results.components).length;

  if (successfulComponents === totalComponents && results.healthScore >= 90) {
    recommendations.push({
      priority: 'INFO',
      category: 'System Status',
      issue: 'جميع الأنظمة تعمل بشكل ممتاز',
      recommendation: 'النظام جاهز للإنتاج. استمر في المراقبة الدورية.'
    });
  }

  results.recommendations = recommendations;
}

function printMasterReport(results) {
  console.log('\n\n');
  console.log('═'.repeat(80));
  console.log('📊 التقرير النهائي الشامل لاختبار الضغط');
  console.log('═'.repeat(80));

  const healthEmoji = {
    'excellent': '🟢',
    'good': '🟡',
    'fair': '🟠',
    'poor': '🔴',
    'critical': '💀',
    'critical_failure': '💥'
  };

  console.log(`\n${healthEmoji[results.overallHealth]} الحالة العامة: ${results.overallHealth.toUpperCase()}`);
  console.log(`📈 درجة الصحة: ${results.healthScore}/100`);
  console.log(`⏱️  المدة الكلية: ${(results.totalDuration / 1000).toFixed(2)} ثانية`);

  console.log('\n📦 حالة المكونات:');
  Object.entries(results.components).forEach(([component, data]) => {
    const statusEmoji = data.status === 'completed' ? '✅' : '❌';
    console.log(`  ${statusEmoji} ${component}: ${data.status} (${(data.duration / 1000).toFixed(2)}s)`);
    
    if (data.report) {
      const summary = data.report.summary || data.report.requestStats;
      if (summary) {
        console.log(`      معدل النجاح: ${summary.successRate}`);
      }
    }
  });

  if (results.criticalIssues.length > 0) {
    console.log('\n🚨 المشاكل الحرجة:');
    results.criticalIssues.forEach((issue, i) => {
      console.log(`  ${i + 1}. [${issue.severity}] ${issue.component}: ${issue.issue}`);
    });
  }

  if (results.issues.length > 0) {
    console.log('\n⚠️  المشاكل المكتشفة:');
    results.issues.forEach((issue, i) => {
      console.log(`  ${i + 1}. ${issue}`);
    });
  }

  console.log('\n💡 التوصيات الرئيسية:');
  const topRecommendations = results.recommendations.slice(0, 5);
  topRecommendations.forEach((rec, i) => {
    const priorityEmoji = {
      'CRITICAL': '🔴',
      'HIGH': '🟠',
      'MEDIUM': '🟡',
      'INFO': '🟢'
    };
    console.log(`${i + 1}. ${priorityEmoji[rec.priority]} [${rec.priority}] ${rec.category}`);
    console.log(`   ${rec.recommendation}`);
  });

  console.log('\n═'.repeat(80));
  console.log('✅ اختبار الضغط الشامل منتهي');
  console.log('═'.repeat(80));
}

async function generateExecutiveSummary(results) {
  const summary = {
    reportDate: results.timestamp,
    overallHealth: results.overallHealth,
    healthScore: results.healthScore,
    totalTestDuration: `${(results.totalDuration / 1000).toFixed(2)}s`,
    componentsStatus: {},
    keyFindings: [],
    topRecommendations: results.recommendations.slice(0, 5),
    criticalIssues: results.criticalIssues
  };

  Object.entries(results.components).forEach(([component, data]) => {
    summary.componentsStatus[component] = {
      status: data.status,
      duration: `${(data.duration / 1000).toFixed(2)}s`
    };

    if (data.report) {
      const reportSummary = data.report.summary || data.report.requestStats;
      if (reportSummary) {
        summary.componentsStatus[component].successRate = reportSummary.successRate;
      }
    }
  });

  if (results.components.httpServer?.report) {
    const httpReport = results.components.httpServer.report;
    summary.keyFindings.push({
      component: 'HTTP Server',
      metric: 'Requests/Second',
      value: httpReport.requestStats?.requestsPerSecond || 'N/A'
    });
    summary.keyFindings.push({
      component: 'HTTP Server',
      metric: 'Average Response Time',
      value: httpReport.requestStats?.responseTimes?.avg || 'N/A'
    });
  }

  if (results.components.database?.report) {
    const dbReport = results.components.database.report;
    summary.keyFindings.push({
      component: 'MongoDB',
      metric: 'Average Query Time',
      value: dbReport.performance?.avg || 'N/A'
    });
  }

  if (results.components.redis?.report) {
    const redisReport = results.components.redis.report;
    summary.keyFindings.push({
      component: 'Redis',
      metric: 'Average Operation Time',
      value: redisReport.performance?.avg || 'N/A'
    });
  }

  await fs.writeFile(
    'load-testing/EXECUTIVE-SUMMARY.json',
    JSON.stringify(summary, null, 2)
  );

  const readmeContent = `# 📊 ملخص تنفيذي - اختبار الضغط

## تاريخ التقرير: ${new Date(results.timestamp).toLocaleString('ar-EG')}

## 🎯 الحالة العامة: ${results.overallHealth.toUpperCase()}
**درجة الصحة:** ${results.healthScore}/100

## ⏱️ مدة الاختبار: ${summary.totalTestDuration}

## 📦 حالة المكونات

${Object.entries(summary.componentsStatus).map(([component, status]) => `
### ${component}
- **الحالة:** ${status.status === 'completed' ? '✅ نجح' : '❌ فشل'}
- **المدة:** ${status.duration}
${status.successRate ? `- **معدل النجاح:** ${status.successRate}` : ''}
`).join('\n')}

## 🔍 النتائج الرئيسية

${summary.keyFindings.map(finding => `
- **${finding.component}** - ${finding.metric}: ${finding.value}
`).join('\n')}

${summary.criticalIssues.length > 0 ? `
## 🚨 المشاكل الحرجة

${summary.criticalIssues.map((issue, i) => `
${i + 1}. **[${issue.severity}] ${issue.component}**
   ${issue.issue}
`).join('\n')}
` : ''}

## 💡 التوصيات الرئيسية

${summary.topRecommendations.map((rec, i) => `
${i + 1}. **[${rec.priority}] ${rec.category}**
   ${rec.recommendation}
`).join('\n')}

## 📁 التقارير التفصيلية

- [التقرير الرئيسي الكامل](master-stress-test-report.json)
- [تقرير HTTP Server](stress-test-report.json)
- [تقرير قاعدة البيانات](database-stress-test-report.json)
- [تقرير Redis](redis-stress-test-report.json)
- [تقرير محاكاة المستخدمين](bot-user-simulation-report.json)
`;

  await fs.writeFile('load-testing/EXECUTIVE-SUMMARY.md', readmeContent);
  console.log('\n✅ تم حفظ الملخص التنفيذي في: load-testing/EXECUTIVE-SUMMARY.md');
}

if (require.main === module) {
  runMasterStressTest()
    .then((results) => {
      console.log('\n\n🎉 اكتمل اختبار الضغط الشامل بنجاح!');
      console.log(`📊 الحالة النهائية: ${results.overallHealth}`);
      console.log(`📈 درجة الصحة: ${results.healthScore}/100`);
      
      process.exit(results.healthScore >= 50 ? 0 : 1);
    })
    .catch((error) => {
      console.error('\n💥 فشل اختبار الضغط الشامل:', error.message);
      process.exit(1);
    });
}

module.exports = { runMasterStressTest };
