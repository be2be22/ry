const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { ensureAdmin } = require('./auth');
const { startXray, isRunning, getXrayVersion } = require('./xray');
const { startPolling } = require('./stats');
const { getSettings } = require('./db');

const PORT = parseInt(process.env.PORT || '3000', 10);
const DATA_DIR = process.env.DATA_DIR || '/data';
const STATIC_DIR =
  process.env.STATIC_DIR || path.join(__dirname, '..', 'client', 'dist');

fs.mkdirSync(DATA_DIR, { recursive: true });
ensureAdmin();

const app = express();

// Trust the Railway proxy so rate-limit / IPs work correctly
app.set('trust proxy', 1);

// Security headers (CSP disabled so the Vite-built frontend with inline styles works)
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(express.json({ limit: '512kb' }));
app.use(cors({ origin: true, credentials: true }));

// ---------- API routes ----------
app.use('/api/auth', require('./routes/auth'));
app.use('/api/clients', require('./routes/clients'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/logs', require('./routes/logs'));
app.use('/sub', require('./routes/sub'));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, xray: !!isRunning(), time: Date.now() });
});

// ---------- Static frontend ----------
if (fs.existsSync(STATIC_DIR)) {
  app.use(express.static(STATIC_DIR, { maxAge: '1h', index: false }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/sub')) return next();
    res.sendFile(path.join(STATIC_DIR, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res
      .set('Content-Type', 'text/plain; charset=utf-8')
      .send(
        'Xray panel backend is running but the built frontend was not found at: ' +
          STATIC_DIR +
          '\nRun `npm run build:client` first.'
      );
  });
}

// ---------- Central error handler ----------
app.use((err, req, res, next) => {
  console.error('[error]', err.message);
  res.status(500).json({ error: 'خطای داخلی سرور.' });
});

// ---------- Boot ----------
(async () => {
  try {
    const v = await getXrayVersion();
    console.log('[xray] ' + v);
  } catch (e) {
    console.warn('[xray] version probe failed:', e.message);
  }

  startXray();

  const interval = parseInt(getSettings().stats_interval_ms, 10) || 5000;
  startPolling(interval);
})();

app.listen(PORT, '0.0.0.0', () => {
  console.log('[panel] listening on 0.0.0.0:' + PORT);
  console.log('[panel] data dir: ' + DATA_DIR);
});

// Graceful shutdown
function shutdown() {
  console.log('[panel] shutting down...');
  try {
    const { stopXray } = require('./xray');
    const { stopPolling } = require('./stats');
    stopPolling();
    stopXray();
  } catch {
    /* ignore */
  }
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
