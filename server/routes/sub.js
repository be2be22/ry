const express = require('express');
const { db, getSettings } = require('../db');
const { buildShareLink } = require('../share-link');

const router = express.Router();

// GET /sub/:token  -> base64-encoded vless:// link (subscription URL format)
router.get('/:token', (req, res) => {
  const client = db
    .prepare('SELECT * FROM clients WHERE sub_token = ?')
    .get(req.params.token);
  if (!client) {
    return res.status(404).set('Content-Type', 'text/plain; charset=utf-8').send('Not Found');
  }
  if (client.enabled !== 1) {
    return res
      .status(403)
      .set('Content-Type', 'text/plain; charset=utf-8')
      .send('Client disabled');
  }

  const settings = getSettings();
  const link = buildShareLink(client, settings);
  const base64 = Buffer.from(link).toString('base64');

  const totalBytes = client.traffic_limit_gb
    ? Math.floor(client.traffic_limit_gb * 1024 * 1024 * 1024)
    : 0;
  const expire = client.expires_at
    ? Math.floor(new Date(client.expires_at + 'T23:59:59Z').getTime() / 1000)
    : 0;
  const used = (client.traffic_used_up || 0) + (client.traffic_used_down || 0);

  res.set('Content-Type', 'text/plain; charset=utf-8');
  res.set('Cache-Control', 'no-store');
  res.set(
    'Subscription-Userinfo',
    `upload=${client.traffic_used_up || 0}; download=${client.traffic_used_down || 0}; total=${totalBytes}; expire=${expire}`
  );
  // Optional: include used bytes in a custom header for debugging
  res.set('X-Used-Bytes', String(used));
  res.send(base64);
});

module.exports = router;
