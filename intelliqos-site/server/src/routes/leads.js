const express = require('express');
const db = require('../db');
const adminAuth = require('../middleware/adminAuth');

const router = express.Router();

// Приём заявки с сайта: консультация, запрос демо, заказ выезда с установкой и т.д.
router.post('/', (req, res) => {
  const { kind, product, tier, price, name, contact, address, message } = req.body || {};

  if (!contact || !String(contact).trim()) {
    return res.status(400).json({ ok: false, error: 'Укажите телефон или Telegram для связи.' });
  }

  const stmt = db.prepare(`
    INSERT INTO leads (created_at, kind, product, tier, price, name, contact, address, message, status)
    VALUES (@created_at, @kind, @product, @tier, @price, @name, @contact, @address, @message, 'new')
  `);

  const info = stmt.run({
    created_at: new Date().toISOString(),
    kind: kind || 'consult',
    product: product || '',
    tier: tier || '',
    price: price || '',
    name: name || '',
    contact: String(contact).trim(),
    address: address || '',
    message: message || ''
  });

  // Точка расширения: здесь можно отправить уведомление в Telegram-бот или на email
  // (например, через nodemailer или Telegram Bot API), когда появятся нужные токены.
  // Пока заявка надёжно сохраняется в базе — ничего не теряется, даже без уведомлений.

  res.json({ ok: true, id: info.lastInsertRowid });
});

// Список заявок — только для админки (см. adminAuth).
router.get('/', adminAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM leads ORDER BY id DESC LIMIT 200').all();
  res.json({ ok: true, leads: rows });
});

// Смена статуса заявки (new -> contacted -> closed) из админки.
router.patch('/:id', adminAuth, (req, res) => {
  const { status } = req.body || {};
  if (!['new', 'contacted', 'closed'].includes(status)) {
    return res.status(400).json({ ok: false, error: 'Недопустимый статус.' });
  }
  db.prepare('UPDATE leads SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ ok: true });
});

module.exports = router;
