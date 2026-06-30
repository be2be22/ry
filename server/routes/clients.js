const express = require('express');
const { requireAuth } = require('../middleware');
const { db } = require('../db');
const { generateUUID, generateSubToken, scheduleRestart } = require('../xray');
const { buildShareLink } = require('../share-link');
const { getSettings } = require('../db');

const router = express.Router();
router.use(requireAuth);

function clientWithLink(client) {
  if (!client) return null;
  const settings = getSettings();
  const link = buildShareLink(client, settings);
  return { ...client, link };
}

// GET /api/clients
router.get('/', (req, res) => {
  const clients = db.prepare('SELECT * FROM clients ORDER BY id DESC').all();
  // Attach computed share link for convenience
  const enriched = clients.map((c) => clientWithLink(c));
  res.json({ clients: enriched });
});

// POST /api/clients
router.post('/', (req, res) => {
  const { remark, traffic_limit_gb, expires_at, enabled } = req.body || {};
  if (!remark || !remark.trim()) {
    return res.status(400).json({ error: 'نام کلاینت الزامی است.' });
  }
  const uuid = generateUUID();
  const subToken = generateSubToken();
  const info = db
    .prepare(
      `INSERT INTO clients (uuid, remark, traffic_limit_gb, expires_at, enabled, sub_token)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      uuid,
      remark.trim(),
      traffic_limit_gb ? parseFloat(traffic_limit_gb) : null,
      expires_at || null,
      enabled === false ? 0 : 1,
      subToken
    );
  scheduleRestart();
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(info.lastInsertRowid);
  res.json({ client: clientWithLink(client) });
});

// PUT /api/clients/:id
router.put('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const existing = db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'کلاینت یافت نشد.' });

  const { remark, traffic_limit_gb, expires_at, enabled, reset_traffic } = req.body || {};
  const fields = [];
  const vals = [];

  if (remark !== undefined) {
    if (!remark.trim()) return res.status(400).json({ error: 'نام کلاینت نمی‌تواند خالی باشد.' });
    fields.push('remark = ?');
    vals.push(remark.trim());
  }
  if (traffic_limit_gb !== undefined) {
    fields.push('traffic_limit_gb = ?');
    vals.push(traffic_limit_gb === null || traffic_limit_gb === '' ? null : parseFloat(traffic_limit_gb));
  }
  if (expires_at !== undefined) {
    fields.push('expires_at = ?');
    vals.push(expires_at || null);
  }
  if (enabled !== undefined) {
    fields.push('enabled = ?');
    vals.push(enabled ? 1 : 0);
  }
  if (reset_traffic) {
    fields.push('traffic_used_up = 0', 'traffic_used_down = 0');
  }

  if (fields.length > 0) {
    vals.push(id);
    db.prepare(`UPDATE clients SET ${fields.join(', ')} WHERE id = ?`).run(...vals);
    scheduleRestart();
  }

  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
  res.json({ client: clientWithLink(client) });
});

// DELETE /api/clients/:id
router.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  db.prepare('DELETE FROM clients WHERE id = ?').run(id);
  scheduleRestart();
  res.json({ ok: true });
});

// POST /api/clients/:id/regenerate-uuid
router.post('/:id/regenerate-uuid', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
  if (!client) return res.status(404).json({ error: 'کلاینت یافت نشد.' });
  const newUuid = generateUUID();
  db.prepare('UPDATE clients SET uuid = ? WHERE id = ?').run(newUuid, id);
  // Regenerate sub_token too so old subscription URLs stop working
  const newToken = generateSubToken();
  db.prepare('UPDATE clients SET sub_token = ? WHERE id = ?').run(newToken, id);
  scheduleRestart();
  const updated = db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
  res.json({ client: clientWithLink(updated) });
});

// GET /api/clients/:id/link
router.get('/:id/link', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
  if (!client) return res.status(404).json({ error: 'کلاینت یافت نشد.' });
  const settings = getSettings();
  const link = buildShareLink(client, settings);
  res.json({ link, subUrl: '/sub/' + client.sub_token });
});

module.exports = router;
