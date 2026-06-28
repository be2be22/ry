#!/usr/bin/env python3
"""
generate_config.py - Generates /etc/xray/config.json from SQLite database.

Reads users from /data/users.db and produces a complete Xray config that:
- Listens on port 80
- Has VLESS+WS inbound with path /vless
- Has all users from the DB as clients
- Falls back to 127.0.0.1:5000 (Flask panel) for non-WS traffic
"""
import json
import sqlite3
import os
import sys

DB_PATH = "/data/users.db"
TEMPLATE_PATH = "/etc/xray/config.template.json"
OUTPUT_PATH = "/etc/xray/config.json"


def get_users():
    if not os.path.exists(DB_PATH):
        print(f"[WARN] DB not found at {DB_PATH}, generating config with no users")
        return []
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute("SELECT uuid, email, enabled FROM users")
    rows = cur.fetchall()
    conn.close()
    clients = []
    for row in rows:
        if not row["enabled"]:
            continue
        clients.append({
            "id": row["uuid"],
            "alterId": 0,
            "email": row["email"] or f"user-{row['uuid'][:8]}",
            "limitIp": 0,
            "totalGB": 0,
            "expiryTime": 0,
            "enable": True,
            "tgId": "",
            "subId": row["uuid"][:16],
            "reset": 0
        })
    return clients


def main():
    with open(TEMPLATE_PATH, "r", encoding="utf-8") as f:
        template = f.read()

    clients = get_users()
    clients_json = ",\n          ".join(json.dumps(c, indent=10) for c in clients)
    # Strip leading whitespace from first client to keep indentation clean
    clients_json = clients_json.lstrip()

    config_text = template.replace("{{CLIENTS}}", clients_json)

    # Validate JSON
    try:
        json.loads(config_text)
    except json.JSONDecodeError as e:
        print(f"[FATAL] Generated config is invalid JSON: {e}", file=sys.stderr)
        sys.exit(1)

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        f.write(config_text)

    print(f"[OK] Xray config generated at {OUTPUT_PATH} with {len(clients)} active user(s)")


if __name__ == "__main__":
    main()
