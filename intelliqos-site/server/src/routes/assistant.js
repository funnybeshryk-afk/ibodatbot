const express = require('express');
const db = require('../db');
const assistant = require('../lib/assistant');
const rateLimit = require('../middleware/rateLimit');
const adminAuth = require('../middleware/adminAuth');

const router = express.Router();

router.post('/', rateLimit({ windowMs: 60_000, max: 20 }), async (req, res) => {
  const { message, history, session_id } = req.body || {};

  if (!message || !String(message).trim()) {
    return res.status(400).json({ ok: false, error: 'Пустое сообщение.' });
  }
  if (String(message).length > 1000) {
    return res.status(400).json({ ok: false, error: 'Сообщение слишком длинное.' });
  }

  try {
    const { reply, mode } = await assistant.getReply(message, Array.isArray(history) ? history : []);

    db.prepare(`
      INSERT INTO assistant_logs (created_at, session_id, message, reply, mode)
      VALUES (?, ?, ?, ?, ?)
    `).run(new Date().toISOString(), session_id || '', String(message), reply, mode);

    res.json({ ok: true, reply, mode });
  } catch (e) {
    console.error('Assistant route error:', e);
    res.status(500).json({ ok: false, error: 'Ассистент временно недоступен. Попробуйте ещё раз или напишите нам напрямую.' });
  }
});

// Посмотреть, о чём чаще всего спрашивают — полезно для админки/аналитики.
router.get('/', adminAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM assistant_logs ORDER BY id DESC LIMIT 200').all();
  res.json({ ok: true, logs: rows });
});

module.exports = router;
