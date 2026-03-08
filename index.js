require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

// CORS
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-Telegram-Init-Data']
}));

app.use(express.json());

// Routes
app.get('/health', (req, res) => {
  res.json({ status: 'OK', time: new Date() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 API on port ${PORT}`);
});
