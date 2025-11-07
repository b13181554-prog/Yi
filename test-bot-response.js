#!/usr/bin/env node

/**
 * اختبار استجابة البوت
 */

const axios = require('axios');

const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'obentchi_webhook_secret_2025';

async function testBotResponse() {
  console.log('🔍 اختبار استجابة البوت...\n');
  
  // 1. التحقق من حالة البوت
  console.log('1️⃣ التحقق من حالة البوت...');
  try {
    const botInfo = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`);
    console.log(`   ✅ البوت نشط: @${botInfo.data.result.username}`);
    console.log(`   📝 الاسم: ${botInfo.data.result.first_name}\n`);
  } catch (error) {
    console.log(`   ❌ خطأ في الاتصال بالبوت: ${error.message}\n`);
    return;
  }
  
  // 2. التحقق من Webhook
  console.log('2️⃣ التحقق من Webhook...');
  try {
    const webhookInfo = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
    const info = webhookInfo.data.result;
    
    console.log(`   📡 Webhook URL: ${info.url}`);
    console.log(`   📊 الرسائل المعلقة: ${info.pending_update_count}`);
    console.log(`   🔗 IP Address: ${info.ip_address || 'N/A'}`);
    
    if (info.last_error_message) {
      console.log(`   ⚠️ آخر خطأ: ${info.last_error_message}`);
      console.log(`   🕒 تاريخ الخطأ: ${new Date(info.last_error_date * 1000).toLocaleString()}`);
    } else {
      console.log(`   ✅ لا توجد أخطاء`);
    }
    console.log('');
  } catch (error) {
    console.log(`   ❌ خطأ في الحصول على معلومات Webhook: ${error.message}\n`);
    return;
  }
  
  // 3. اختبار HTTP Server المحلي
  console.log('3️⃣ اختبار HTTP Server المحلي...');
  try {
    const health = await axios.get('http://localhost:5000/api/health');
    console.log(`   ✅ HTTP Server يعمل`);
    console.log(`   ⏱️ Uptime: ${Math.floor(health.data.uptime)} ثانية`);
    console.log(`   🗄️ Database: ${health.data.database}\n`);
  } catch (error) {
    console.log(`   ❌ HTTP Server لا يعمل: ${error.message}\n`);
    return;
  }
  
  // 4. اختبار استقبال Webhook (محاكاة رسالة)
  console.log('4️⃣ اختبار استقبال Webhook (محاكاة رسالة /start)...');
  try {
    const testUpdate = {
      update_id: 999999999,
      message: {
        message_id: 1,
        from: {
          id: 123456789,
          is_bot: false,
          first_name: "Test",
          username: "testuser",
          language_code: "ar"
        },
        chat: {
          id: 123456789,
          first_name: "Test",
          username: "testuser",
          type: "private"
        },
        date: Math.floor(Date.now() / 1000),
        text: "/start"
      }
    };
    
    const response = await axios.post('http://localhost:5000/webhook', testUpdate, {
      headers: {
        'Content-Type': 'application/json',
        'X-Telegram-Bot-Api-Secret-Token': WEBHOOK_SECRET
      }
    });
    
    if (response.status === 200) {
      console.log(`   ✅ الـ webhook استقبل الرسالة بنجاح`);
      console.log(`   📝 Response: ${JSON.stringify(response.data)}\n`);
    } else {
      console.log(`   ⚠️ استجابة غير متوقعة: ${response.status}\n`);
    }
  } catch (error) {
    if (error.response) {
      console.log(`   ❌ خطأ في الـ webhook: ${error.response.status} - ${error.response.statusText}`);
      console.log(`   📝 التفاصيل: ${JSON.stringify(error.response.data)}\n`);
    } else {
      console.log(`   ❌ خطأ في الاتصال: ${error.message}\n`);
    }
    return;
  }
  
  console.log('============================================================');
  console.log('✅ اكتمل الاختبار');
  console.log('============================================================\n');
  console.log('📋 الملاحظات:');
  console.log('   - إذا استقبل الـ webhook الرسالة، البوت يعمل بشكل صحيح');
  console.log('   - إذا لم يرد البوت على Telegram، تحقق من OWNER_ID في المتغيرات');
  console.log('   - جرّب إرسال /start من حسابك على Telegram');
  console.log('');
}

testBotResponse().catch(console.error);
