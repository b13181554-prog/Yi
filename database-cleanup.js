const { MongoClient, ObjectId } = require('mongodb');
const config = require('./config');

let db = null;
let client = null;

async function connectDB() {
  try {
    client = new MongoClient(config.MONGODB_URI, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      tls: true,
      tlsAllowInvalidCertificates: false,
    });
    
    await client.connect();
    db = client.db(config.MONGODB_DB_NAME);
    console.log('✅ متصل بقاعدة البيانات');
  } catch (error) {
    console.error('❌ خطأ في الاتصال:', error);
    throw error;
  }
}

async function analyzeOldData() {
  console.log('\n📊 تحليل البيانات القديمة...\n');
  
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
  
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  
  const report = {
    expiredSubscriptions: 0,
    oldFailedTransactions: 0,
    oldRejectedWithdrawals: 0,
    oldClosedTrades: 0,
    analystsWithoutNames: 0,
    duplicateAnalysts: 0,
    orphanedSubscriptions: 0
  };

  // 1. الاشتراكات المنتهية القديمة (أكثر من 60 يوم)
  report.expiredSubscriptions = await db.collection('analyst_subscriptions').countDocuments({
    status: 'active',
    end_date: { $lt: sixtyDaysAgo }
  });

  // 2. المعاملات الفاشلة القديمة جداً (أكثر من 90 يوم)
  report.oldFailedTransactions = await db.collection('transactions').countDocuments({
    status: 'failed',
    created_at: { $lt: ninetyDaysAgo }
  });

  // 3. طلبات السحب المرفوضة/الفاشلة القديمة (أكثر من 60 يوم)
  report.oldRejectedWithdrawals = await db.collection('withdrawal_requests').countDocuments({
    status: { $in: ['rejected', 'failed'] },
    created_at: { $lt: sixtyDaysAgo }
  });

  // 4. الصفقات المغلقة القديمة (أكثر من 90 يوم)
  report.oldClosedTrades = await db.collection('analyst_trades').countDocuments({
    status: 'closed',
    closed_at: { $lt: ninetyDaysAgo }
  });

  // 5. محللين بدون أسماء أو أسماء فارغة
  report.analystsWithoutNames = await db.collection('analysts').countDocuments({
    $or: [
      { name: null },
      { name: '' },
      { name: { $exists: false } }
    ]
  });

  // 6. اشتراكات لمحللين محذوفين (orphaned)
  const analystIds = await db.collection('analysts').distinct('_id');
  report.orphanedSubscriptions = await db.collection('analyst_subscriptions').countDocuments({
    analyst_id: { $nin: analystIds }
  });

  console.log('📋 تقرير البيانات القديمة:');
  console.log('━'.repeat(50));
  console.log(`🔴 اشتراكات منتهية (أكثر من 60 يوم): ${report.expiredSubscriptions}`);
  console.log(`🔴 معاملات فاشلة قديمة (أكثر من 90 يوم): ${report.oldFailedTransactions}`);
  console.log(`🔴 طلبات سحب مرفوضة (أكثر من 60 يوم): ${report.oldRejectedWithdrawals}`);
  console.log(`🔴 صفقات مغلقة قديمة (أكثر من 90 يوم): ${report.oldClosedTrades}`);
  console.log(`🔴 محللين بدون أسماء: ${report.analystsWithoutNames}`);
  console.log(`🔴 اشتراكات لمحللين محذوفين: ${report.orphanedSubscriptions}`);
  console.log('━'.repeat(50));
  
  const total = Object.values(report).reduce((a, b) => a + b, 0);
  console.log(`\n📊 إجمالي السجلات القديمة: ${total}\n`);
  
  return report;
}

async function cleanupOldData(autoConfirm = false) {
  const report = await analyzeOldData();
  
  const total = Object.values(report).reduce((a, b) => a + b, 0);
  
  if (total === 0) {
    console.log('✨ قاعدة البيانات نظيفة! لا توجد بيانات قديمة للحذف.\n');
    return;
  }

  if (!autoConfirm) {
    console.log('⚠️  لتنفيذ التنظيف، قم بتشغيل: node database-cleanup.js --clean\n');
    return;
  }

  console.log('🧹 بدء عملية التنظيف...\n');

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
  
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  let deletedCount = 0;

  // 1. حذف الاشتراكات المنتهية القديمة
  if (report.expiredSubscriptions > 0) {
    const result1 = await db.collection('analyst_subscriptions').updateMany(
      {
        status: 'active',
        end_date: { $lt: sixtyDaysAgo }
      },
      { $set: { status: 'expired' } }
    );
    console.log(`✅ تم تحديث ${result1.modifiedCount} اشتراك منتهي`);
    deletedCount += result1.modifiedCount;
  }

  // 2. حذف المعاملات الفاشلة القديمة
  if (report.oldFailedTransactions > 0) {
    const result2 = await db.collection('transactions').deleteMany({
      status: 'failed',
      created_at: { $lt: ninetyDaysAgo }
    });
    console.log(`✅ تم حذف ${result2.deletedCount} معاملة فاشلة قديمة`);
    deletedCount += result2.deletedCount;
  }

  // 3. حذف طلبات السحب المرفوضة القديمة
  if (report.oldRejectedWithdrawals > 0) {
    const result3 = await db.collection('withdrawal_requests').deleteMany({
      status: { $in: ['rejected', 'failed'] },
      created_at: { $lt: sixtyDaysAgo }
    });
    console.log(`✅ تم حذف ${result3.deletedCount} طلب سحب مرفوض`);
    deletedCount += result3.deletedCount;
  }

  // 4. حذف الصفقات المغلقة القديمة
  if (report.oldClosedTrades > 0) {
    const result4 = await db.collection('analyst_trades').deleteMany({
      status: 'closed',
      closed_at: { $lt: ninetyDaysAgo }
    });
    console.log(`✅ تم حذف ${result4.deletedCount} صفقة مغلقة قديمة`);
    deletedCount += result4.deletedCount;
  }

  // 5. حذف المحللين بدون أسماء
  if (report.analystsWithoutNames > 0) {
    const result5 = await db.collection('analysts').deleteMany({
      $or: [
        { name: null },
        { name: '' },
        { name: { $exists: false } }
      ]
    });
    console.log(`✅ تم حذف ${result5.deletedCount} محلل بدون اسم`);
    deletedCount += result5.deletedCount;
  }

  // 6. حذف الاشتراكات اليتيمة
  if (report.orphanedSubscriptions > 0) {
    const analystIds = await db.collection('analysts').distinct('_id');
    const result6 = await db.collection('analyst_subscriptions').deleteMany({
      analyst_id: { $nin: analystIds }
    });
    console.log(`✅ تم حذف ${result6.deletedCount} اشتراك يتيم`);
    deletedCount += result6.deletedCount;
  }

  console.log('\n━'.repeat(50));
  console.log(`✨ تم التنظيف بنجاح! إجمالي السجلات المحذوفة/المحدثة: ${deletedCount}`);
  console.log('━'.repeat(50) + '\n');
}

async function optimizeIndexes() {
  console.log('\n🔧 تحسين الفهارس (Indexes)...\n');

  try {
    // إعادة بناء الفهارس للأداء الأفضل
    await db.collection('users').reIndex();
    console.log('✅ تم تحسين فهارس المستخدمين');
    
    await db.collection('analysts').reIndex();
    console.log('✅ تم تحسين فهارس المحللين');
    
    await db.collection('analyst_subscriptions').reIndex();
    console.log('✅ تم تحسين فهارس الاشتراكات');
    
    await db.collection('transactions').reIndex();
    console.log('✅ تم تحسين فهارس المعاملات');
    
    console.log('\n✨ تم تحسين جميع الفهارس بنجاح!\n');
  } catch (error) {
    console.error('❌ خطأ في تحسين الفهارس:', error.message);
  }
}

async function main() {
  try {
    await connectDB();
    
    const args = process.argv.slice(2);
    const shouldClean = args.includes('--clean');
    const shouldOptimize = args.includes('--optimize');
    
    if (shouldOptimize) {
      await optimizeIndexes();
    } else if (shouldClean) {
      await cleanupOldData(true);
    } else {
      await analyzeOldData();
      console.log('💡 خيارات التنظيف:');
      console.log('   node database-cleanup.js --clean      لتنفيذ التنظيف');
      console.log('   node database-cleanup.js --optimize   لتحسين الفهارس\n');
    }
    
  } catch (error) {
    console.error('❌ خطأ:', error);
  } finally {
    if (client) {
      await client.close();
      console.log('👋 تم قطع الاتصال بقاعدة البيانات\n');
    }
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  analyzeOldData,
  cleanupOldData,
  optimizeIndexes
};
