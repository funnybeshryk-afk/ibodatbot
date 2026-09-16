require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const leadsRouter = require('./routes/leads');
const ordersRouter = require('./routes/orders');
const assistantRouter = require('./routes/assistant');
const payme = require('./lib/payme');
const click = require('./lib/click');
const assistant = require('./lib/assistant');

const app = express();
app.set('trust proxy', true); // чтобы rate-limit видел реальный IP за nginx на проде
app.use(cors());
app.use(express.json());

// API
app.use('/api/leads', leadsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/assistant', assistantRouter);
app.use('/api/payments/payme', payme.router);
app.use('/api/payments/click', click.router);

app.get('/api/status', (req, res) => {
  res.json({
    ok: true,
    payme: payme.isConfigured(),
    click: click.isConfigured(),
    assistant: assistant.isAiConfigured() ? 'ai' : 'rules'
  });
});

// Статический сайт (public/index.html — витрина, public/admin.html — список заявок и заказов)
const PUBLIC_DIR = path.join(__dirname, '..', '..', 'public');
app.use(express.static(PUBLIC_DIR));

app.get('/*splat', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Intelliqos сайт запущен: http://localhost:${PORT}`);
  console.log(`Payme: ${payme.isConfigured() ? 'настроен' : 'не настроен (тестовый режим)'}`);
  console.log(`Click: ${click.isConfigured() ? 'настроен' : 'не настроен (тестовый режим)'}`);
});
