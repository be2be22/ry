const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { db } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
if (!process.env.JWT_SECRET) {
  console.log('[bootstrap] Generated JWT_SECRET (set the env var to persist across redeploys):');
  console.log('  ' + JWT_SECRET);
}

const TOKEN_EXPIRY = '7d';

function ensureAdmin() {
  const admin = db.prepare('SELECT * FROM admin WHERE id = 1').get();
  if (admin) return;

  const username = process.env.ADMIN_USER || 'admin';
  const password = process.env.ADMIN_PASSWORD || crypto.randomBytes(12).toString('base64url');
  const hash = bcrypt.hashSync(password, 10);
  db.prepare('INSERT INTO admin (id, username, password_hash) VALUES (1, ?, ?)').run(username, hash);

  console.log('[bootstrap] Admin credentials generated. Save these now (shown only once):');
  console.log('  username: ' + username);
  console.log('  password: ' + password);
}

function login(username, password) {
  const admin = db.prepare('SELECT * FROM admin WHERE id = 1').get();
  if (!admin) return null;
  if (admin.username !== username) return null;
  if (!bcrypt.compareSync(password, admin.password_hash)) return null;
  return jwt.sign({ id: 1, username: admin.username }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

function verify(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

function changePassword(newPassword) {
  if (!newPassword || newPassword.length < 6) throw new Error('Password too short');
  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE admin SET password_hash = ? WHERE id = 1').run(hash);
}

module.exports = { ensureAdmin, login, verify, changePassword, JWT_SECRET };
