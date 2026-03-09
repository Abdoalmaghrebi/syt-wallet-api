require('dotenv').config();

const { Telegraf } = require('telegraf');
const axios = require('axios');

const bot = new Telegraf(process.env.BOT_TOKEN);

const API_URL = `http://localhost:${process.env.PORT || 3000}`;
const MINI_APP_URL = process.env.MINI_APP_URL;

// /start - تسجيل إحالة + فتح Mini App
bot.start(async (ctx) => {
  const startPayload = ctx.payload;
  const telegramId = ctx.from.id;
  
  console.log('📝 /start:', telegramId, 'Payload:', startPayload);
  
  // تسجيل الإحالة
  if (startPayload) {
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const response = await axios.post(`${API_URL}/api/referrals/register`, {
        new_user_id: telegramId,
        referral_code: startPayload
      });
      
      console.log('✅ Referral success:', response.data);
    } catch (error) {
      console.log('❌ Referral error:', error.message);
    }
  }
  
  // إرسال رسالة
  await ctx.reply(
    '👋 مرحباً بك في SYT Wallet!',
    {
      reply_markup: {
        inline_keyboard: [[
          { text: '💼 فتح المحفظة', web_app: { url: MINI_APP_URL } }
        ]]
      }
    }
  );
});

// تشغيل البوت
bot.launch()
  .then(() => console.log('🤖 Bot started'))
  .catch(err => console.error('❌ Bot error:', err));

module.exports = bot;
