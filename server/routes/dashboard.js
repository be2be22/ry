const express = require('express');
const { requireAuth } = require('../middleware');
const { db } = require('../db');
const { isRunning, restartXray } = require('../xray');

const router = express.Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const totalClients = db.prepare('SELECT COUNT(*) as c FROM clients').get().c;
  const activeClients = db.prepare('SELECT COUNT(*) as c FROM clients WHERE enabled = 1').get().c;
  const totalUp = db.prepare('SELECT COALESCE(SUM(traffic_used_up), 0) as s FROM clients').get().s;
  const totalDown = db
    .prepare('SELECT COALESCE(SUM(traffic_used_down), 0) as s FROM clients')
    .get().s;
  const daily = db
    .prepare('SELECT date, up, down FROM traffic_daily ORDER BY date DESC LIMIT 8')
    .all()
    .reverse();
  const today = new Date().toISOString().slice(0, 10);
  const todayRow =
    db.prepare('SELECT up, down FROM traffic_daily WHERE date = ?').get(today) ||
    { up: 0, down: 0 };

  res.json({
    xrayRunning: !!isRunning(),
    totalClients,
    activeClients,
    totalUp,
    totalDown,
    todayUp: todayRow.up,
    todayDown: todayRow.down,
    daily,
  });
});

router.post('/restart', (req, res) => {
  restartXray();
  res.json({ ok: true });
});

module.exports = router;
