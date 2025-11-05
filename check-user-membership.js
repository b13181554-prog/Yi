#!/usr/bin/env node

/**
 * التحقق من عضوية المستخدم في القناة
 */

const readline = require('readline');
const axios = require('axios');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID || '-1002776929451';

async function checkUserMembership(userId) {
  try {
    const response = await axios.get(
      `https://api.telegram.org/bot${BOT_TOKEN}/getChatMember?chat_id=${CHANNEL_ID}&user_id=${userId}`
    );
    
    const status = response.data.result.status;
    const user = response.data.result.user;
    
    console.log('\n============================================================');
    console.log('📊 حالة المستخدم في القناة');
    console.log('============================================================');
    console.log(`👤 User ID: ${userId}`);
    console.log(`👤 الاسم: ${user.first_name} ${user.last_name || ''}`);
    console.log(`👤 Username: @${user.username || 'N/A'}`);
    console.log(`📋 الحالة: ${status}`);
    console.log('');
    
    if (['member', 'administrator', 'creator'].includes(status)) {
      console.log('✅ المستخدم عضو في القناة - البوت سيرد عليه');
    } else {
      console.log('❌ المستخدم ليس عضواً في القناة - البوت لن يرد عليه');
      console.log('');
      console.log('📝 الحل:');
      console.log('   1. اشترك في القناة أولاً');
      console.log(`   2. رابط القناة: https://t.me/${CHANNEL_ID.replace('@', '')}`);
      console.log('   3. بعد الاشتراك، أرسل /start للبوت');
    }
    console.log('============================================================\n');
    
  } catch (error) {
    if (error.response && error.response.data.description.includes('PARTICIPANT_ID_INVALID')) {
      console.log('\n============================================================');
      console.log('❌ المستخدم غير موجود');
      console.log('============================================================');
      console.log('المستخدم لم يتفاعل مع البوت بعد أو User ID خاطئ');
      console.log('');
      console.log('📝 للحصول على User ID الخاص بك:');
      console.log('   1. أرسل /start لبوت @userinfobot على Telegram');
      console.log('   2. سيعطيك User ID الخاص بك');
      console.log('   3. استخدمه هنا');
      console.log('============================================================\n');
    } else {
      console.log('\n❌ خطأ:', error.message);
      if (error.response) {
        console.log('📝 التفاصيل:', error.response.data);
      }
      console.log('');
    }
  }
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('\n🔍 التحقق من عضوية المستخدم في القناة\n');
console.log(`📡 القناة: ${CHANNEL_ID}\n`);

rl.question('أدخل User ID الخاص بك (أو اضغط Enter لاستخدام OWNER_ID): ', async (userInput) => {
  const userId = userInput.trim() || process.env.OWNER_ID || '7594466342';
  console.log(`\n🔍 التحقق من User ID: ${userId}...\n`);
  
  await checkUserMembership(userId);
  
  rl.close();
});
