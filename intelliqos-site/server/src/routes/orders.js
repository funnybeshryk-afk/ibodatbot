const express = require('express');
const db = require('../db');
const adminAuth = require('../middleware/adminAuth');
const payme = require('../lib/payme');
const click = require('../lib/click');

const router = express.Router();

// Создание заказа с сайта (кнопки "Оплатить" / "Купить и активировать").
router.post('/', (req, res) => {
  const { product, tier, amount_uzs, phone, payment_method } = req.body || {};

  if (!product || !tier || !amount_uzs || !payment_method) {
    return res.status(400).json({ ok: false, error: 'Не хватает данных заказа (product, tier, amount_uzs, payment_method).' });
  }
  if (!['payme', 'click', 'uzcard', 'card'].includes(payment_method)) {
    return res.status(400).json({ ok: false, error: 'Неизвестный способ оплаты.' });
  }

  const info = db.prepare(`
    INSERT INTO orders (created_at, product, tier, amount_uzs, phone, payment_method, status)
    VALUES (?, ?, ?, ?, ?, ?, 'pending')
  `).run(new Date().toISOString(), product, tier, Math.round(amount_uzs), phone || '', payment_method);

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(info.lastInsertRowid);

  // Uzcard/Humo и обычные карты в Узбекистане чаще всего принимаются через тот же
  // Payme/Click (уточните при подключении, какие карты поддерживает ваш мерчант-договор),
  // поэтому используем тот же checkout, если он настроен.
  let redirectUrl = null;
  let gateway = payment_method;

  if (payment_method === 'payme' && payme.isConfigured()) {
    redirectUrl = payme.buildCheckoutUrl(order);
  } else if (payme.isConfigured() && (payment_method === 'uzcard' || payment_method === 'card')) {
    redirectUrl = payme.buildCheckoutUrl(order);
    gateway = 'payme';
  } else if (payment_method === 'click' && click.isConfigured()) {
    redirectUrl = click.buildCheckoutUrl(order, req.body.return_url);
  } else if (click.isConfigured() && (payment_method === 'uzcard' || payment_method === 'card')) {
    redirectUrl = click.buildCheckoutUrl(order, req.body.return_url);
    gateway = 'click';
  }

  if (redirectUrl) {
    res.json({ ok: true, orderId: order.id, redirectUrl, gateway, live: true });
  } else {
    // Платёжный шлюз ещё не подключён — заказ сохранён, оплата будет оформлена вручную/по звонку.
    res.json({
      ok: true,
      orderId: order.id,
      redirectUrl: null,
      live: false,
      message: 'Оплата на сайте пока не подключена. Мы свяжемся с вами, чтобы принять оплату и оформить заказ.'
    });
  }
});

router.get('/', adminAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM orders ORDER BY id DESC LIMIT 200').all();
  res.json({ ok: true, orders: rows });
});

// Ручная отметка статуса — например, если оплатили наличными или по звонку.
router.patch('/:id', adminAuth, (req, res) => {
  const { status } = req.body || {};
  if (!['pending', 'awaiting_gateway', 'paid', 'cancelled'].includes(status)) {
    return res.status(400).json({ ok: false, error: 'Недопустимый статус.' });
  }
  const paidAt = status === 'paid' ? new Date().toISOString() : null;
  db.prepare('UPDATE orders SET status = ?, paid_at = COALESCE(?, paid_at) WHERE id = ?').run(status, paidAt, req.params.id);
  res.json({ ok: true });
});

module.exports = router;
