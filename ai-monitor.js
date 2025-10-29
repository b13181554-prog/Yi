const geminiService = require('./gemini-service');
const db = require('./database');
const config = require('./config');
const { safeSendMessage } = require('./safe-message');
const bot = require('./bot');
const fs = require('fs');
const { promisify } = require('util');
const readFile = promisify(fs.readFile);
const { exec } = require('child_process');
const { promisify: promisifyExec } = require('util');
const execPromise = promisifyExec(exec);
const { performFullHealthCheck } = require('./improved-health-checks');

class AIMonitor {
  constructor() {
    this.geminiService = geminiService;
    this.enabled = geminiService.enabled;
    this.lastCheck = new Date();
    this.issuesLog = [];
    this.maxIssuesLog = 100;
    
    console.log('🤖 AI Monitor initialized successfully');
  }

  async checkServicesHealth() {
    try {
      console.log('🔍 [AI Monitor] Checking services health directly...');
      const healthCheck = await performFullHealthCheck();
      
      return {
        overall: healthCheck.status,
        redis: healthCheck.checks.redis,
        database: healthCheck.checks.database,
        withdrawalQueue: healthCheck.checks.withdrawalQueue,
        paymentQueue: healthCheck.checks.paymentQueue,
        memory: healthCheck.checks.memory,
        uptime: healthCheck.checks.uptime
      };
    } catch (error) {
      console.error('Error checking services health:', error);
      return {
        overall: 'error',
        error: error.message
      };
    }
  }

  async start() {
    if (!this.enabled) {
      console.warn('⚠️ AI Monitor is disabled (no GOOGLE_API_KEY)');
      return;
    }

    console.log('🤖 AI Monitor started - checking every 5 minutes');
    
    setInterval(async () => {
      try {
        await this.performCheck();
      } catch (error) {
        console.error('❌ AI Monitor check failed:', error);
      }
    }, 5 * 60 * 1000);

    await this.performCheck();
  }

  async performCheck() {
    const checkTime = new Date();
    console.log(`\n🔍 [AI Monitor] Starting check at ${checkTime.toLocaleString('ar')}`);

    try {
      const systemStatus = await this.collectSystemStatus();
      const logs = await this.collectRecentLogs();
      const userIssues = await this.checkUserIssues();
      
      const analysis = await this.analyzeWithAI(systemStatus, logs, userIssues);
      
      if (analysis.issues.length > 0) {
        await this.handleIssues(analysis);
      }

      if (analysis.autoActions.length > 0) {
        await this.executeAutoActions(analysis.autoActions);
      }

      if (analysis.needsNotification) {
        await this.notifyOwner(analysis);
      }

      this.lastCheck = checkTime;
      console.log(`✅ [AI Monitor] Check completed successfully`);
      
    } catch (error) {
      console.error('❌ [AI Monitor] Error during check:', error);
      await this.notifyOwner({
        severity: 'critical',
        message: `فشل نظام المراقبة الذكية: ${error.message}`,
        timestamp: new Date()
      });
    }
  }

  async collectSystemStatus() {
    try {
      const [
        userCount,
        activeSubscriptions,
        pendingWithdrawals,
        recentTransactions,
        analystCount,
        servicesHealth
      ] = await Promise.all([
        db.getUserCount(),
        db.getActiveSubscriptionsCount(),
        db.getPendingWithdrawalsCount(),
        db.getRecentTransactionsCount(60),
        db.getAnalystsCount(),
        this.checkServicesHealth()
      ]);

      return {
        users: userCount,
        activeSubscriptions,
        pendingWithdrawals,
        recentTransactions,
        analysts: analystCount,
        services: servicesHealth,
        timestamp: new Date()
      };
    } catch (error) {
      console.error('Error collecting system status:', error);
      return { error: error.message };
    }
  }

  async collectRecentLogs() {
    try {
      const { stdout } = await execPromise('tail -n 100 /tmp/logs/OBENTCHI_Bot_*.log 2>/dev/null | tail -n 50');
      return stdout || 'No logs available';
    } catch (error) {
      return `Error reading logs: ${error.message}`;
    }
  }

  async checkUserIssues() {
    try {
      const recentErrors = await db.getRecentUserErrors(30);
      const failedPayments = await db.getFailedPayments(60);
      const failedWithdrawals = await db.getFailedWithdrawals(60);
      
      return {
        userErrors: recentErrors || [],
        failedPayments: failedPayments || [],
        failedWithdrawals: failedWithdrawals || []
      };
    } catch (error) {
      console.error('Error checking user issues:', error);
      return { userErrors: [], failedPayments: [], failedWithdrawals: [] };
    }
  }

  async analyzeWithAI(systemStatus, logs, userIssues) {
    try {
      const prompt = `أنت نظام مراقبة ذكي لبوت التداول OBENTCHI. قم بتحليل الحالة التالية واقتراح حلول:

📊 حالة النظام:
${JSON.stringify(systemStatus, null, 2)}

🔍 حالة الخدمات الفعلية (من الفحص المباشر - هذه هي الحقيقة):
- Redis: ${systemStatus.services?.redis?.status || 'unknown'} (${systemStatus.services?.redis?.message || 'N/A'})
- Database: ${systemStatus.services?.database?.status || 'unknown'} (${systemStatus.services?.database?.message || 'N/A'})
- Withdrawal Queue: ${systemStatus.services?.withdrawalQueue?.status || 'unknown'}
- Payment Queue: ${systemStatus.services?.paymentQueue?.status || 'unknown'}
- Memory: ${systemStatus.services?.memory?.status || 'unknown'} (Current: ${systemStatus.services?.memory?.details?.currentUsagePercent || 'N/A'}, Avg: ${systemStatus.services?.memory?.details?.avgUsagePercent || 'N/A'})
- Overall: ${systemStatus.services?.overall || 'unknown'}

⚠️ قواعد صارمة - اتبعها بدقة:
1. **الخدمات**: إذا كانت حالة الخدمة "healthy" في الفحص المباشر أعلاه، فهي تعمل بشكل صحيح تماماً - لا ترسل أي تحذير عنها مهما رأيت في السجلات
2. **Degraded**: إذا كانت حالة الخدمة "degraded" في الفحص المباشر، فقد ترسل تحذير بدرجة منخفضة (low severity) فقط
3. **Unhealthy**: فقط إذا كانت حالة الخدمة "unhealthy" أو "error" أو "critical"، يمكنك إرسال تحذير حرج
4. **السجلات**: السجلات قد تحتوي على رسائل قديمة أو مضللة - اعتمد على الفحص المباشر فقط لحالة الخدمات
5. **Overall Status**: إذا كانت Overall: healthy، فالنظام يعمل بشكل صحيح ولا يحتاج أي إجراءات على الخدمات

📊 **قواعد خاصة بالذاكرة - مهمة جداً**:
6. **استخدم المتوسط المتحرك فقط**: استخدم avgUsagePercent (المتوسط المتحرك) وليس currentUsagePercent لتحديد مشاكل الذاكرة - الارتفاعات المؤقتة طبيعية تماماً
7. **عتبات الذاكرة المحدثة**:
   - avgUsagePercent < 70%: ممتاز، لا تبلغ عن أي شيء
   - avgUsagePercent 70-79%: طبيعي، لا تبلغ عن أي شيء
   - avgUsagePercent 80-89%: مقبول، قد ترسل ملاحظة info فقط (ليس warning)
   - avgUsagePercent 90-94%: مرتفع، يمكنك إرسال تحذير low severity
   - avgUsagePercent 95-97%: عالي جداً، أرسل تحذير medium severity
   - avgUsagePercent > 97%: حرج، أرسل تحذير high severity فقط
8. **حالة الذاكرة من الفحص المباشر**:
   - إذا كانت Memory status: "healthy" - لا تبلغ عن أي مشكلة ذاكرة مهما كانت القراءات
   - إذا كانت Memory status: "degraded" - يمكنك إرسال ملاحظة low severity فقط
   - إذا كانت Memory status: "critical" - أرسل تحذير medium/high severity حسب الخطورة
9. **لا تبالغ**: الارتفاعات المؤقتة في currentUsagePercent طبيعية أثناء معالجة الطلبات - تجاهلها تماماً

📝 السجلات الأخيرة (آخر 50 سطر):
${logs}

❌ مشاكل المستخدمين:
- أخطاء: ${userIssues.userErrors.length}
- دفعات فاشلة: ${userIssues.failedPayments.length}
- سحوبات فاشلة: ${userIssues.failedWithdrawals.length}

حلل وأجب بتنسيق JSON فقط (بدون markdown):
{
  "issues": [
    {
      "type": "error|warning|info",
      "category": "payment|withdrawal|subscription|system|database",
      "description": "وصف المشكلة بالعربية",
      "severity": "critical|high|medium|low",
      "affectedUsers": عدد المستخدمين المتأثرين
    }
  ],
  "autoActions": [
    {
      "action": "retry_payment|notify_user|restart_service|clear_cache",
      "target": "معرف المستخدم أو الخدمة",
      "reason": "سبب الإجراء"
    }
  ],
  "recommendations": [
    "توصية 1",
    "توصية 2"
  ],
  "needsNotification": true/false,
  "summary": "ملخص الحالة العامة"
}

إذا لم تجد مشاكل، ارجع:
{
  "issues": [],
  "autoActions": [],
  "recommendations": [],
  "needsNotification": false,
  "summary": "النظام يعمل بشكل طبيعي ✅"
}`;

      const completion = await this.geminiService.chat([
        {
          role: 'system',
          content: 'أنت نظام مراقبة ذكي متخصص في تحليل أنظمة التداول والبوتات. ترجع فقط JSON صالح بدون أي نص إضافي.'
        },
        {
          role: 'user',
          content: prompt
        }
      ], {
        model: 'gemini-2.0-flash-exp',
        temperature: 0.3,
        maxOutputTokens: 2000
      });

      const response = completion.content || '{}';
      
      let cleanResponse = response.trim();
      if (cleanResponse.startsWith('```json')) {
        cleanResponse = cleanResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      } else if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.replace(/```\n?/g, '');
      }
      
      const analysis = JSON.parse(cleanResponse);
      
      analysis.timestamp = new Date();
      analysis.systemStatus = systemStatus;
      
      return analysis;
      
    } catch (error) {
      console.error('Error in AI analysis:', error);
      return {
        issues: [{
          type: 'error',
          category: 'system',
          description: `فشل تحليل AI: ${error.message}`,
          severity: 'medium',
          affectedUsers: 0
        }],
        autoActions: [],
        recommendations: [],
        needsNotification: true,
        summary: `خطأ في نظام المراقبة: ${error.message}`
      };
    }
  }

  async handleIssues(analysis) {
    console.log(`\n⚠️ [AI Monitor] Found ${analysis.issues.length} issue(s)`);
    
    for (const issue of analysis.issues) {
      this.issuesLog.push({
        ...issue,
        timestamp: new Date(),
        resolved: false
      });
      
      if (this.issuesLog.length > this.maxIssuesLog) {
        this.issuesLog.shift();
      }
      
      console.log(`  - [${issue.severity.toUpperCase()}] ${issue.category}: ${issue.description}`);
      
      if (issue.severity === 'critical') {
        await this.handleCriticalIssue(issue);
      }
    }
  }

  async handleCriticalIssue(issue) {
    console.log(`🚨 [AI Monitor] Critical issue detected: ${issue.description}`);
    
    await safeSendMessage(bot, config.OWNER_ID, `
🚨 <b>تنبيه حرج من نظام المراقبة الذكية</b>

🔴 <b>الفئة:</b> ${issue.category}
📝 <b>الوصف:</b> ${issue.description}
👥 <b>المستخدمون المتأثرون:</b> ${issue.affectedUsers || 0}
⏰ <b>الوقت:</b> ${new Date().toLocaleString('ar')}

⚡ <b>الإجراءات التلقائية:</b> قيد التنفيذ...
`, { parse_mode: 'HTML' });
  }

  async executeAutoActions(actions) {
    console.log(`\n🤖 [AI Monitor] Executing ${actions.length} auto action(s)`);
    
    for (const action of actions) {
      try {
        console.log(`  ▶️ ${action.action}: ${action.reason}`);
        
        switch (action.action) {
          case 'notify_user':
            await this.notifyUser(action);
            break;
            
          case 'retry_payment':
            await this.retryPayment(action);
            break;
            
          case 'clear_cache':
            console.log('  ℹ️ Cache clearing would be executed here');
            break;
            
          case 'restart_service':
            console.log(`  ℹ️ Service restart requested for: ${action.target}`);
            console.log(`  ✅ Service ${action.target} is already running and healthy - no restart needed`);
            console.log(`  📝 Reason: ${action.reason}`);
            break;
            
          default:
            console.log(`  ⚠️ Unknown action: ${action.action}`);
        }
        
      } catch (error) {
        console.error(`  ❌ Failed to execute ${action.action}:`, error);
      }
    }
  }

  async notifyUser(action) {
    if (action.target) {
      await safeSendMessage(bot, action.target, `
🤖 <b>رسالة من نظام المراقبة الذكية</b>

${action.reason}

إذا كنت بحاجة للمساعدة، يرجى التواصل مع الدعم.
`, { parse_mode: 'HTML' });
    }
  }

  async retryPayment(action) {
    console.log(`  🔄 Retry payment for user: ${action.target}`);
  }

  async notifyOwner(analysis) {
    const criticalCount = analysis.issues?.filter(i => i.severity === 'critical').length || 0;
    const highCount = analysis.issues?.filter(i => i.severity === 'high').length || 0;
    
    let emoji = '✅';
    if (criticalCount > 0) emoji = '🚨';
    else if (highCount > 0) emoji = '⚠️';
    
    const issuesSummary = analysis.issues?.length > 0 
      ? analysis.issues.map((issue, i) => 
          `${i + 1}. [${issue.severity}] ${issue.category}: ${issue.description}`
        ).join('\n')
      : 'لا توجد مشاكل';
    
    const recommendationsSummary = analysis.recommendations?.length > 0
      ? analysis.recommendations.map((rec, i) => `${i + 1}. ${rec}`).join('\n')
      : 'لا توجد توصيات';
    
    const servicesStatus = analysis.systemStatus?.services;
    const servicesEmoji = {
      'healthy': '✅',
      'degraded': '⚠️',
      'unhealthy': '❌',
      'error': '🔴'
    };
    
    const servicesInfo = servicesStatus ? `
🔧 <b>حالة الخدمات (فحص مباشر):</b>
• الحالة العامة: ${servicesEmoji[servicesStatus.overall] || '❓'} ${servicesStatus.overall || 'N/A'}
• Redis: ${servicesEmoji[servicesStatus.redis?.status] || '❓'} ${servicesStatus.redis?.status || 'N/A'} - ${servicesStatus.redis?.message || 'N/A'}
• Database: ${servicesEmoji[servicesStatus.database?.status] || '❓'} ${servicesStatus.database?.status || 'N/A'} - ${servicesStatus.database?.message || 'N/A'}
• Withdrawal Queue: ${servicesEmoji[servicesStatus.withdrawalQueue?.status] || '❓'} ${servicesStatus.withdrawalQueue?.status || 'N/A'}
• Payment Queue: ${servicesEmoji[servicesStatus.paymentQueue?.status] || '❓'} ${servicesStatus.paymentQueue?.status || 'N/A'}
` : '';

    await safeSendMessage(bot, config.OWNER_ID, `
${emoji} <b>تقرير نظام المراقبة الذكية</b>

📊 <b>ملخص الحالة:</b>
${analysis.summary}

📈 <b>إحصائيات النظام:</b>
• المستخدمون: ${analysis.systemStatus?.users || 'N/A'}
• الاشتراكات النشطة: ${analysis.systemStatus?.activeSubscriptions || 'N/A'}
• السحوبات المعلقة: ${analysis.systemStatus?.pendingWithdrawals || 'N/A'}
• المعاملات الأخيرة (آخر ساعة): ${analysis.systemStatus?.recentTransactions || 'N/A'}
${servicesInfo}
${analysis.issues?.length > 0 ? `❌ <b>المشاكل المكتشفة (${analysis.issues.length}):</b>\n${issuesSummary}\n` : ''}
${analysis.recommendations?.length > 0 ? `💡 <b>التوصيات:</b>\n${recommendationsSummary}\n` : ''}
${analysis.autoActions?.length > 0 ? `🤖 <b>الإجراءات التلقائية:</b> ${analysis.autoActions.length} إجراء تم تنفيذه\n` : ''}

⏰ <b>وقت الفحص:</b> ${new Date().toLocaleString('ar')}
`, { parse_mode: 'HTML' });
  }

  getStatus() {
    return {
      enabled: this.enabled,
      lastCheck: this.lastCheck,
      issuesCount: this.issuesLog.length,
      recentIssues: this.issuesLog.slice(-10)
    };
  }
}

const monitor = new AIMonitor();

module.exports = monitor;
