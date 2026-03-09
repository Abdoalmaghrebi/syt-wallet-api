const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

// ✅ تسجيل إحالة (بدون verifyTelegram لأنه من البوت)
router.post('/register', async (req, res) => {
  const { new_user_id, referral_code } = req.body;

  console.log('📥 Register:', { new_user_id, referral_code });

  if (!new_user_id || !referral_code) {
    return res.status(400).json({ error: 'Missing data' });
  }

  try {
    // جلب المحيل
    const { data: referrer, error: referrerError } = await supabase
      .from('wallets')
      .select('id')
      .eq('referral_code', referral_code)
      .single();

    if (referrerError || !referrer) {
      console.log('❌ Invalid referral code');
      return res.status(404).json({ error: 'Invalid referral code' });
    }

    // التحقق من عدم التكرار
    const { data: existing } = await supabase
      .from('referrals')
      .select('*')
      .eq('referred_id', new_user_id)
      .single();

    if (existing) {
      console.log('⚠️ Already referred');
      return res.status(400).json({ error: 'Already referred' });
    }

    // إنشاء الإحالة
    const { data: referral, error: insertError } = await supabase
      .from('referrals')
      .insert({
        referrer_id: referrer.id,
        referred_id: new_user_id,
        reward_amount: 50,
        is_rewarded: false
      })
      .select()
      .single();

    if (insertError) throw insertError;

    console.log('✅ Referral created:', referral);
    res.json({ success: true, referral });

  } catch (error) {
    console.error('❌ Register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// إحصائيات (محمي)
const verifyTelegram = require('../middleware/auth');
router.get('/stats/:address', verifyTelegram, async (req, res) => {
  // ... الكود السابق
});

module.exports = router;
