const express = require('express');
const rateLimit = require('express-rate-limit');
const { login, changePassword } = require('../auth');
const { requireAuth } = require('../middleware');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'تلاش‌های بیش از حد. لطفاً چند دقیقه بعد دوباره تلاش کنید.' },
});

router.post('/login', loginLimiter, (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'نام کاربری و رمز عبور الزامی است.' });
  }
  const token = login(username, password);
  if (!token) {
    return res.status(401).json({ error: 'نام کاربری یا رمز عبور نادرست است.' });
  }
  res.json({ token });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

router.post('/change-password', requireAuth, (req, res) => {
  const { newPassword } = req.body || {};
  try {
    changePassword(newPassword);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: 'رمز عبور باید حداقل ۶ کاراکتر باشد.' });
  }
});

module.exports = router;
