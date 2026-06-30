const { spawn, execFile } = require('child_process');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { db, getSettings } = require('./db');

const DATA_DIR = process.env.DATA_DIR || '/data';
const XRAY_BIN = process.env.XRAY_BIN || '/usr/local/bin/xray';
const CONFIG_PATH = path.join(DATA_DIR, 'xray-config.json');
const LOG_PATH = path.join(DATA_DIR, 'xray.log');
const ACCESS_LOG_PATH = path.join(DATA_DIR, 'xray-access.log');
const API_PORT = parseInt(process.env.XRAY_API_PORT || '10085', 10);

let xrayProc = null;
let restartTimer = null;
let startRequested = false;

// ---------- Config builder ----------
function buildConfig() {
  const s = getSettings();

  const clients = db
    .prepare('SELECT uuid, remark, enabled FROM clients ORDER BY id ASC')
    .all()
    .filter((c) => c.enabled === 1)
    .map((c) => ({
      id: c.uuid,
      email: c.remark,
      level: 0,
    }));

  let serverNames = [];
  try {
    serverNames = JSON.parse(s.reality_server_names);
    if (!Array.isArray(serverNames)) serverNames = [];
  } catch {
    serverNames = [];
  }
  if (serverNames.length === 0) {
    const sn = (s.reality_dest || '').split(':')[0];
    if (sn) serverNames = [sn];
  }

  let shortIds = [];
  try {
    shortIds = JSON.parse(s.reality_short_ids);
    if (!Array.isArray(shortIds)) shortIds = [];
  } catch {
    shortIds = [];
  }
  if (shortIds.length === 0) shortIds = [''];

  const cfg = {
    log: {
      loglevel: s.xray_log_level || 'warning',
      access: ACCESS_LOG_PATH,
      error: LOG_PATH,
    },
    stats: {},
    api: {
      tag: 'api',
      services: ['StatsService'],
    },
    policy: {
      levels: {
        '0': {
          statsUserUplink: true,
          statsUserDownlink: true,
        },
      },
    },
    inbounds: [
      {
        tag: 'vless',
        listen: '0.0.0.0',
        port: parseInt(s.xray_port, 10) || 8443,
        protocol: 'vless',
        settings: {
          clients,
          decryption: 'none',
        },
        streamSettings: {
          network: 'grpc',
          grpcSettings: { serviceName: s.grpc_service_name || 'GunService' },
          security: 'reality',
          realitySettings: {
            show: false,
            dest: s.reality_dest || 'www.microsoft.com:443',
            xver: 0,
            serverNames,
            privateKey: s.reality_private_key || '',
            shortIds,
          },
        },
        sniffing: {
          enabled: true,
          destOverride: ['http', 'tls'],
        },
      },
      {
        tag: 'api',
        listen: '127.0.0.1',
        port: API_PORT,
        protocol: 'dokodemo-door',
        settings: { address: '127.0.0.1' },
      },
    ],
    outbounds: [{ protocol: 'freedom', tag: 'direct' }],
    routing: {
      domainStrategy: 'AsIs',
      rules: [
        {
          type: 'field',
          inboundTag: ['api'],
          outboundTag: 'api',
        },
      ],
    },
  };

  return cfg;
}

function writeConfig() {
  const cfg = buildConfig();
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
  return cfg;
}

// ---------- Process management ----------
function startXray() {
  if (xrayProc && !xrayProc.killed) return false;
  if (!fs.existsSync(XRAY_BIN)) {
    console.error('[xray] binary not found at ' + XRAY_BIN + ' — skipping start');
    return false;
  }
  try {
    writeConfig();
  } catch (e) {
    console.error('[xray] failed to write config:', e.message);
    return false;
  }
  startRequested = false;
  xrayProc = spawn(XRAY_BIN, ['run', '-c', CONFIG_PATH], {
    stdio: ['ignore', 'ignore', 'ignore'],
  });
  xrayProc.on('exit', (code, signal) => {
    console.log(`[xray] process exited code=${code} signal=${signal}`);
    xrayProc = null;
    if (startRequested) {
      // Auto-restart was requested during shutdown
      setTimeout(() => startXray(), 500);
    }
  });
  xrayProc.on('error', (err) => {
    console.error('[xray] spawn error:', err.message);
    xrayProc = null;
  });
  console.log('[xray] started pid=' + (xrayProc ? xrayProc.pid : 'n/a'));
  return true;
}

function stopXray() {
  if (!xrayProc) return false;
  try {
    xrayProc.kill('SIGTERM');
  } catch {
    xrayProc = null;
  }
  return true;
}

function restartXray() {
  console.log('[xray] restart requested');
  if (!xrayProc) {
    startXray();
    return;
  }
  startRequested = true;
  try {
    xrayProc.kill('SIGTERM');
  } catch {
    xrayProc = null;
    startXray();
  }
  // Fallback in case exit event doesn't fire fast enough
  setTimeout(() => {
    if (xrayProc) {
      try {
        xrayProc.kill('SIGKILL');
      } catch {
        /* ignore */
      }
      xrayProc = null;
      startXray();
    } else if (!startRequested || true) {
      // Already restarted via exit handler — verify it's up
      if (!xrayProc) startXray();
    }
  }, 2000);
}

// Debounced restart for batched edits (e.g. when admin saves multiple clients in a row)
function scheduleRestart(ms = 800) {
  if (restartTimer) clearTimeout(restartTimer);
  restartTimer = setTimeout(() => {
    restartTimer = null;
    restartXray();
  }, ms);
}

function isRunning() {
  return !!(xrayProc && !xrayProc.killed);
}

function getXrayVersion() {
  return new Promise((resolve) => {
    execFile(XRAY_BIN, ['version'], { timeout: 5000 }, (err, stdout) => {
      if (err) return resolve('unavailable');
      resolve(stdout.split('\n')[0].trim());
    });
  });
}

function generateX25519() {
  return new Promise((resolve, reject) => {
    execFile(XRAY_BIN, ['x25519'], { timeout: 5000 }, (err, stdout) => {
      if (err) return reject(err);
      const privMatch = stdout.match(/Private\s*key:\s*([A-Za-z0-9_\-]+)/i);
      const pubMatch = stdout.match(/Public\s*key:\s*([A-Za-z0-9_\-]+)/i);
      if (!privMatch || !pubMatch) {
        return reject(new Error('Cannot parse `xray x25519` output: ' + stdout));
      }
      resolve({ privateKey: privMatch[1], publicKey: pubMatch[1] });
    });
  });
}

function generateShortId() {
  // 8 hex chars; empty string is also valid ("any")
  return crypto.randomBytes(4).toString('hex');
}

function generateUUID() {
  return crypto.randomUUID();
}

function generateSubToken() {
  return crypto.randomBytes(16).toString('hex');
}

module.exports = {
  buildConfig,
  writeConfig,
  startXray,
  stopXray,
  restartXray,
  scheduleRestart,
  isRunning,
  getXrayVersion,
  generateX25519,
  generateShortId,
  generateUUID,
  generateSubToken,
  CONFIG_PATH,
  LOG_PATH,
  ACCESS_LOG_PATH,
  API_PORT,
};
