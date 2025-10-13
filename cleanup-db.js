const { initDatabase, getDB } = require('./database');

async function cleanup() {
    try {
        console.log('\n📊 جاري تحليل قاعدة البيانات...\n');
        console.log('='.repeat(70));
        
        const database = getDB();
        const collections = ['users', 'transactions', 'withdrawal_requests', 'analysts', 'analyst_subscriptions', 'referrals'];
        
        for (const collName of collections) {
            try {
                const count = await database.collection(collName).countDocuments();
                let sizeMB = '0.00';
                try {
                    const stats = await database.collection(collName).stats();
                    sizeMB = (stats.size / 1024 / 1024).toFixed(2);
                } catch (err) {
                    // إذا لم يكن هناك stats، استخدم 0
                }
                console.log(`📁 ${collName.padEnd(30)} | ${count.toString().padStart(8)} سجل | ${sizeMB.padStart(8)} MB`);
            } catch (err) {
                console.log(`📁 ${collName.padEnd(30)} | ${err.message}`);
            }
        }
        
        console.log('='.repeat(70));
        
        // تفاصيل إضافية
        const testUsers = await database.collection('users').countDocuments({ 
            balance: 0,
            $or: [
                { premium_until: { $exists: false } },
                { premium_until: null },
                { premium_until: { $lt: new Date() } }
            ]
        });
        
        const oldTransactions = await database.collection('transactions').countDocuments({ 
            created_at: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } 
        });
        
        const oldCompletedWithdrawals = await database.collection('withdrawal_requests').countDocuments({ 
            status: 'completed',
            updated_at: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        });
        
        console.log('\n📈 تفاصيل البيانات القابلة للحذف:\n');
        console.log(`👥 مستخدمين فارغين (اختبار):           ${testUsers}`);
        console.log(`💰 معاملات قديمة (+30 يوم):           ${oldTransactions}`);
        console.log(`💸 سحوبات مكتملة قديمة (+30 يوم):     ${oldCompletedWithdrawals}`);
        console.log('='.repeat(70));
        
        // التنظيف
        console.log('\n🧹 بدء عملية التنظيف...\n');
        
        // 1. حذف المستخدمين الفارغين
        const deleteUsers = await database.collection('users').deleteMany({ 
            balance: 0,
            $or: [
                { premium_until: { $exists: false } },
                { premium_until: null },
                { premium_until: { $lt: new Date() } }
            ]
        });
        console.log(`✅ تم حذف ${deleteUsers.deletedCount} مستخدم فارغ (اختبار)`);
        
        // 2. حذف المعاملات القديمة
        const deleteTransactions = await database.collection('transactions').deleteMany({ 
            created_at: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } 
        });
        console.log(`✅ تم حذف ${deleteTransactions.deletedCount} معاملة قديمة (+30 يوم)`);
        
        // 3. حذف السحوبات المكتملة القديمة
        const deleteWithdrawals = await database.collection('withdrawal_requests').deleteMany({ 
            status: 'completed',
            updated_at: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        });
        console.log(`✅ تم حذف ${deleteWithdrawals.deletedCount} سحب مكتمل قديم (+30 يوم)`);
        
        console.log('\n✨ تم إكمال التنظيف بنجاح!\n');
        console.log('='.repeat(70));
        
        // إحصائيات بعد التنظيف
        console.log('\n📊 قاعدة البيانات بعد التنظيف:\n');
        
        for (const collName of collections) {
            try {
                const count = await database.collection(collName).countDocuments();
                let sizeMB = '0.00';
                try {
                    const stats = await database.collection(collName).stats();
                    sizeMB = (stats.size / 1024 / 1024).toFixed(2);
                } catch (err) {
                    // إذا لم يكن هناك stats، استخدم 0
                }
                console.log(`📁 ${collName.padEnd(30)} | ${count.toString().padStart(8)} سجل | ${sizeMB.padStart(8)} MB`);
            } catch (err) {
                console.log(`📁 ${collName.padEnd(30)} | ${err.message}`);
            }
        }
        
        console.log('='.repeat(70));
        console.log('\n✅ عملية التنظيف اكتملت بنجاح!\n');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ خطأ في التنظيف:', error);
        process.exit(1);
    }
}

// الاتصال بقاعدة البيانات ثم التنظيف
(async () => {
    await initDatabase();
    await cleanup();
})();
