const { MongoClient } = require('mongodb');

const uri = `mongodb+srv://${process.env.MONGODB_USER}:${process.env.MONGODB_PASSWORD}@${process.env.MONGODB_CLUSTER}/obentchi_bot?retryWrites=true&w=majority&appName=Cluster0`;

console.log('محاولة الاتصال بقاعدة البيانات...');
console.log('URI:', uri.replace(process.env.MONGODB_PASSWORD, '***'));

const client = new MongoClient(uri, {
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 10000,
  tls: true,
});

client.connect()
  .then(() => {
    console.log('✅ الاتصال نجح!');
    return client.db().admin().ping();
  })
  .then((result) => {
    console.log('✅ Ping نجح:', JSON.stringify(result));
    return client.close();
  })
  .then(() => {
    console.log('✅ تم إغلاق الاتصال بنجاح');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ فشل الاتصال:', error.message);
    console.error('الكود:', error.code);
    console.error('التفاصيل الكاملة:', error);
    process.exit(1);
  });
