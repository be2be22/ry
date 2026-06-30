const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = process.env.DATA_DIR || '/data';
fs.mkdirSync(DATA_DIR, { recursive: true });

const dbPath = path.join(DATA_DIR, 'panel.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ---------- Schema ----------
db.exec(`
  CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL,
    remark TEXT NOT NULL,
    traffic_limit_gb REAL,
    traffic_used_up INTEGER DEFAULT 0,
    traffic_used_down INTEGER DEFAULT 0,
    expires_at TEXT,
    enabled INTEGER DEFAULT 1,
    sub_token TEXT UNIQUE NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS admin (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    username TEXT NOT NULL,
    password_hash TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS traffic_daily (
    date TEXT NOT NULL,
    up INTEGER DEFAULT 0,
    down INTEGER DEFAULT 0,
    PRIMARY KEY (date)
  );

  CREATE INDEX IF NOT EXISTS idx_clients_sub_token ON clients(sub_token);
  CREATE INDEX IF NOT EXISTS idx_clients_enabled ON clients(enabled);
`);

// ---------- Default settings ----------
const DEFAULT_SETTINGS = {
  xray_port: '8443',
  public_host: '',
  public_port: '',
  reality_dest: 'www.microsoft.com:443',
  reality_server_names: '["www.microsoft.com"]',
  reality_short_ids: '[""]',
  reality_private_key: '',
  reality_public_key: '',
  grpc_service_name: 'GunService',
  default_fingerprint: 'chrome',
  xray_log_level: 'warning',
  stats_interval_ms: '5000',
};

const getSettings = () => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const out = {};
  for (const r of rows) out[r.key] = r.value;
  return { ...DEFAULT_SETTINGS, ...out };
};

const setSetting = (key, value) => {
  db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(key, value === null || value === undefined ? '' : String(value));
};

const setSettings = (obj) => {
  const tx = db.transaction((entries) => {
    for (const [k, v] of entries) setSetting(k, v);
  });
  tx(Object.entries(obj));
};

// Seed defaults if missing (only on first boot)
const existing = new Set(db.prepare('SELECT key FROM settings').all().map((r) => r.key));
for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
  if (!existing.has(k)) setSetting(k, v);
}

module.exports = { db, getSettings, setSetting, setSettings, DEFAULT_SETTINGS };
