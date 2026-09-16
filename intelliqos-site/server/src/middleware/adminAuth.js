// Простая защита админ-эндпоинтов токеном из .env (ADMIN_TOKEN).
// Пока не рассчитано на несколько сотрудников с разными правами — только на то,
// чтобы список заявок/заказов не был открыт всем в интернете.
module.exports = function adminAuth(req, res, next) {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) {
    return res.status(500).json({ ok: false, error: 'ADMIN_TOKEN не задан в .env — админ-доступ отключён из соображений безопасности.' });
  }
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : req.query.token;
  if (token !== expected) {
    return res.status(401).json({ ok: false, error: 'Неверный или отсутствующий токен доступа.' });
  }
  next();
};
