const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const verifyTelegram = require('../middleware/auth');

// جلب حالة المكافأة اليومية
router.get('/daily/:address', verifyTelegram, async (req, res) => {
  const { address } = req.params;
  const telegramId = req.telegramUser.id;

  try {
    const { data: wallet } = await supabase
      .from('wallets')
      .select('id, telegram_id')
      .eq('wallet_address', address)
      .single();

    if (!wallet || wallet.telegram_id !== telegramId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { data: reward } = await supabase
      .from('daily_rewards')
      .select('*')
      .eq('wallet_id', wallet.id)
      .single();

    const now = new Date();
    const lastClaimed = reward?.last_claimed ? new Date(reward.last_claimed) : null;
    const canClaim = !lastClaimed || (now - lastClaimed) > 24 * 60 * 60 * 1000;

    const baseReward = 10;
    const streakBonus = (reward?.streak_days || 0) * 2;
    const rewardAmount = baseReward + streakBonus;

    res.json({
      can_claim: canClaim,
      last_claimed: reward?.last_claimed,
      streak_days: reward?.streak_days || 0,
      reward_amount: rewardAmount
    });

  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// المطالبة بالمكافأة
router.post('/daily/claim', verifyTelegram, async (req, res) => {
  const { address } = req.body;
  const telegramId = req.telegramUser.id;

  try {
    const { data: wallet } = await supabase
      .from('wallets')
      .select('id, telegram_id, balance, total_earned')
      .eq('wallet_address', address)
      .single();

    if (!wallet || wallet.telegram_id !== telegramId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { data: reward } = await supabase
      .from('daily_rewards')
      .select('*')
      .eq('wallet_id', wallet.id)
      .single();

    const now = new Date();
    const lastClaimed = reward?.last_claimed ? new Date(reward.last_claimed) : null;

    if (lastClaimed && (now - lastClaimed) < 24 * 60 * 60 * 1000) {
      return res.status(400).json({ error: 'Already claimed today' });
    }

    const baseReward = 10;
    let streakDays = reward?.streak_days || 0;

    if (lastClaimed && (now - lastClaimed) < 48 * 60 * 60 * 1000) {
      streakDays += 1;
    } else {
      streakDays = 0;
    }

    const streakBonus = streakDays * 2;
    const rewardAmount = baseReward + streakBonus;

    const newBalance = wallet.balance + rewardAmount;
    const newTotalEarned = wallet.total_earned + rewardAmount;

    await supabase
      .from('wallets')
      .update({ balance: newBalance, total_earned: newTotalEarned, updated_at: now })
      .eq('id', wallet.id);

    await supabase
      .from('daily_rewards')
      .update({ last_claimed: now, streak_days: streakDays })
      .eq('wallet_id', wallet.id);

    await supabase.from('transactions').insert({
      to_wallet: wallet.id,
      amount: rewardAmount,
      type: 'reward'
    });

    res.json({
      success: true,
      reward_amount: rewardAmount,
      new_balance: newBalance,
      streak_days: streakDays
    });

  } catch (error) {
    res.status(500).json({ error: 'Claim failed' });
  }
});

module.exports = router;
