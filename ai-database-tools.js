/**
 * AI Database Tools - أدوات قاعدة البيانات للذكاء الاصطناعي
 * جميع العمليات read-only فقط لحماية البيانات
 * 
 * Features:
 * - إحصائيات عامة عن قاعدة البيانات
 * - استعلامات آمنة ومحدودة
 * - حماية من كشف البيانات الحساسة
 * - Logging شامل
 */

const { createLogger } = require('./centralized-logger');
const logger = createLogger('ai-database-tools');

let db = null;

/**
 * تهيئة الاتصال بقاعدة البيانات
 */
function initDatabase(database) {
  db = database;
  logger.info('✅ AI Database Tools initialized');
}

/**
 * إحصائيات عامة عن قاعدة البيانات
 */
async function getDatabaseStats() {
  try {
    logger.info('📊 Getting database statistics');
    
    if (!db) {
      throw new Error('Database not initialized');
    }
    
    const [
      usersCount,
      analystsCount,
      transactionsCount,
      withdrawalsCount,
      depositsCount,
      activeSubscriptions
    ] = await Promise.all([
      db.collection('users').countDocuments(),
      db.collection('users').countDocuments({ is_analyst: true }),
      db.collection('transactions').countDocuments(),
      db.collection('withdrawals').countDocuments(),
      db.collection('transactions').countDocuments({ type: 'deposit' }),
      db.collection('users').countDocuments({
        subscription_expires: { $gt: new Date() }
      })
      // ✅ SECURITY: تم إزالة total_balance لحماية البيانات المالية
    ]);
    
    const stats = {
      users: {
        total: usersCount,
        analysts: analystsCount,
        regular: usersCount - analystsCount,
        active_subscriptions: activeSubscriptions
      },
      transactions: {
        total: transactionsCount,
        deposits: depositsCount,
        withdrawals: withdrawalsCount
      },
      // ✅ SECURITY: لا نكشف البيانات المالية (balances, amounts)
      // فقط counts عامة
      timestamp: new Date().toISOString()
    };
    
    logger.info('✅ Database stats retrieved successfully');
    return {
      success: true,
      data: stats
    };
    
  } catch (error) {
    logger.error({ err: error }, '❌ Error getting database stats');
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * عدد المستخدمين
 */
async function getUsersCount(filters = {}) {
  try {
    logger.info('👥 Getting users count', { filters });
    
    if (!db) {
      throw new Error('Database not initialized');
    }
    
    const query = {};
    
    // فلاتر آمنة فقط
    if (filters.is_analyst === true) {
      query.is_analyst = true;
    }
    if (filters.has_subscription === true) {
      query.subscription_expires = { $gt: new Date() };
    }
    if (filters.is_active === true) {
      query.is_active = true;
    }
    
    const count = await db.collection('users').countDocuments(query);
    
    return {
      success: true,
      count: count,
      filters: filters
    };
    
  } catch (error) {
    logger.error({ err: error }, '❌ Error getting users count');
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * عدد المحللين
 */
async function getAnalystsCount(filters = {}) {
  try {
    logger.info('📊 Getting analysts count', { filters });
    
    if (!db) {
      throw new Error('Database not initialized');
    }
    
    const query = { is_analyst: true };
    
    // فلاتر إضافية
    if (filters.is_active === true) {
      query.is_active = true;
    }
    if (filters.has_subscribers === true) {
      query.subscribers_count = { $gt: 0 };
    }
    
    const count = await db.collection('users').countDocuments(query);
    
    // إحصائيات إضافية عن المحللين
    // ✅ SECURITY: فقط معلومات عامة، بدون بيانات مالية
    const analyticsStats = await db.collection('users').aggregate([
      { $match: { is_analyst: true } },
      {
        $group: {
          _id: null,
          total_subscribers: { $sum: '$subscribers_count' },
          avg_subscribers: { $avg: '$subscribers_count' }
          // ✅ SECURITY: تم إزالة total_earnings لحماية البيانات المالية
        }
      }
    ]).toArray();
    
    return {
      success: true,
      count: count,
      stats: analyticsStats[0] || {
        total_subscribers: 0,
        avg_subscribers: 0
        // ✅ SECURITY: لا earnings data
      },
      filters: filters
    };
    
  } catch (error) {
    logger.error({ err: error }, '❌ Error getting analysts count');
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * أحدث المستخدمين (بدون بيانات حساسة)
 */
async function getRecentUsers(limit = 10) {
  try {
    logger.info('🆕 Getting recent users', { limit });
    
    if (!db) {
      throw new Error('Database not initialized');
    }
    
    // تحديد الحد الأقصى للأمان
    const safeLimit = Math.min(Math.max(1, limit), 100);
    
    const users = await db.collection('users')
      .find(
        {},
        {
          projection: {
            // فقط البيانات غير الحساسة
            user_id: 1,
            username: 1,
            first_name: 1,
            is_analyst: 1,
            created_at: 1,
            subscription_expires: 1,
            language: 1,
            // إخفاء البيانات الحساسة
            balance: 0,
            wallet_address: 0,
            api_key: 0,
            password: 0
          }
        }
      )
      .sort({ created_at: -1 })
      .limit(safeLimit)
      .toArray();
    
    // إخفاء user_id الكامل (عرض آخر 4 أرقام فقط)
    const sanitizedUsers = users.map(user => ({
      ...user,
      user_id: `***${String(user.user_id).slice(-4)}`,
      username: user.username ? `${user.username.substring(0, 3)}***` : 'N/A'
    }));
    
    return {
      success: true,
      count: sanitizedUsers.length,
      users: sanitizedUsers,
      limit: safeLimit
    };
    
  } catch (error) {
    logger.error({ err: error }, '❌ Error getting recent users');
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * إحصائيات الاشتراكات
 */
async function getSubscriptionsStats() {
  try {
    logger.info('💎 Getting subscriptions statistics');
    
    if (!db) {
      throw new Error('Database not initialized');
    }
    
    const now = new Date();
    
    const [
      activeSubscriptions,
      expiredSubscriptions,
      expiringIn3Days,
      expiringToday,
      subscriptionRevenue
    ] = await Promise.all([
      // اشتراكات نشطة
      db.collection('users').countDocuments({
        subscription_expires: { $gt: now }
      }),
      
      // اشتراكات منتهية
      db.collection('users').countDocuments({
        subscription_expires: { $lte: now }
      }),
      
      // تنتهي خلال 3 أيام
      db.collection('users').countDocuments({
        subscription_expires: {
          $gt: now,
          $lte: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
        }
      }),
      
      // تنتهي اليوم
      db.collection('users').countDocuments({
        subscription_expires: {
          $gte: new Date(now.setHours(0, 0, 0, 0)),
          $lte: new Date(now.setHours(23, 59, 59, 999))
        }
      }),
      
      // عدد معاملات الاشتراكات فقط (بدون amounts)
      // ✅ SECURITY: فقط counts بدون revenue amounts
      db.collection('transactions').countDocuments({
        type: 'subscription_payment',
        status: 'completed'
      })
    ]);
    
    return {
      success: true,
      data: {
        active: activeSubscriptions,
        expired: expiredSubscriptions,
        expiring_in_3_days: expiringIn3Days,
        expiring_today: expiringToday,
        transactions: {
          completed_count: expiringToday
          // ✅ SECURITY: لا نكشف revenue amounts
        }
      },
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    logger.error({ err: error }, '❌ Error getting subscriptions stats');
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * إحصائيات السحوبات
 */
async function getWithdrawalsStats() {
  try {
    logger.info('💸 Getting withdrawals statistics');
    
    if (!db) {
      throw new Error('Database not initialized');
    }
    
    const [
      totalWithdrawals,
      pendingWithdrawals,
      completedWithdrawals,
      failedWithdrawals
    ] = await Promise.all([
      // إجمالي السحوبات
      db.collection('withdrawals').countDocuments(),
      
      // السحوبات المعلقة
      db.collection('withdrawals').countDocuments({ status: 'pending' }),
      
      // السحوبات المكتملة
      db.collection('withdrawals').countDocuments({ status: 'completed' }),
      
      // السحوبات الفاشلة
      db.collection('withdrawals').countDocuments({ status: 'failed' })
      
      // ✅ SECURITY: تم إزالة aggregation للـ amounts لحماية البيانات المالية
    ]);
    
    return {
      success: true,
      data: {
        total: totalWithdrawals,
        by_status: {
          pending: pendingWithdrawals,
          completed: completedWithdrawals,
          failed: failedWithdrawals
        }
        // ✅ SECURITY: فقط counts، لا amounts
      },
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    logger.error({ err: error }, '❌ Error getting withdrawals stats');
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * استعلام عام محدود (read-only فقط)
 * مع حماية من استعلامات خطيرة
 */
async function queryDatabase(collectionName, query = {}, options = {}) {
  try {
    logger.info('🔍 Executing safe database query', { 
      collection: collectionName,
      query,
      options 
    });
    
    if (!db) {
      throw new Error('Database not initialized');
    }
    
    // قائمة المجموعات المسموح بها
    const allowedCollections = [
      'users',
      'transactions',
      'withdrawals',
      'signals',
      'analysts',
      'notifications'
    ];
    
    if (!allowedCollections.includes(collectionName)) {
      throw new Error(`Collection '${collectionName}' is not allowed for queries`);
    }
    
    // حد أقصى للنتائج
    const safeLimit = Math.min(Math.max(1, options.limit || 10), 100);
    
    // حماية من استعلامات معقدة أو خطيرة
    const safeQuery = sanitizeQuery(query);
    
    // Projection آمن - إخفاء جميع البيانات الحساسة (hardcoded)
    // ✅ لا يمكن تجاوز هذه الحماية
    const safeProjection = {
      // بيانات أمنية
      password: 0,
      api_key: 0,
      private_key: 0,
      wallet_private_key: 0,
      tron_private_key: 0,
      okx_secret_key: 0,
      okx_api_key: 0,
      okx_passphrase: 0,
      // بيانات مالية حساسة
      balance: 0,
      wallet_address: 0,
      analyst_earnings: 0,
      total_earned: 0,
      amount: 0,
      // لا يمكن override هذه الحماية
      // options.projection تم إزالتها للأمان
    };
    
    const results = await db.collection(collectionName)
      .find(safeQuery, { projection: safeProjection })
      .limit(safeLimit)
      .toArray();
    
    // تنقية النتائج من أي بيانات حساسة متبقية
    const sanitizedResults = sanitizeResults(results);
    
    return {
      success: true,
      collection: collectionName,
      count: sanitizedResults.length,
      limit: safeLimit,
      data: sanitizedResults
    };
    
  } catch (error) {
    logger.error({ err: error }, '❌ Error executing database query');
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * تنقية الاستعلام من العمليات الخطيرة
 * ✅ حماية كاملة من NoSQL injection
 */
function sanitizeQuery(query) {
  // منع العمليات الخطيرة تماماً
  const dangerousOperators = [
    '$where',
    '$expr',
    '$function',
    '$accumulator',
    '$regex',
    '$text',
    '$jsonSchema',
    '$mod'
  ];
  
  // قائمة العمليات المسموحة فقط (allow-list)
  const allowedOperators = [
    '$eq',
    '$ne',
    '$gt',
    '$gte',
    '$lt',
    '$lte',
    '$in',
    '$nin',
    '$and',
    '$or',
    '$not',
    '$exists'
  ];
  
  // حقول مسموحة فقط (allow-list)
  const allowedFields = [
    'user_id',
    'username',
    'first_name',
    'is_analyst',
    'is_active',
    'created_at',
    'subscription_expires',
    'language',
    'type',
    'status',
    'analyst_id',
    'symbol',
    'timeframe'
  ];
  
  const sanitized = JSON.parse(JSON.stringify(query));
  
  function removeDangerous(obj) {
    for (const key in obj) {
      // حذف operators خطرة
      if (dangerousOperators.includes(key)) {
        delete obj[key];
        logger.warn(`⚠️ SECURITY: Removed dangerous operator: ${key}`);
        continue;
      }
      
      // التحقق من أن الـ operator مسموح به
      if (key.startsWith('$') && !allowedOperators.includes(key)) {
        delete obj[key];
        logger.warn(`⚠️ SECURITY: Removed non-allowed operator: ${key}`);
        continue;
      }
      
      // التحقق من أن الحقل مسموح به
      if (!key.startsWith('$') && !allowedFields.includes(key)) {
        delete obj[key];
        logger.warn(`⚠️ SECURITY: Removed non-allowed field: ${key}`);
        continue;
      }
      
      // recursive check
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        if (Array.isArray(obj[key])) {
          obj[key].forEach(item => {
            if (typeof item === 'object') {
              removeDangerous(item);
            }
          });
        } else {
          removeDangerous(obj[key]);
        }
      }
    }
  }
  
  removeDangerous(sanitized);
  return sanitized;
}

/**
 * تنقية النتائج من البيانات الحساسة
 */
function sanitizeResults(results) {
  const sensitiveFields = [
    'password',
    'api_key',
    'wallet_private_key',
    'tron_private_key',
    'okx_secret_key',
    'balance' // إخفاء الأرصدة للخصوصية
  ];
  
  return results.map(result => {
    const sanitized = { ...result };
    
    sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        delete sanitized[field];
      }
    });
    
    // إخفاء جزء من user_id
    if (sanitized.user_id) {
      sanitized.user_id = `***${String(sanitized.user_id).slice(-4)}`;
    }
    
    // إخفاء جزء من wallet_address
    if (sanitized.wallet_address) {
      sanitized.wallet_address = `${sanitized.wallet_address.substring(0, 6)}...${sanitized.wallet_address.slice(-4)}`;
    }
    
    return sanitized;
  });
}

/**
 * الحصول على إحصائيات النمو (اليوم، الأسبوع، الشهر)
 */
async function getGrowthStats() {
  try {
    logger.info('📈 Getting growth statistics');
    
    if (!db) {
      throw new Error('Database not initialized');
    }
    
    const now = new Date();
    const today = new Date(now.setHours(0, 0, 0, 0));
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const [
      newUsersToday,
      newUsersWeek,
      newUsersMonth,
      transactionsToday,
      transactionsWeek,
      transactionsMonth
    ] = await Promise.all([
      db.collection('users').countDocuments({ created_at: { $gte: today } }),
      db.collection('users').countDocuments({ created_at: { $gte: weekAgo } }),
      db.collection('users').countDocuments({ created_at: { $gte: monthAgo } }),
      db.collection('transactions').countDocuments({ created_at: { $gte: today } }),
      db.collection('transactions').countDocuments({ created_at: { $gte: weekAgo } }),
      db.collection('transactions').countDocuments({ created_at: { $gte: monthAgo } })
    ]);
    
    return {
      success: true,
      data: {
        new_users: {
          today: newUsersToday,
          week: newUsersWeek,
          month: newUsersMonth
        },
        transactions: {
          today: transactionsToday,
          week: transactionsWeek,
          month: transactionsMonth
        }
      },
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    logger.error({ err: error }, '❌ Error getting growth stats');
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  initDatabase,
  getDatabaseStats,
  getUsersCount,
  getAnalystsCount,
  getRecentUsers,
  getSubscriptionsStats,
  getWithdrawalsStats,
  queryDatabase,
  getGrowthStats
};
