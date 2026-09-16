// Простой rate-limit в памяти процесса — без Redis, для одного сервера этого
// достаточно. Защищает /api/assistant от накрутки счёта за ИИ-API, если сайт
// станет публичным и кто-то начнёт спамить чат.
const buckets = new Map();

module.exports = function rateLimit({ windowMs = 60_000, max = 20 } = {}) {
  return function (req, res, next) {
    const key = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const now = Date.now();
    const bucket = buckets.get(key) || { count: 0, resetAt: now + windowMs };

    if (now > bucket.resetAt) {
      bucket.count = 0;
      bucket.resetAt = now + windowMs;
    }
    bucket.count += 1;
    buckets.set(key, bucket);

    if (bucket.count > max) {
      return res.status(429).json({ ok: false, error: 'Слишком много сообщений подряд, подождите минуту.' });
    }
    next();
  };
};
