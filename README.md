# FastApiCloud WS Config Panel — Python Edition

پنل مدیریت کانفیگ‌های V2Ray/Xray WebSocket با Python FastAPI — کاملاً خودکفا، بدون نیاز به تنظیمات.

## ✨ ویژگی‌ها

- 🐍 **Python FastAPI** — سازگار با fastapicloud.com
- ⚡ **اجرای محلی Xray** — Xray-core به عنوان subprocess اجرا می‌شود
- 🔄 **Auto-sync** — تغییرات کانفیگ خودکار در config.json اعمال می‌شوند
- 🔗 **WebSocket Proxy** — ترافیک WS از طریق FastAPI به Xray داخلی forward می‌شود
- 📱 **QR Code** و **Share Link** خودکار
- 💾 **SQLite** — بدون نیاز به دیتابیس خارجی
- 🚀 **Zero Config** — همه چیز خودکار (دانلود Xray، init DB، cert)
- 🇮🇷 کاملاً **فارسی RTL**

## 🚀 نصب و راه‌اندازی

### روی fastapicloud.com

1. کد را در GitHub قرار دهید
2. در dashboard.fastapicloud.com یک app جدید بسازید و به GitHub وصل کنید
3. fastapicloud به‌طور خودکار:
   - `requirements.txt` را نصب می‌کند
   - `Procfile` را می‌خواند و `uvicorn` را اجرا می‌کند
4. پس از deploy، به آدرس app بروید و با `admin / admin123` وارد شوید

### روی VPS یا لوکال

```bash
# نصب وابستگی‌ها
pip install -r requirements.txt

# اجرا
python main.py
# یا
uvicorn main:app --host 0.0.0.0 --port 8080
```

سپس به http://localhost:8080 بروید.

## 📁 ساختار پروژه

```
.
├── main.py              # کل برنامه (FastAPI + DB + Xray manager)
├── static/
│   └── index.html       # Frontend (single page)
├── requirements.txt     # وابستگی‌های Python
├── Procfile             # دستور اجرا برای PaaS
├── runtime.txt          # نسخه Python
└── README.md
```

## 🔧 نحوه کار

1. **Startup**: برنامه Xray binary را دانلود می‌کند، دیتابیس SQLite می‌سازد، و Xray را اجرا می‌کند
2. **پنل**: کاربر کانفیگ می‌سازد → config.json خودکار regenerate می‌شود
3. **اتصال کلاینت**: کلاینت V2Ray به `wss://your-app.fastapicloud.dev/ws/vmess` وصل می‌شود → FastAPI آن را به `ws://127.0.0.1:8443/vmess` (Xray داخلی) forward می‌کند

## 📡 پروتکل‌ها و مسیرها

| پروتکل | مسیر اتصال |
|--------|------------|
| VMess  | `wss://your-host/ws/vmess` |
| VLESS  | `wss://your-host/ws/vless` |
| Trojan | `wss://your-host/ws/trojan` |

## 🔐 ورود پیش‌فرض

- نام کاربری: `admin`
- رمز عبور: `admin123`

**حتماً پس از اولین ورود رمز را تغییر دهید!**

## 🌐 متغیرهای محیط (اختیاری)

| متغیر | پیش‌فرض | توضیح |
|------|---------|--------|
| `PORT` | `8080` | پورت اجرای FastAPI |
| `PUBLIC_HOST` | auto | دامنه‌ای که در share links استفاده می‌شود |
| `PUBLIC_PORT` | `443` | پورت عمومی (TLS توسط PaaS) |
| `SESSION_SECRET` | auto | کلید session |

## 📝 License

MIT
