# FastApiCloud WS Config Panel

پنل مدیریتی پیشرفته برای ساخت و مدیریت کانفیگ‌های **V2Ray/Xray WebSocket** — با اجرای محلی Xray-core روی همان سرور سایت.

![FastApiCloud](https://img.shields.io/badge/FastApiCloud-Panel-purple)
![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Xray](https://img.shields.io/badge/Xray-core-26.3-green)

## ✨ ویژگی‌ها

- 🔐 **احراز هویت ادمین** با bcrypt + session cookie
- ⚙️ **CRUD کامل کانفیگ‌ها** برای VMess / VLESS / Trojan با WebSocket
- 🚀 **اجرای محلی Xray** — Xray-core مستقیماً روی همان سرور سایت اجرا می‌شود
- 🔄 **Auto-sync** — تغییرات کانفیگ خودکار در config.json اعمال می‌شوند
- 📱 **QR Code** و **Share Link** خودکار برای هر کانفیگ
- 📥 خروجی **inbound.json** و **Clash YAML**
- 🌐 **مدیریت سرورها** و **کاربران** با سقف داده و تاریخ انقضا
- 📊 **داشبورد آماری** با نمودارهای تعاملی
- 🎨 طراحی **Glassmorphism** با تم تیره و گرادیان بنفش/آبی
- 🇮🇷 کاملاً **فارسی RTL** با فونت Vazirmatn

## 🛠 تکنولوژی‌ها

- **Frontend**: Next.js 16 + TypeScript + Tailwind CSS 4 + shadcn/ui
- **Backend**: Next.js API Routes + Prisma ORM + SQLite
- **Xray**: Xray-core v26+ (به صورت subprocess)
- **Charts**: Recharts
- **Auth**: bcryptjs + custom session
- **QR**: qrcode library

## 🚀 نصب و راه‌اندازی

### پیش‌نیازها

- Node.js 18+ یا Bun
- macOS, Linux, یا WSL
- OpenSSL (برای تولید cert)

### روش سریع

```bash
# 1. Clone the repository
git clone https://github.com/YOUR_USERNAME/fastapicloud-ws-panel.git
cd fastapicloud-ws-panel

# 2. Run setup script (downloads Xray, installs deps, sets up DB)
chmod +x setup.sh
./setup.sh

# 3. Start the dev server
bun run dev    # or: npm run dev
```

سپس به http://localhost:3000 بروید و با `admin / admin123` وارد شوید.

### روش دستی

```bash
# Install dependencies
bun install    # or: npm install

# Download Xray binary
mkdir -p bin xray-data
# Linux 64-bit:
curl -L -o /tmp/xray.zip https://github.com/XTLS/Xray-core/releases/latest/download/Xray-linux-64.zip
unzip /tmp/xray.zip -d /tmp/xray-extracted
cp /tmp/xray-extracted/xray bin/xray
cp /tmp/xray-extracted/geoip.dat xray-data/
cp /tmp/xray-extracted/geosite.dat xray-data/
chmod +x bin/xray

# Generate self-signed cert
openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout xray-data/key.pem \
  -out xray-data/cert.pem \
  -days 365 \
  -subj "/CN=fastapicloud.com" \
  -addext "subjectAltName=DNS:fastapicloud.com,DNS:*.fastapicloud.com"

# Create .env
cat > .env << 'EOF'
DATABASE_URL=file:./db/custom.db
XRAY_PUBLIC_HOST=fastapicloud.com
XRAY_PUBLIC_PORT=8443
XRAY_TLS_ENABLED=true
XRAY_CERT_PATH=xray-data/cert.pem
XRAY_KEY_PATH=xray-data/key.pem
EOF

# Setup database
bunx prisma db push --accept-data-loss
bunx prisma generate

# Start dev server
bun run dev
```

## 📖 استفاده

### 1. ورود به پنل
- آدرس: http://localhost:3000
- نام کاربری: `admin`
- رمز عبور: `admin123`

### 2. بارگذاری داده‌های نمونه (اختیاری)
در داشبورد، روی **«بارگذاری داده‌های نمونه»** کلیک کنید تا ۳ سرور، ۳ کاربر و ۵ کانفیگ نمونه ایجاد شوند.

### 3. اجرای Xray
به بخش **تنظیمات** بروید و در قسمت **«سرور Xray محلی»** روی **«اجرای Xray»** کلیک کنید.

### 4. ساخت کانفیگ جدید
به بخش **کانفیگ‌ها** بروید و روی **«ساخت کانفیگ جدید»** کلیک کنید. کانفیگ به صورت خودکار در Xray اضافه می‌شود.

### 5. دریافت QR Code / Share Link
در جدول کانفیگ‌ها، روی آیکون QR یا لینک اشتراک کلیک کنید.

## ⚙️ تنظیمات محیط (Environment Variables)

| متغیر | پیش‌فرض | توضیح |
|------|---------|--------|
| `DATABASE_URL` | `file:./db/custom.db` | مسیر دیتابیس SQLite |
| `XRAY_PUBLIC_HOST` | `fastapicloud.com` | دامنه‌ای که کلاینت‌ها به آن متصل می‌شوند |
| `XRAY_PUBLIC_PORT` | `8443` | پورت عمومی Xray (در production: 443) |
| `XRAY_TLS_ENABLED` | `true` | فعال/غیرفعال کردن TLS |
| `XRAY_CERT_PATH` | `xray-data/cert.pem` | مسیر فایل گواهی TLS |
| `XRAY_KEY_PATH` | `xray-data/key.pem` | مسیر فایل کلید TLS |

## 🏗 ساختار پروژه

```
fastapicloud-ws-panel/
├── bin/
│   └── xray                    # Xray binary (دانلود شده توسط setup.sh)
├── xray-data/
│   ├── config.json             # تولید دینامیک توسط پنل
│   ├── cert.pem                # گواهی TLS
│   ├── key.pem                 # کلید TLS
│   ├── geoip.dat               # داده‌های GeoIP
│   ├── geosite.dat             # داده‌های GeoSite
│   └── xray.log                # لاگ Xray
├── prisma/
│   └── schema.prisma           # مدل‌های دیتابیس
├── src/
│   ├── app/
│   │   ├── api/                # API routes
│   │   │   ├── auth/           # login, logout, check, password
│   │   │   ├── configs/        # CRUD کانفیگ‌ها
│   │   │   ├── servers/        # CRUD سرورها
│   │   │   ├── users/          # CRUD کاربران
│   │   │   ├── xray/           # start, stop, restart, status, config, logs
│   │   │   ├── qr/             # تولید QR Code
│   │   │   └── seed/           # داده‌های نمونه
│   │   ├── layout.tsx          # RTL فارسی + Vazirmatn
│   │   ├── page.tsx            # Single Page App
│   │   └── globals.css         # استایل Glassmorphism
│   ├── components/
│   │   ├── admin/
│   │   │   ├── login-screen.tsx
│   │   │   ├── sidebar.tsx
│   │   │   ├── dashboard.tsx
│   │   │   ├── configs-table.tsx
│   │   │   ├── servers-manager.tsx
│   │   │   ├── users-manager.tsx
│   │   │   ├── stats-view.tsx
│   │   │   ├── settings-view.tsx
│   │   │   └── xray-local-manager.tsx
│   │   └── ui/                 # shadcn/ui components
│   └── lib/
│       ├── auth.ts             # session management
│       ├── db.ts               # Prisma client
│       ├── v2ray.ts            # share link generators
│       ├── serialize.ts        # BigInt serialization
│       ├── xray-config.ts      # config.json generator
│       └── xray-process.ts     # subprocess manager
├── setup.sh                    # اسکریپت نصب
├── .env                        # تنظیمات محیط
└── package.json
```

## 🌐 Deploy در Production

### روش 1: VPS مستقیم

```bash
# روی VPS:
git clone https://github.com/YOUR_USERNAME/fastapicloud-ws-panel.git
cd fastapicloud-ws-panel
./setup.sh

# تنظیمات production:
echo "XRAY_PUBLIC_PORT=443" >> .env
echo "XRAY_PUBLIC_HOST=your-domain.com" >> .env

# جایگزینی cert واقعی:
cp /etc/letsencrypt/live/your-domain.com/fullchain.pem xray-data/cert.pem
cp /etc/letsencrypt/live/your-domain.com/privkey.pem xray-data/key.pem

# اجرای production:
bun run build
bun run start
```

### روش 2: با Reverse Proxy (Caddy)

اگر Caddy روی پورت 443 دارید، Xray را روی پورت داخلی نگه دارید:

```env
XRAY_PUBLIC_PORT=8443
XRAY_PUBLIC_HOST=your-domain.com
```

سپس در Caddyfile:
```
your-domain.com {
    reverse_proxy /vless/* localhost:8443
    reverse_proxy /trojan/* localhost:8443
    reverse_proxy /* localhost:3000  # پنل
}
```

## 📡 API Reference

### Authentication
- `POST /api/auth/login` — ورود
- `POST /api/auth/logout` — خروج
- `GET /api/auth/check` — بررسی session
- `POST /api/auth/password` — تغییر رمز

### Configs
- `GET /api/configs` — لیست کانفیگ‌ها
- `POST /api/configs` — ساخت کانفیگ جدید
- `GET /api/configs/[id]` — جزئیات + share link
- `PUT /api/configs/[id]` — ویرایش
- `DELETE /api/configs/[id]` — حذف

### Servers
- `GET /api/servers` — لیست سرورها
- `POST /api/servers` — افزودن سرور
- `PUT /api/servers/[id]` — ویرایش
- `DELETE /api/servers/[id]` — حذف

### Users
- `GET /api/users` — لیست کاربران
- `POST /api/users` — افزودن کاربر
- `PUT /api/users/[id]` — ویرایش
- `DELETE /api/users/[id]` — حذف

### Xray Local
- `POST /api/xray/start` — اجرای Xray
- `POST /api/xray/stop` — توقف Xray
- `POST /api/xray/restart` — restart + regenerate config
- `GET /api/xray/status` — وضعیت فعلی
- `GET /api/xray/config` — preview config.json
- `GET /api/xray/logs` — مشاهده لاگ‌ها

### Stats
- `GET /api/stats` — آمار داشبورد
- `GET /api/qr?id=[configId]` — QR Code image

## 🔒 امنیت

- رمز عبور با bcrypt هش می‌شود
- Session در HttpOnly cookie ذخیره می‌شود
- تمام API routes نیاز به احراز هویت دارند
- Xray فقط به private network دسترسی دارد (geoip:private مسدود است)

## 📝 License

MIT License — رایگان برای استفاده شخصی و تجاری

## 🤝 پشتیبانی

برای سوالات و مشکلات، issue در GitHub باز کنید.
