const { verify } = require('./auth');

function requireAuth(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'احراز هویت لازم است.' });
  const payload = verify(token);
  if (!payload) return res.status(401).json({ error: 'نشست نامعتبر یا منقضی است.' });
  req.user = payload;
  next();
}

module.exports = { requireAuth };
