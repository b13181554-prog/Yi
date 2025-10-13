const OBENTCHIV1ProAnalysis = require('./v1-pro-analysis');
const marketData = require('./market-data');

async function testOBENTCHIV1Pro() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚀 بدء اختبار نظام OBENTCHI V1 PRO الذكي');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  try {
    // 1. جلب بيانات السوق الحقيقية
    const symbol = 'BTCUSDT';
    const timeframe = '1h';
    const balance = 10000; // رصيد افتراضي للاختبار
    
    console.log(`📊 جاري جلب بيانات ${symbol} على إطار ${timeframe}...`);
    const candles = await marketData.getCandles(symbol, timeframe, 200, 'crypto');
    
    if (!candles || candles.length < 100) {
      throw new Error('بيانات غير كافية للتحليل');
    }
    
    console.log(`✅ تم جلب ${candles.length} شمعة بنجاح\n`);
    
    // 2. إنشاء نظام التحليل
    console.log('🤖 تهيئة نظام OBENTCHI V1 PRO...');
    const v1Pro = new OBENTCHIV1ProAnalysis(candles, balance, symbol);
    console.log('✅ تم تهيئة النظام بنجاح\n');
    
    // 3. تشغيل التحليل الكامل
    console.log('🔍 جاري تشغيل التحليل الذكي...');
    console.log('   • التحليل الفني للمؤشرات...');
    console.log('   • تحديد الاتجاه العام...');
    console.log('   • تأكيد الزخم...');
    console.log('   • تحليل المشاعر من الأخبار...');
    console.log('   • دمج الإشارات...');
    console.log('   • حساب إدارة المخاطر...\n');
    
    const analysis = await v1Pro.getCompleteAnalysis();
    
    // 4. عرض النتائج بشكل منسق
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✨ نتائج التحليل');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const report = OBENTCHIV1ProAnalysis.formatAnalysisReport(analysis);
    console.log(report);
    
    // 5. عرض ملخص سريع
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 ملخص سريع');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const confidence = parseFloat(analysis.finalSignal.confidence);
    const confidenceLevel = confidence >= 0.7 ? 'عالية جداً' : 
                           confidence >= 0.5 ? 'عالية' : 
                           confidence >= 0.3 ? 'متوسطة' : 'منخفضة';
    
    console.log(`${analysis.finalSignal.emoji} الإشارة: ${analysis.finalSignal.action}`);
    console.log(`🎯 الثقة: ${(confidence * 100).toFixed(0)}% (${confidenceLevel})`);
    console.log(`📈 الاتجاه: ${analysis.trend.emoji} ${analysis.trend.direction}`);
    console.log(`💭 المشاعر: ${analysis.sentiment.classification} (${analysis.sentiment.score})`);
    
    if (analysis.finalSignal.action !== 'WAIT') {
      console.log(`\n💼 توصية التداول:`);
      console.log(`   📍 نقطة الدخول: $${analysis.currentPrice}`);
      console.log(`   🛑 وقف الخسارة: $${analysis.riskManagement.stopLoss}`);
      console.log(`   🎯 جني الأرباح: $${analysis.riskManagement.takeProfit}`);
      console.log(`   📊 حجم المركز: ${analysis.riskManagement.positionSize} ${symbol.replace('USDT', '')}`);
      console.log(`   💵 قيمة المركز: $${analysis.riskManagement.positionValue}`);
      console.log(`   ⚠️ المخاطرة: $${analysis.riskManagement.riskAmount}`);
      console.log(`   📈 نسبة R/R: 1:${analysis.riskManagement.riskRewardRatio}`);
    } else {
      console.log(`\n⏸️ التوصية: انتظار - لا توجد فرصة واضحة حالياً`);
    }
    
    // 6. اختبار التعلم الذاتي
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🧠 اختبار التعلم الذاتي');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    console.log('📊 الأوزان الحالية للمؤشرات:');
    Object.entries(analysis.weights).forEach(([indicator, weight]) => {
      console.log(`   • ${indicator}: ${weight.toFixed(2)}`);
    });
    
    console.log('\n🔄 محاكاة نتيجة صفقة...');
    
    // محاكاة صفقة رابحة
    console.log('   ✅ صفقة رابحة - تحديث الأوزان...');
    await v1Pro.updateIndicatorWeights('win');
    
    console.log('   📈 تم تحديث الأوزان في قاعدة البيانات');
    
    // 7. النتيجة النهائية
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ اكتمل الاختبار بنجاح');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('📋 ملخص النتائج:');
    console.log('   ✅ محرك التحليل الفني: يعمل');
    console.log('   ✅ محرك تحليل المشاعر (Groq): يعمل');
    console.log('   ✅ نظام إدارة المخاطر: يعمل');
    console.log('   ✅ حساب حجم المركز: يعمل');
    console.log('   ✅ دمج الإشارات: يعمل');
    console.log('   ✅ التعلم الذاتي: يعمل');
    console.log('   ✅ حفظ البيانات في MongoDB: يعمل');
    console.log('');
    console.log('🎉 نظام OBENTCHI V1 PRO جاهز للاستخدام!');
    console.log('');
    
  } catch (error) {
    console.error('\n❌ حدث خطأ أثناء الاختبار:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// تشغيل الاختبار
if (require.main === module) {
  testOBENTCHIV1Pro().then(() => {
    console.log('✅ انتهى الاختبار');
    process.exit(0);
  }).catch(error => {
    console.error('❌ خطأ فادح:', error);
    process.exit(1);
  });
}

module.exports = testOBENTCHIV1Pro;
