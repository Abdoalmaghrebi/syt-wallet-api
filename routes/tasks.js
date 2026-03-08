const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const verifyTelegram = require('../middleware/auth');

// جلب المهام
router.get('/list/:address', verifyTelegram, async (req, res) => {
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

    const { data: tasks, error } = await supabase
      .from('tasks')
      .select(`*, user_tasks!inner(status)`)
      .eq('user_tasks.wallet_id', wallet.id)
      .eq('is_active', true);

    if (error) throw error;

    if (!tasks || tasks.length === 0) {
      const { data: allTasks } = await supabase
        .from('tasks')
        .select('*')
        .eq('is_active', true);

      for (const task of allTasks) {
        await supabase.from('user_tasks').insert({
          wallet_id: wallet.id,
          task_id: task.id,
          status: 'pending'
        });
      }

      const { data: newTasks } = await supabase
        .from('tasks')
        .select(`*, user_tasks!inner(status)`)
        .eq('user_tasks.wallet_id', wallet.id)
        .eq('is_active', true);

      return res.json(newTasks);
    }

    res.json(tasks);

  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// إكمال مهمة
router.post('/complete', verifyTelegram, async (req, res) => {
  const { address, task_id } = req.body;
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

    const { data: userTask, error } = await supabase
      .from('user_tasks')
      .select('*, task:tasks(*)')
      .eq('wallet_id', wallet.id)
      .eq('task_id', task_id)
      .single();

    if (error || !userTask) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (userTask.status !== 'pending') {
      return res.status(400).json({ error: 'Task already processed' });
    }

    await supabase
      .from('user_tasks')
      .update({ status: 'completed', completed_at: new Date() })
      .eq('id', userTask.id);

    res.json({ success: true, message: 'Task completed' });

  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// المطالبة بمكافأة مهمة
router.post('/claim', verifyTelegram, async (req, res) => {
  const { address, task_id } = req.body;
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

    const { data: userTask } = await supabase
      .from('user_tasks')
      .select('*, task:tasks(*)')
      .eq('wallet_id', wallet.id)
      .eq('task_id', task_id)
      .single();

    if (!userTask || userTask.status !== 'completed') {
      return res.status(400).json({ error: 'Task not completed' });
    }

    if (userTask.status === 'claimed') {
      return res.status(400).json({ error: 'Reward already claimed' });
    }

    const rewardAmount = userTask.task.reward_amount;

    await supabase
      .from('wallets')
      .update({
        balance: wallet.balance + rewardAmount,
        total_earned: wallet.total_earned + rewardAmount,
        updated_at: new Date()
      })
      .eq('id', wallet.id);

    await supabase
      .from('user_tasks')
      .update({ status: 'claimed', claimed_at: new Date() })
      .eq('id', userTask.id);

    await supabase.from('transactions').insert({
      to_wallet: wallet.id,
      amount: rewardAmount,
      type: 'task'
    });

    res.json({
      success: true,
      reward_amount: rewardAmount,
      new_balance: wallet.balance + rewardAmount
    });

  } catch (error) {
    res.status(500).json({ error: 'Claim failed' });
  }
});

module.exports = router;
