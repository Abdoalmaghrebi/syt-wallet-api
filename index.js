require('dotenv').config();
const express = require('express');
const cors = require('express');

// ✅ استيراد البوت
const bot = require('./bot');

const authRoutes = require('./routes/auth');
const walletRoutes = require('./routes/wallet');
const rewardRoutes = require('./routes/rewards');
const taskRoutes = require('./routes/tasks');
const referralRoutes = require('./routes/referrals');

const app = express();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-Telegram-Init-Data']
}));

app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/rewards', rewardRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/referrals', referralRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'SYT Wallet API + Bot', status: 'running' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', time: new Date() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 API + Bot on port ${PORT}`);
});
