// Интеграция с Click (Merchant API).
//
// ВАЖНО: сделано по общей схеме, описанной в публичной документации docs.click.uz
// (Prepare -> Complete, подпись — MD5 от конкатенации полей). У вас ещё нет
// merchant_id/service_id/secret_key — Click выдаёт их после подключения бизнеса.
// Перед реальными платежами обязательно сверьте порядок полей подписи и
// формат ответа с актуальной документацией и протестируйте в тестовом сервисе Click.

const express = require('express');
const crypto = require('crypto');
const db = require('../db');

const router = express.Router();

const CLICK_ERROR = {
  SUCCESS: 0,
  SIGN_FAILED: -1,
  ORDER_NOT_FOUND: -5,
  ALREADY_PAID: -4,
  TRANSACTION_NOT_FOUND: -6,
  AMOUNT_MISMATCH: -2
};

function isConfigured() {
  return Boolean(process.env.CLICK_MERCHANT_ID && process.env.CLICK_SERVICE_ID && process.env.CLICK_SECRET_KEY);
}

// Ссылка на форму оплаты Click для конкретного заказа (Click Checkout).
function buildCheckoutUrl(order, returnUrl) {
  if (!isConfigured()) return null;
  const params = new URLSearchParams({
    service_id: process.env.CLICK_SERVICE_ID,
    merchant_id: process.env.CLICK_MERCHANT_ID,
    amount: String(order.amount_uzs),
    transaction_param: String(order.id),
    return_url: returnUrl || process.env.SITE_URL || ''
  });
  return `https://my.click.uz/services/pay?${params.toString()}`;
}

function md5(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

// POST /api/payments/click/prepare — Click проверяет, что заказ существует и сумма верна.
router.post('/prepare', express.json(), (req, res) => {
  const b = req.body || {};
  const signString = `${b.click_trans_id}${b.service_id}${process.env.CLICK_SECRET_KEY}${b.merchant_trans_id}${b.amount}${b.action}${b.sign_time}`;
  if (md5(signString) !== b.sign_string) {
    return res.json({ error: CLICK_ERROR.SIGN_FAILED, error_note: 'Неверная подпись (sign_string)' });
  }

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(Number(b.merchant_trans_id));
  if (!order) {
    return res.json({ error: CLICK_ERROR.ORDER_NOT_FOUND, error_note: 'Заказ не найден' });
  }
  if (Number(b.amount) !== order.amount_uzs) {
    return res.json({ error: CLICK_ERROR.AMOUNT_MISMATCH, error_note: 'Сумма не совпадает с заказом' });
  }
  if (order.status === 'paid') {
    return res.json({ error: CLICK_ERROR.ALREADY_PAID, error_note: 'Заказ уже оплачен' });
  }

  db.prepare("UPDATE orders SET status = 'awaiting_gateway', gateway_transaction_id = ? WHERE id = ?")
    .run(String(b.click_trans_id), order.id);

  res.json({
    click_trans_id: b.click_trans_id,
    merchant_trans_id: b.merchant_trans_id,
    merchant_prepare_id: order.id,
    error: CLICK_ERROR.SUCCESS,
    error_note: 'Success'
  });
});

// POST /api/payments/click/complete — Click подтверждает списание средств.
router.post('/complete', express.json(), (req, res) => {
  const b = req.body || {};
  const signString = `${b.click_trans_id}${b.service_id}${process.env.CLICK_SECRET_KEY}${b.merchant_trans_id}${b.merchant_prepare_id}${b.amount}${b.action}${b.sign_time}`;
  if (md5(signString) !== b.sign_string) {
    return res.json({ error: CLICK_ERROR.SIGN_FAILED, error_note: 'Неверная подпись (sign_string)' });
  }

  const order = db.prepare('SELECT * FROM orders WHERE gateway_transaction_id = ?').get(String(b.click_trans_id));
  if (!order) {
    return res.json({ error: CLICK_ERROR.TRANSACTION_NOT_FOUND, error_note: 'Транзакция не найдена' });
  }

  if (Number(b.error) < 0) {
    db.prepare("UPDATE orders SET status = 'cancelled' WHERE id = ?").run(order.id);
  } else if (order.status !== 'paid') {
    db.prepare("UPDATE orders SET status = 'paid', paid_at = ? WHERE id = ?").run(new Date().toISOString(), order.id);
  }

  res.json({
    click_trans_id: b.click_trans_id,
    merchant_trans_id: b.merchant_trans_id,
    merchant_confirm_id: order.id,
    error: CLICK_ERROR.SUCCESS,
    error_note: 'Success'
  });
});

module.exports = { router, buildCheckoutUrl, isConfigured };
