#!/usr/bin/env python3
"""
init_db.py - Initialize SQLite database for the panel.
Creates /data/users.db with default schema and a default admin user (if empty).
"""
import sqlite3
import os
import uuid
from hashlib import sha256

DB_PATH = "/data/users.db"
ADMIN_USER = os.environ.get("ADMIN_USER", "admin")
ADMIN_PASS = os.environ.get("ADMIN_PASS", "admin")


def init_db():
    os.makedirs("/data", exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    # Users table (Xray VLESS clients)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            uuid TEXT UNIQUE NOT NULL,
            email TEXT,
            name TEXT,
            enabled INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            uplink INTEGER DEFAULT 0,
            downlink INTEGER DEFAULT 0
        )
    """)

    # Admin accounts table (panel login)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS admins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Settings table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    """)

    # Insert default admin if no admin exists
    cur.execute("SELECT COUNT(*) FROM admins")
    if cur.fetchone()[0] == 0:
        pass_hash = sha256(ADMIN_PASS.encode()).hexdigest()
        cur.execute(
            "INSERT INTO admins (username, password_hash) VALUES (?, ?)",
            (ADMIN_USER, pass_hash)
        )
        print(f"[OK] Default admin created: {ADMIN_USER}")

    # Insert default settings
    cur.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('panel_lang', 'fa-IR')")
    cur.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('ws_path', '/vless')")
    cur.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('xray_port', '80')")

    # Insert a default user if no user exists (so config can be loaded)
    cur.execute("SELECT COUNT(*) FROM users")
    if cur.fetchone()[0] == 0:
        default_uuid = str(uuid.uuid4())
        cur.execute(
            "INSERT INTO users (uuid, email, name) VALUES (?, ?, ?)",
            (default_uuid, "default@example.com", "Default User")
        )
        print(f"[OK] Default user created with UUID: {default_uuid}")

    conn.commit()
    conn.close()
    print(f"[OK] Database initialized at {DB_PATH}")


if __name__ == "__main__":
    init_db()
