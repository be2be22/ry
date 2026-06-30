const { execFile } = require('child_process');
const { db, getSettings } = require('./db');
const { isRunning, API_PORT, scheduleRestart } = require('./xray');

const XRAY_BIN = process.env.XRAY_BIN || '/usr/local/bin/xray';

let pollTimer = null;
let lastPollAt = 0;

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// Output format from `xray api statsquery`:
//   user>>>email>>>traffic>>>uplink: 1234
//   user>>>email>>>traffic>>>downlink: 5678
function parseStatsOutput(stdout) {
  const stats = {};
  if (!stdout) return stats;
  const regex = /user>>>(.+?)>>>traffic>>>(uplink|downlink)[:\s]*([\d]+)/g;
  let m;
  while ((m = regex.exec(stdout)) !== null) {
    const email = m[1];
    const dir = m[2];
    const val = parseInt(m[3], 10);
    if (!stats[email]) stats[email] = { up: 0, down: 0 };
    if (dir === 'uplink') stats[email].up = val;
    else stats[email].down = val;
  }
  return stats;
}

function applyStats(stats) {
  const today = todayStr();
  const upsertDaily = db.prepare(
    `INSERT INTO traffic_daily (date, up, down) VALUES (?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET up = up + ?, down = down + ?`
  );
  const updateClient = db.prepare(
    `UPDATE clients SET traffic_used_up = traffic_used_up + ?, traffic_used_down = traffic_used_down + ? WHERE remark = ?`
  );
  const getClient = db.prepare(
    `SELECT id, remark, traffic_limit_gb, traffic_used_up, traffic_used_down, expires_at, enabled FROM clients WHERE remark = ?`
  );
  const disableClient = db.prepare(`UPDATE clients SET enabled = 0 WHERE id = ?`);

  let totalUp = 0;
  let totalDown = 0;
  const toDisable = [];

  const tx = db.transaction(() => {
    for (const [email, s] of Object.entries(stats)) {
      const upDelta = s.up || 0;
      const downDelta = s.down || 0;
      if (upDelta === 0 && downDelta === 0) continue;

      updateClient.run(upDelta, downDelta, email);
      totalUp += upDelta;
      totalDown += downDelta;

      const client = getClient.get(email);
      if (client && client.enabled === 1) {
        // Cap check
        if (client.traffic_limit_gb) {
          const usedBytes =
            (client.traffic_used_up + upDelta) + (client.traffic_used_down + downDelta);
          const limitBytes = client.traffic_limit_gb * 1024 * 1024 * 1024;
          if (usedBytes >= limitBytes) {
            toDisable.push(client.id);
          }
        }
        // Expiry check
        if (client.expires_at && new Date(client.expires_at) < new Date()) {
          toDisable.push(client.id);
        }
      }
    }
    upsertDaily.run(today, totalUp, totalDown, totalUp, totalDown);
    for (const id of toDisable) disableClient.run(id);
  });

  tx();

  if (toDisable.length > 0) {
    console.log('[stats] auto-disabled client ids:', toDisable.join(','));
    // Trigger a debounced xray restart so the disabled clients are removed from the inbound
    scheduleRestart();
  }
}

function pollOnce() {
  if (!isRunning()) return Promise.resolve(null);
  lastPollAt = Date.now();
  return new Promise((resolve) => {
    execFile(
      XRAY_BIN,
      ['api', 'statsquery', `--server=127.0.0.1:${API_PORT}`, '-reset'],
      { timeout: 8000 },
      (err, stdout) => {
        if (err) {
          // Likely no traffic since last poll, or xray api not ready yet
          resolve(null);
          return;
        }
        try {
          const stats = parseStatsOutput(stdout);
          applyStats(stats);
          resolve(stats);
        } catch (e) {
          console.error('[stats] apply error:', e.message);
          resolve(null);
        }
      }
    );
  });
}

function startPolling(intervalMsOverride) {
  if (pollTimer) clearInterval(pollTimer);
  const interval = intervalMsOverride || parseInt(getSettings().stats_interval_ms, 10) || 5000;
  // First poll quickly so dashboard isn't empty after a restart
  setTimeout(pollOnce, 2000);
  pollTimer = setInterval(pollOnce, interval);
  console.log('[stats] polling every ' + interval + 'ms');
}

function stopPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}

module.exports = {
  startPolling,
  stopPolling,
  pollOnce,
  parseStatsOutput,
  applyStats,
};
