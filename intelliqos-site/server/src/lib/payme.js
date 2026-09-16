// Интеграция с Payme Business (Merchant API).
//
// ВАЖНО: этот файл реализует протокол по его публичной документации
// (developer.help.paycom.uz), но у вас ещё нет мерчант-аккаунта Payme —
// поэтому код нужно проверить в тестовой кассе Payme, прежде чем принимать
// реальные деньги. Порядок действий описан в README.md в корне проекта.
//
// Как это работает:
// 1. Наш сайт создаёт заказ (см. routes/orders.js) и отправляет покупателя
//    на checkout.paycom.uz по ссылке, которую строит buildCheckoutUrl().
// 2. Payme, получив оплату, сам обращается к нашему серверу на эндпоинт
//    /api/payments/payme и вызывает методы CheckPerformTransaction,
//    CreateTransaction, PerformTransaction, CancelTransaction — в этом файле
//    описано, как сервер должен на них отвечать.

const express = require('express');
const db = require('../db');

const router = express.Router();

const PAYME_ERRORS = {
  ORDER_NOT_FOUND: { code: -31050, message: { ru: 'Заказ не найден', en: 'Order not found', uz: 'Buyurtma topilmadi' } },
  WRONG_AMOUNT: { code: -31001, message: { ru: 'Неверная сумма', en: 'Incorrect amount', uz: "Noto'g'ri summa" } },
  TRANSACTION_NOT_FOUND: { code: -31003, message: { ru: 'Транзакция не найдена', en: 'Transaction not found', uz: 'Tranzaksiya topilmadi' } },
  CANNOT_CANCEL: { code: -31007, message: { ru: 'Невозможно отменить транзакцию', en: 'Unable to cancel', uz: "Tranzaksiyani bekor qilib bo'lmaydi" } }
};

function isConfigured() {
  return Boolean(process.env.PAYME_MERCHANT_ID);
}

// Ссылка на форму оплаты Payme для конкретного заказа.
// Формат согласно протоколу checkout: base64("m=<merchant_id>;ac.order_id=<id>;a=<amount в тийинах>")
function buildCheckoutUrl(order) {
  if (!isConfigured()) return null;
  const amountTiyin = Math.round(order.amount_uzs * 100);
  const raw = `m=${process.env.PAYME_MERCHANT_ID};ac.order_id=${order.id};a=${amountTiyin}`;
  const encoded = Buffer.from(raw, 'utf8').toString('base64');
  const base = process.env.PAYME_CHECKOUT_URL || 'https://checkout.paycom.uz';
  return `${base}/${encoded}`;
}

function checkAuth(req) {
  const login = process.env.PAYME_MERCHANT_LOGIN;
  const key = process.env.PAYME_MERCHANT_KEY;
  if (!login || !key) return false; // не настроено — доступ закрыт
  const header = req.headers.authorization || '';
  if (!header.startsWith('Basic ')) return false;
  const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
  return decoded === `${login}:${key}`;
}

function rpcError(id, err) {
  return { jsonrpc: '2.0', id: id ?? null, error: { code: err.code, message: err.message } };
}
function rpcResult(id, result) {
  return { jsonrpc: '2.0', id: id ?? null, result };
}

router.post('/', express.json(), (req, res) => {
  if (!checkAuth(req)) {
    return res.status(200).json(rpcError(req.body?.id, { code: -32504, message: { ru: 'Недостаточно прав', en: 'Access denied', uz: "Ruxsat yo'q" } }));
  }

  const { method, params, id } = req.body || {};
  const orderId = params?.account?.order_id ? Number(params.account.order_id) : null;

  try {
    switch (method) {
      case 'CheckPerformTransaction': {
        const order = orderId ? db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) : null;
        if (!order) return res.json(rpcError(id, PAYME_ERRORS.ORDER_NOT_FOUND));
        if (Math.round(order.amount_uzs * 100) !== Number(params.amount)) {
          return res.json(rpcError(id, PAYME_ERRORS.WRONG_AMOUNT));
        }
        return res.json(rpcResult(id, { allow: true }));
      }

      case 'CreateTransaction': {
        const order = orderId ? db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) : null;
        if (!order) return res.json(rpcError(id, PAYME_ERRORS.ORDER_NOT_FOUND));

        // Уже создана транзакция с другим id для этого заказа — не даём завести вторую.
        if (order.gateway_transaction_id && order.gateway_transaction_id !== params.id && order.status !== 'cancelled') {
          return res.json(rpcError(id, PAYME_ERRORS.ORDER_NOT_FOUND));
        }

        if (order.status === 'paid') {
          return res.json(rpcResult(id, { create_time: Date.parse(order.paid_at), transaction: String(order.id), state: 2 }));
        }

        db.prepare('UPDATE orders SET gateway_transaction_id = ?, status = ? WHERE id = ?')
          .run(params.id, 'awaiting_gateway', order.id);

        return res.json(rpcResult(id, { create_time: Date.now(), transaction: String(order.id), state: 1 }));
      }

      case 'PerformTransaction': {
        const order = db.prepare('SELECT * FROM orders WHERE gateway_transaction_id = ?').get(params.id);
        if (!order) return res.json(rpcError(id, PAYME_ERRORS.TRANSACTION_NOT_FOUND));

        if (order.status !== 'paid') {
          db.prepare("UPDATE orders SET status = 'paid', paid_at = ? WHERE id = ?")
            .run(new Date().toISOString(), order.id);
        }
        const fresh = db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id);
        return res.json(rpcResult(id, { transaction: String(fresh.id), perform_time: Date.parse(fresh.paid_at), state: 2 }));
      }

      case 'CancelTransaction': {
        const order = db.prepare('SELECT * FROM orders WHERE gateway_transaction_id = ?').get(params.id);
        if (!order) return res.json(rpcError(id, PAYME_ERRORS.TRANSACTION_NOT_FOUND));

        db.prepare("UPDATE orders SET status = 'cancelled' WHERE id = ?").run(order.id);
        return res.json(rpcResult(id, { transaction: String(order.id), cancel_time: Date.now(), state: -1 }));
      }

      case 'CheckTransaction': {
        const order = db.prepare('SELECT * FROM orders WHERE gateway_transaction_id = ?').get(params.id);
        if (!order) return res.json(rpcError(id, PAYME_ERRORS.TRANSACTION_NOT_FOUND));

        const state = order.status === 'paid' ? 2 : order.status === 'cancelled' ? -1 : 1;
        return res.json(rpcResult(id, {
          create_time: Date.now(), perform_time: order.paid_at ? Date.parse(order.paid_at) : 0,
          cancel_time: order.status === 'cancelled' ? Date.now() : 0,
          transaction: String(order.id), state, reason: null
        }));
      }

      default:
        return res.json(rpcError(id, { code: -32601, message: { ru: 'Метод не найден', en: 'Method not found', uz: 'Metod topilmadi' } }));
    }
  } catch (e) {
    console.error('Payme merchant API error:', e);
    return res.json(rpcError(id, { code: -32400, message: { ru: 'Внутренняя ошибка сервера', en: 'Internal error', uz: 'Ichki xatolik' } }));
  }
});

module.exports = { router, buildCheckoutUrl, isConfigured };
