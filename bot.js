require('dotenv').config();

const { Telegraf } = require('telegraf');
const axios = require('axios');
const http = require('http');

const bot = new Telegraf(process.env.BOT_TOKEN);

const API_URL = process.env.API_URL;
const MINI_APP_URL = process.env.MINI_APP_URL;

// Port وهمي للـ Render
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200);
  res.end('SYT Wallet Bot is running!');
}).listen(PORT, () => {
  console.log(`🌐 Web server on port ${PORT}`);
});

// /start - تسجيل إحالة + فتح Mini App
bot.start(async (ctx) => {
  console.log('📝 /start received');
  console.log('👤 User:', ctx.from.id);
  console.log('🔗 Payload:', ctx.payload);
  
  const startPayload = ctx.payload; // referral_code
  const telegramId = ctx.from.id;
  
  try {
    // ✅ جلب أو إنشاء wallet للمستخدم
    console.log('🔍 Fetching wallet...');
    
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    // البحث عن المحفظة
    let { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('id, wallet_address')
      .eq('telegram_id', telegramId)
      .single();
    
    let walletId;
    
    // إنشاء محفظة جديدة إذا لم exist
    if (walletError || !wallet) {
      console.log('⚠️ Creating new wallet...');
      
      const { data: newWallet, error: createError } = await supabase
        .from('wallets')
        .insert({
          telegram_id: telegramId,
          balance: 0,
          total_earned: 0
        })
        .select()
        .single();
      
      if (createError) {
        console.error('❌ Create wallet error:', createError);
        throw createError;
      }
      
      walletId = newWallet.id;
      console.log('✅ Created wallet:', walletId);
      
      // إنشاء سجل المكافآت اليومية
      await supabase.from('daily_rewards').insert({
        wallet_id: walletId
      });
      
    } else {
      walletId = wallet.id;
      console.log('✅ Found wallet:', walletId);
    }
    
    // ✅ تسجيل الإحالة باستخدام wallet_id (UUID)
    if (startPayload) {
      console.log('📤 Sending referral with wallet_id:', walletId);
      
      try {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const response = await axios.post(`${API_URL}/api/referrals/register`, {
          new_user_id: walletId,  // ✅ UUID بدلاً من telegramId
          referral_code: startPayload
        }, {
          timeout: 5000,
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        console.log('✅ Referral success:', response.data);
        
      } catch (apiError) {
        console.log('❌ API error:', apiError.message);
        if (apiError.response) {
          console.log('Status:', apiError.response.status);
          console.log('Data:', apiError.response.data);
        }
        // لا نوقف البوت إذا فشلت الإحالة
      }
    }
    
    // ✅ إرسال رسالة الترحيب
    console.log('📤 Sending welcome message...');
    
    await ctx.reply(
      '👋 مرحباً بك في SYT Wallet!\n\n' +
      '💰 اربح العملات من المكافآت اليومية والمهام\n' +
      '👥 ادعو أصدقاءك واحصل على 50 SYT لكل صديق\n\n' +
      'اضغط الزر أدناه لفتح محفظتك:',
      {
        reply_markup: {
          inline_keyboard: [[
            { 
              text: '💼 فتح المحفظة', 
              web_app: { url: MINI_APP_URL } 
            }
          ]]
        }
      }
    );
    
    console.log('✅ Message sent');
    
  } catch (error) {
    console.error('❌ Error in /start:', error);
    await ctx.reply('❌ حدث خطأ. جرب مرة أخرى.');
  }
});

// معالجة الأخطاء
bot.catch((err, ctx) => {
  console.error('❌ Bot error:', err);
});

// تشغيل البوت
bot.launch()
  .then(() => console.log('🤖 Bot started'))
  .catch(err => console.error('❌ Launch error:', err));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
