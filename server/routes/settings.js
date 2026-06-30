const express = require('express');
const { requireAuth } = require('../middleware');
const { getSettings, setSettings } = require('../db');
const {
  generateX25519,
  generateShortId,
  scheduleRestart,
  getXrayVersion,
} = require('../xray');

const router = express.Router();
router.use(requireAuth);

const UPDATABLE_KEYS = [
  'xray_port',
  'public_host',
  'public_port',
  'reality_dest',
  'reality_server_names',
  'reality_short_ids',
  'grpc_service_name',
  'default_fingerprint',
  'xray_log_level',
  'stats_interval_ms',
];

// Strip the private key from any response
function sanitize(s) {
  const { reality_private_key, ...rest } = s;
  return rest;
}

router.get('/', (req, res) => {
  res.json({ settings: sanitize(getSettings()) });
});

router.put('/', (req, res) => {
  const updates = {};
  for (const k of UPDATABLE_KEYS) {
    if (req.body && req.body[k] !== undefined) {
      updates[k] = req.body[k];
    }
  }
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'هیچ فیلدی برای به‌روزرسانی ارسال نشد.' });
  }
  setSettings(updates);
  scheduleRestart();
  res.json({ settings: sanitize(getSettings()) });
});

router.post('/generate-keypair', async (req, res) => {
  try {
    const { privateKey, publicKey } = await generateX25519();
    setSettings({
      reality_private_key: privateKey,
      reality_public_key: publicKey,
    });
    scheduleRestart();
    res.json({ publicKey });
  } catch (e) {
    res.status(500).json({ error: 'تولید کلید ناموفق بود: ' + e.message });
  }
});

router.post('/generate-shortid', (req, res) => {
  const sid = generateShortId();
  const s = getSettings();
  let arr = [];
  try {
    arr = JSON.parse(s.reality_short_ids);
    if (!Array.isArray(arr)) arr = [];
  } catch {
    arr = [];
  }
  arr.push(sid);
  setSettings({ reality_short_ids: JSON.stringify(arr) });
  scheduleRestart();
  res.json({ shortIds: arr });
});

router.get('/xray-version', async (req, res) => {
  const v = await getXrayVersion();
  res.json({ version: v });
});

module.exports = router;
