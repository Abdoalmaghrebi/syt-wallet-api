const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const verifyTelegram = require('../middleware/auth');

// تسجيل إحالة جديدة (من البوت)
router.post('/register', async (req, res) => {
  const { new_user_id, referral_code } = req.body;

  if (!new_user_id || !referral_code) {
    return res.status(400).json({ error: 'Missing data' });
  }

  try {
    const { data: referrer, error: referrerError } = await supabase
      .from('wallets')
      .select('id')
      .eq('referral_code', referral_code)
      .single();

    if (referrerError || !referrer) {
      return res.status(404).json({ error: 'Invalid referral code' });
    }

    const { data: existing } = await supabase
      .from('referrals')
      .select('*')
      .eq('referred_id', new_user_id)
      .single();

    if (existing) {
      return res.status(400).json({ error: 'Already referred' });
    }

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

    res.json({ success: true, referral });

  } catch (error) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

// إحصائيات الإحالات
router.get('/stats/:address', verifyTelegram, async (req, res) => {
  const { address } = req.params;
  const telegramId = req.telegramUser.id;

  try {
    const { data: wallet } = await supabase
      .from('wallets')
      .select('id, telegram_id, referral_code')
      .eq('wallet_address', address)
      .single();

    if (!wallet || wallet.telegram_id !== telegramId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { data: referrals, error } = await supabase
      .from('referrals')
      .select(`*, referred:wallets!referrals_referred_id_fkey(wallet_address, created_at)`)
      .eq('referrer_id', wallet.id);

    if (error) throw error;

    const totalReferrals = referrals?.length || 0;
    const totalRewards = referrals?.reduce((sum, ref) => 
      sum + (ref.is_rewarded ? ref.reward_amount : 0), 0) || 0;

    const botUsername = process.env.BOT_USERNAME || 'SYT_Token_bot';
    const referralLink = `https://t.me/${botUsername}?start=${wallet.referral_code}`;

    res.json({
      referral_code: wallet.referral_code,
      referral_link: referralLink,
      total_referrals: totalReferrals,
      total_rewards: totalRewards,
      referrals: referrals || []
    });

  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
