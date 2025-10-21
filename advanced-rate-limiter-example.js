/**
 * Advanced Rate Limiter - Usage Examples
 * أمثلة على استخدام نظام Rate Limiting المتقدم
 */

const {
  advancedRateLimiter,
  createAdvancedRateLimitMiddleware,
  rateLimitMiddleware,
  TIER_CONFIGS,
  RESOURCE_COSTS
} = require('./advanced-rate-limiter');

// ===== EXAMPLE 1: Basic Usage - فحص الحد =====

async function example1_checkRateLimit() {
  console.log('\n========== EXAMPLE 1: Basic Check Rate Limit ==========\n');
  
  const userId = 123456789;
  const resource = 'analysis';
  
  // فحص الحد بدون استهلاك
  const check = await advancedRateLimiter.checkRateLimit(userId, resource);
  
  console.log('Rate Limit Check Result:', JSON.stringify(check, null, 2));
  
  if (check.allowed) {
    console.log(`✅ Request allowed! Remaining: ${check.remaining}/${check.limit}`);
  } else {
    console.log(`❌ Request blocked! Retry after ${check.retryAfter} seconds`);
    console.log(`💡 ${check.upgrade_suggestion}`);
  }
}

// ===== EXAMPLE 2: Consume Rate Limit - استهلاك الحد =====

async function example2_consumeRateLimit() {
  console.log('\n========== EXAMPLE 2: Consume Rate Limit ==========\n');
  
  const userId = 123456789;
  const resource = 'ai';
  
  // استهلاك من الحد
  const result = await advancedRateLimiter.consumeRateLimit(userId, resource, {
    cost: 2 // عملية مُكلفة (تحلل AI معقد)
  });
  
  console.log('Consume Result:', JSON.stringify(result, null, 2));
  
  if (result.consumed) {
    console.log(`✅ Request consumed! Used ${result.cost} units`);
    console.log(`📊 Remaining: ${result.remaining}/${result.limit}`);
  }
}

// ===== EXAMPLE 3: Get User Tier - الحصول على مستوى المستخدم =====

async function example3_getUserTier() {
  console.log('\n========== EXAMPLE 3: Get User Tier ==========\n');
  
  const userIds = [123456789, 987654321, 111222333];
  
  for (const userId of userIds) {
    const tier = await advancedRateLimiter.getUserTier(userId);
    const tierConfig = advancedRateLimiter.getRateLimitConfig(tier);
    
    console.log(`\nUser ${userId}:`);
    console.log(`  Tier: ${tier} (${tierConfig.name})`);
    console.log(`  Priority: ${tierConfig.priority}`);
    console.log(`  Burst Allowance: ${tierConfig.burst_allowance}x`);
    console.log(`  Analysis Limit: ${tierConfig.limits.analysis.count}/hour`);
    console.log(`  AI Limit: ${tierConfig.limits.ai.count}/hour`);
  }
}

// ===== EXAMPLE 4: Get Rate Limit Status - الحالة الكاملة =====

async function example4_getRateLimitStatus() {
  console.log('\n========== EXAMPLE 4: Get Complete Status ==========\n');
  
  const userId = 123456789;
  
  // الحصول على الحالة لجميع الموارد
  const status = await advancedRateLimiter.getRateLimitStatus(userId);
  
  console.log(`User: ${userId}`);
  console.log(`Tier: ${status.tierName} (${status.tier})`);
  console.log(`Priority: ${status.priority}\n`);
  
  console.log('Resources Status:');
  for (const resource of status.resources) {
    const emoji = resource.allowed ? '✅' : '❌';
    const unlimited = resource.limit === -1 ? ' (Unlimited)' : '';
    
    console.log(`  ${emoji} ${resource.resource}: ${resource.remaining}/${resource.limit}${unlimited}`);
    
    if (resource.softLimitWarning) {
      console.log(`      ⚠️  ${resource.warning}`);
    }
  }
}

// ===== EXAMPLE 5: Admin Functions - وظائف الأدمن =====

async function example5_adminFunctions() {
  console.log('\n========== EXAMPLE 5: Admin Functions ==========\n');
  
  const userId = 123456789;
  const adminId = 6758470819; // Owner ID from config
  
  // إعادة تعيين حد معين
  const resetResult = await advancedRateLimiter.resetRateLimit(userId, 'analysis', adminId);
  console.log('Reset Result:', resetResult);
  
  // إضافة إلى Whitelist
  const whitelistResult = advancedRateLimiter.addToWhitelist(userId, adminId);
  console.log('Whitelist Result:', whitelistResult);
  
  // التحقق من Tier بعد Whitelist (يجب أن يكون admin)
  const newTier = await advancedRateLimiter.getUserTier(userId);
  console.log(`New Tier after whitelist: ${newTier}`);
  
  // إزالة من Whitelist
  advancedRateLimiter.removeFromWhitelist(userId, adminId);
  console.log('Removed from whitelist');
}

// ===== EXAMPLE 6: Dynamic Configuration - تعديل الحدود ديناميكياً =====

async function example6_dynamicConfiguration() {
  console.log('\n========== EXAMPLE 6: Dynamic Configuration ==========\n');
  
  const adminId = 6758470819;
  
  // تعديل حد معين ديناميكياً
  const updateResult = advancedRateLimiter.setDynamicLimit('free', 'analysis', {
    count: 20, // زيادة من 10 إلى 20
    window: 3600,
    cost: 1
  });
  
  console.log('Dynamic Update Result:', updateResult);
  
  // التحقق من التعديل
  const newConfig = advancedRateLimiter.getRateLimitConfig('free');
  console.log('New Free Tier Analysis Limit:', newConfig.limits.analysis.count);
}

// ===== EXAMPLE 7: Monitoring & Analytics - التحليلات =====

async function example7_monitoringAnalytics() {
  console.log('\n========== EXAMPLE 7: Monitoring & Analytics ==========\n');
  
  // محاكاة بعض الطلبات
  const testUsers = [111, 222, 333, 444, 555];
  
  for (let i = 0; i < 50; i++) {
    const userId = testUsers[i % testUsers.length];
    const resources = ['analysis', 'market_data', 'search', 'ai'];
    const resource = resources[i % resources.length];
    
    await advancedRateLimiter.consumeRateLimit(userId, resource);
  }
  
  // الحصول على المستخدمين الأكثر انتهاكاً
  console.log('\n📊 Most Limited Users:');
  const mostLimited = advancedRateLimiter.getMostLimitedUsers(5);
  mostLimited.forEach((user, index) => {
    console.log(`  ${index + 1}. User ${user.userId}: ${user.violations} violations`);
  });
  
  // أنماط استخدام الموارد
  console.log('\n📈 Resource Usage Patterns:');
  const patterns = advancedRateLimiter.getResourceUsagePatterns();
  patterns.slice(0, 5).forEach((pattern) => {
    console.log(`  ${pattern.resource} (${pattern.tier}): ${pattern.totalRequests} requests, ${pattern.uniqueUsers} users`);
  });
  
  // توزيع الـ tiers
  console.log('\n🎯 Tier Distribution:');
  const distribution = advancedRateLimiter.getTierDistribution();
  distribution.forEach((tier) => {
    console.log(`  ${tier.tierName}: ${tier.userCount} users (Priority: ${tier.priority})`);
  });
  
  // إحصائيات النظام
  console.log('\n⚙️  System Stats:');
  const stats = await advancedRateLimiter.getSystemStats();
  console.log(JSON.stringify(stats, null, 2));
}

// ===== EXAMPLE 8: Express Middleware - استخدام مع Express =====

function example8_expressMiddleware() {
  console.log('\n========== EXAMPLE 8: Express Middleware Usage ==========\n');
  
  const express = require('express');
  const app = express();
  
  app.use(express.json());
  
  // استخدام middleware للتحليل
  app.post('/api/analysis', 
    rateLimitMiddleware.analysis(1), // Cost = 1
    async (req, res) => {
      // Rate limit info متاح في req.rateLimit
      console.log('Rate Limit Info:', req.rateLimit);
      
      res.json({
        success: true,
        data: 'Analysis result...',
        rateLimit: {
          remaining: req.rateLimit.remaining,
          limit: req.rateLimit.limit,
          tier: req.rateLimit.tier
        }
      });
    }
  );
  
  // استخدام middleware للـ AI (cost أعلى)
  app.post('/api/ai/complex',
    rateLimitMiddleware.ai(3), // Complex AI operation costs 3 units
    async (req, res) => {
      res.json({
        success: true,
        data: 'Complex AI analysis...'
      });
    }
  );
  
  // Custom middleware
  app.post('/api/custom',
    createAdvancedRateLimitMiddleware('market_data', {
      cost: 2,
      getUserId: (req) => req.body.user_id,
      onLimitReached: (req, res, result) => {
        console.log(`⚠️ User ${req.body.user_id} reached limit for market_data`);
      }
    }),
    async (req, res) => {
      res.json({ success: true });
    }
  );
  
  console.log('Express middleware examples configured!');
  console.log('Routes:');
  console.log('  POST /api/analysis - Analysis with rate limit (cost: 1)');
  console.log('  POST /api/ai/complex - Complex AI with rate limit (cost: 3)');
  console.log('  POST /api/custom - Custom rate limit middleware');
}

// ===== EXAMPLE 9: IP-based Rate Limiting - للمستخدمين غير المعروفين =====

async function example9_ipBasedRateLimiting() {
  console.log('\n========== EXAMPLE 9: IP-based Rate Limiting ==========\n');
  
  const ip = '192.168.1.100';
  const resource = 'general';
  
  // فحص حد الـ IP
  const result = await advancedRateLimiter.checkIPRateLimit(ip, resource);
  
  console.log('IP Rate Limit Result:', JSON.stringify(result, null, 2));
  
  if (result.allowed) {
    console.log(`✅ IP ${ip} allowed! Remaining: ${result.remaining}/${result.limit}`);
  } else {
    console.log(`❌ IP ${ip} blocked! Retry after ${result.retryAfter} seconds`);
  }
}

// ===== EXAMPLE 10: Export Analytics - تصدير التحليلات =====

async function example10_exportAnalytics() {
  console.log('\n========== EXAMPLE 10: Export Analytics ==========\n');
  
  // تصدير كـ JSON
  const jsonExport = advancedRateLimiter.exportAnalytics('json');
  console.log('JSON Export (first 500 chars):');
  console.log(jsonExport.substring(0, 500) + '...\n');
  
  // تصدير كـ CSV
  const csvExport = advancedRateLimiter.exportAnalytics('csv');
  console.log('CSV Export:');
  console.log(csvExport);
}

// ===== EXAMPLE 11: Soft Limit Warning - تحذير عند 80% =====

async function example11_softLimitWarning() {
  console.log('\n========== EXAMPLE 11: Soft Limit Warning ==========\n');
  
  const userId = 999888777;
  const resource = 'analysis';
  
  // استهلاك حتى نصل إلى 80%
  for (let i = 0; i < 9; i++) { // Free tier has 10/hour, so 9 = 90%
    await advancedRateLimiter.consumeRateLimit(userId, resource);
  }
  
  // الفحص الآن يجب أن يعطي تحذير
  const check = await advancedRateLimiter.checkRateLimit(userId, resource);
  
  console.log('Check Result:', JSON.stringify(check, null, 2));
  
  if (check.softLimitWarning) {
    console.log(`⚠️  WARNING: ${check.warning}`);
    console.log(`📊 Usage: ${check.percentUsed}%`);
  }
}

// ===== EXAMPLE 12: Tier Comparison - مقارنة الـ Tiers =====

function example12_tierComparison() {
  console.log('\n========== EXAMPLE 12: Tier Comparison ==========\n');
  
  const tiers = ['free', 'basic', 'vip', 'analyst', 'admin'];
  const resources = ['analysis', 'market_data', 'search', 'ai', 'scanner'];
  
  console.log('📊 TIER COMPARISON TABLE\n');
  
  // Header
  console.log('Resource'.padEnd(15), tiers.map(t => t.toUpperCase().padEnd(12)).join(''));
  console.log('-'.repeat(80));
  
  // Rows
  for (const resource of resources) {
    const limits = tiers.map(tier => {
      const config = TIER_CONFIGS[tier];
      const limit = config.limits[resource];
      const count = limit.count === -1 ? 'Unlimited' : limit.count.toString();
      const window = limit.window === 86400 ? '/day' : '/hour';
      return limit.count === -1 ? count.padEnd(12) : (count + window).padEnd(12);
    });
    
    console.log(resource.padEnd(15), limits.join(''));
  }
  
  console.log('\n💎 Burst Allowance:');
  tiers.forEach(tier => {
    const config = TIER_CONFIGS[tier];
    console.log(`  ${tier.toUpperCase()}: ${config.burst_allowance}x`);
  });
  
  console.log('\n⭐ Priority Levels:');
  tiers.forEach(tier => {
    const config = TIER_CONFIGS[tier];
    console.log(`  ${tier.toUpperCase()}: ${config.priority}`);
  });
}

// ===== RUN ALL EXAMPLES =====

async function runAllExamples() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║   Advanced Rate Limiter - Usage Examples & Testing        ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  try {
    // Basic examples
    await example1_checkRateLimit();
    await example2_consumeRateLimit();
    await example3_getUserTier();
    await example4_getRateLimitStatus();
    
    // Admin examples
    await example5_adminFunctions();
    await example6_dynamicConfiguration();
    
    // Monitoring
    await example7_monitoringAnalytics();
    
    // Express integration
    example8_expressMiddleware();
    
    // Advanced features
    await example9_ipBasedRateLimiting();
    await example10_exportAnalytics();
    await example11_softLimitWarning();
    
    // Comparison
    example12_tierComparison();
    
    console.log('\n✅ All examples completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Error running examples:', error);
  } finally {
    // Cleanup
    await advancedRateLimiter.close();
    console.log('\n🔴 Advanced Rate Limiter closed\n');
    process.exit(0);
  }
}

// ===== TESTING FUNCTIONS =====

async function testRateLimiting() {
  console.log('\n========== TESTING RATE LIMITING ==========\n');
  
  const userId = 111222333;
  const resource = 'analysis';
  
  console.log('Testing Free Tier (10 requests/hour limit with 20% burst = 12):\n');
  
  // محاولة 15 طلب
  for (let i = 1; i <= 15; i++) {
    const result = await advancedRateLimiter.consumeRateLimit(userId, resource);
    
    const status = result.allowed ? '✅' : '❌';
    console.log(`Request ${i.toString().padStart(2)}: ${status} - Remaining: ${result.remaining}/${result.limit}`);
    
    if (!result.allowed) {
      console.log(`   Message: ${result.message}`);
      console.log(`   Suggestion: ${result.upgrade_suggestion}`);
      break;
    }
    
    if (result.softLimitWarning) {
      console.log(`   ⚠️  ${result.warning}`);
    }
  }
}

async function testMultipleResources() {
  console.log('\n========== TESTING MULTIPLE RESOURCES ==========\n');
  
  const userId = 444555666;
  const resources = ['analysis', 'market_data', 'search', 'ai', 'scanner'];
  
  console.log('Testing all resources for a Free tier user:\n');
  
  for (const resource of resources) {
    const result = await advancedRateLimiter.consumeRateLimit(userId, resource);
    
    const status = result.allowed ? '✅' : '❌';
    const unlimited = result.limit === -1 ? ' (Unlimited)' : '';
    
    console.log(`${resource.padEnd(15)}: ${status} - ${result.remaining}/${result.limit}${unlimited}`);
  }
}

async function testCostBasedLimiting() {
  console.log('\n========== TESTING COST-BASED LIMITING ==========\n');
  
  const userId = 777888999;
  const resource = 'ai';
  
  console.log('Testing AI requests with different costs (Free tier: 2/hour with 20% burst = 2):\n');
  
  // Simple AI (cost = 1)
  const simple = await advancedRateLimiter.consumeRateLimit(userId, resource, { cost: 1 });
  console.log(`Simple AI (cost 1):  ✅ - Remaining: ${simple.remaining}/${simple.limit}`);
  
  // Complex AI (cost = 3) - should fail
  const complex = await advancedRateLimiter.consumeRateLimit(userId, resource, { cost: 3 });
  const status = complex.allowed ? '✅' : '❌';
  console.log(`Complex AI (cost 3): ${status} - Remaining: ${complex.remaining}/${complex.limit}`);
  
  if (!complex.allowed) {
    console.log(`   ${complex.message}`);
  }
}

// ===== MAIN =====

if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--test')) {
    (async () => {
      await testRateLimiting();
      await testMultipleResources();
      await testCostBasedLimiting();
      await advancedRateLimiter.close();
      process.exit(0);
    })();
  } else {
    runAllExamples();
  }
}

module.exports = {
  runAllExamples,
  testRateLimiting,
  testMultipleResources,
  testCostBasedLimiting
};
