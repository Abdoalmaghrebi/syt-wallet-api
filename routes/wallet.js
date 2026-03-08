const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const verifyTelegram = require('../middleware/auth');

// جلب بيانات المحفظة
router.get('/:address', verifyTelegram, async (req, res) => {
  const { address } = req.params;
  const telegramId = req.telegramUser.id;

  try {
    const { data: wallet, error } = await supabase
      .from('wallets')
      .select('*')
      .eq('wallet_address', address)
      .single();

    if (error || !wallet) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    if (wallet.telegram_id !== telegramId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({
      address: wallet.wallet_address,
      balance: wallet.balance,
      total_earned: wallet.total_earned,
      referral_code: wallet.referral_code
    });

  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// التحويل
router.post('/transfer', verifyTelegram, async (req, res) => {
  const { to_address, amount } = req.body;
  const telegramId = req.telegramUser.id;

  if (!to_address || !amount || amount <= 0) {
    return res.status(400).json({ error: 'Invalid data' });
  }

  try {
    const { data: fromWallet, error: fromError } = await supabase
      .from('wallets')
      .select('*')
      .eq('telegram_id', telegramId)
      .single();

    if (fromError || !fromWallet) {
      return res.status(404).json({ error: 'Sender not found' });
    }

    // منع التحويل لنفس المحفظة
    if (fromWallet.wallet_address === to_address) {
      return res.status(400).json({ error: 'Cannot transfer to same wallet' });
    }

    if (fromWallet.balance < amount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    const { data: toWallet, error: toError } = await supabase
      .from('wallets')
      .select('*')
      .eq('wallet_address', to_address)
      .single();

    if (toError || !toWallet) {
      return res.status(404).json({ error: 'Recipient not found' });
    }

    const newFromBalance = fromWallet.balance - amount;
    const newToBalance = toWallet.balance + amount;

    await supabase
      .from('wallets')
      .update({ balance: newFromBalance, updated_at: new Date() })
      .eq('id', fromWallet.id);

    await supabase
      .from('wallets')
      .update({ balance: newToBalance, updated_at: new Date() })
      .eq('id', toWallet.id);

    await supabase.from('transactions').insert({
      from_wallet: fromWallet.id,
      to_wallet: toWallet.id,
      amount: amount,
      type: 'transfer'
    });

    res.json({
      success: true,
      new_balance: newFromBalance
    });

  } catch (error) {
    res.status(500).json({ error: 'Transfer failed' });
  }
});

module.exports = router;
