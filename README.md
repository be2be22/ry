# سایبر‌ایکس — پنل مدیریت VPN مبتنی بر Xray-core

> یک پنل کامل، حرفه‌ای و آماده‌ی استقرار روی Railway برای مدیریت Xray-core با رابط کاربری سایبرپانک فارسی (RTL)

![CyberX](https://img.shields.io/badge/CyberX-VPN%20Panel-2de8d0?style=for-the-badge)
![Xray-core](https://img.shields.io/badge/Xray--core-v25-ff2f6e?style=for-the-badge)
![Railway](https://img.shields.io/badge/Deploy-Railway-b388ff?style=for-the-badge)
![Persian](https://img.shields.io/badge/UI-Persian%20RTL-69f0ae?style=for-the-badge)

---

## ✨ ویژگی‌ها

### 🎨 طراحی سایبرپانک آرکید
- پس‌زمینه تیره نزدیک به مشکی با质感 CRT و خطوط scanline محو
- رنگ اصلی نئون cyan (#2de8d0) و رنگ ثانویه magenta (#ff2f6e)
- فونت pixel-flavored برای عنوان‌ها (Press Start 2P) و فونت Vazirmatn برای متن فارسی
- افکت glow روی متن‌ها و borders، انیمیشن pulse روی دکمه‌های اصلی
- لی‌اوت کاملاً RTL و فارسی

### 🚀 داشبورد زنده
- نمودار زنده CPU، RAM، دیسک و آپ‌تایم سرور (به‌روزرسانی هر ۳ ثانیه)
- نمودار ترافیک آپلود/دانلود ۲۴ ساعت گذشته
- شمارش کاربران آنلاین/کل/منقضی
- وضعیت Xray با دکمه ری‌استارت سریع
- نمودارهای radial gauge برای مصرف منابع

### 👥 مدیریت کاربران
- هر کاربر به‌صورت خودکار **۸ کانفیگ** در پروتکل‌های مختلف دریافت می‌کند:
  1. VLESS + WS + TLS
  2. VLESS + gRPC + TLS
  3. VMess + WS + TLS
  4. Trojan + WS + TLS
  5. Trojan + gRPC + TLS
  6. VLESS + XTLS-Reality
  7. VLESS + xHTTP + TLS
  8. VLESS + TCP + XTLS-Vision
- سهمیه داده (GB) با نمایش مصرف و باقی‌مانده
- تاریخ انقضا با نمایش تقویم جلالی
- حداکثر دستگاه همزمان
- فعال/غیرفعال‌سازی، تعلیق، صفر کردن مصرف
- شبیه‌سازی کاربر (Clone) برای ساخت سریع کاربر مشابه
- یادداشت و برچسب‌های دلخواه
- محدودیت IP/کشور (اختیاری)
- خروجی CSV از همه کاربران

### 📄 صفحه اشتراک ویژه
- لینک اشتراک یونیک UUID-based برای هر کاربر: `https://yourapp.up.railway.app/sub/<token>`
- پشتیبانی از فرمت base64 برای v2rayNG، Hiddify، Streisand، NapsternetV
- صفحه وب با glassmorphism و افکت ذرات متحرک
- QR code برای هر کانفیگ برای اسکن مستقیم
- دکمه‌های «کپی لینک» و «افزودن به اپ» (deep link برای v2rayNG/Hiddify/Streisand)
- نوار پیشرفت انیمیشن‌دار برای داده و زمان باقی‌مانده
- راهنمای نصب بصری برای Android/iOS/Windows
- کاملاً ریسپانسیو و PWA (قابل نصب روی موبایل)

### ⚙️ تنظیمات پیشرفته
- مدیریت گرافیکی اینباندها — بدون نیاز به ویرایش JSON
- تنظیمات دامنه و SSL
- بکاپ‌گیری خودکار و دستی از دیتابیس + دانلود فایل بکاپ
- یکپارچه‌سازی ربات تلگرام برای نوتیفیکیشن (کاربر جدید، هشدار داده، آنلاین/آفلاین سرور)
- پشتیبانی چندزبانه (فارسی پیش‌فرض، انگلیسی اختیاری)
- چند ادمین با سطوح دسترسی مختلف (Super Admin / Limited Admin)
- احراز هویت دومرحله‌ای (TOTP / Google Authenticator)
- Rate-limiting روی صفحه ورود برای جلوگیری از brute force
- لاگ ممیزی کامل از همه اکشن‌ها

### 🌐 صفحه وضعیت عمومی
- نمایش آپ‌تایم سرور بدون نیاز به ورود
- وضعیت Xray، سرور وب، کاربران فعال
- به‌روزرسانی خودکار هر ۵ ثانیه

### 🛠 ابزارهای اضافی
- سیستم پلن/بسته پیش‌فرض برای ساخت سریع کاربر (۳۰GB/۳۰ روز و...)
- ابزار سلامت‌یابی کانفیگ (Health Check)
- خروجی Excel/CSV از کاربران
- PWA برای صفحه اشتراک

---

## 🏗 معماری

```
┌─────────────────────────────────────────────────────────────┐
│                      Container واحد                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Next.js 16 (App Router) — پنل + API               │   │
│  │  ├── /login           (صفحه ورود)                   │   │
│  │  ├── /dashboard/*     (پنل ادمین — نیاز به ورود)   │   │
│  │  ├── /sub/[token]     (صفحه اشتراک کاربر — عمومی)  │   │
│  │  ├── /status          (صفحه وضعیت — عمومی)         │   │
│  │  └── /api/*           (REST API)                   │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Xray-core (Child Process)                          │   │
│  │  ├── VLESS+WS+TLS     ├── Trojan+WS+TLS             │   │
│  │  ├── VLESS+gRPC+TLS   ├── Trojan+gRPC+TLS           │   │
│  │  ├── VMess+WS+TLS     ├── VLESS+xHTTP+TLS           │   │
│  │  ├── VLESS+Reality    └── VLESS+TCP+XTLS-Vision     │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌──────────────────┐                                       │
│  │  SQLite (Prisma) │  فایل: /app/db/cyberx.db             │
│  └──────────────────┘                                       │
└─────────────────────────────────────────────────────────────┘
                          ↓
              ┌──────────────────────┐
              │  Railway Reverse Proxy │  (HTTPS/WSS رایگان)
              │  TLS termination      │
              └──────────────────────┘
                          ↓
                    اینترنت (پورت ۴۴۳)
```

### انتخاب‌های مهندسی
- **Next.js 16 fullstack** (نه Express جداگانه): برای ساده‌سازی deploy روی Railway با یک کانتینر
- **SQLite** (نه PostgreSQL): سبک، فایل-بیس، بدون نیاز به add-on پولی Railway
- **Xray-core به‌عنوان child process**: در همان کانتینر، نه سرور جداگانه
- **TLS توسط Railway**: همه پروتکل‌ها روی WSS/HTTPS کار می‌کنند، چون Railway TLS را خاتمه می‌دهد
- **Prisma ORM**: migration-aware، type-safe
- **NextAuth + bcrypt + TOTP**: استاندارد صنعتی
- **shadcn/ui + Tailwind**: توسعه سریع و سازگار با RTL

---

## 🚀 راه‌اندازی روی Railway (صفر تا صد)

### مرحله ۱: آماده‌سازی مخزن
این پروژه را روی GitHub خود fork کنید (یا با git clone بگیرید و push کنید).

### مرحله ۲: ساخت پروژه روی Railway
1. به [railway.app](https://railway.app) بروید و وارد شوید
2. روی **New Project** کلیک کنید
3. **Deploy from GitHub repo** را انتخاب کنید
4. مخزن خود را انتخاب کنید
5. Railway به‌صورت خودکار `Dockerfile` را تشخیص می‌دهد

### مرحله ۳: تنظیم متغیرهای محیطی
در تب **Variables** مقادیر زیر را تنظیم کنید:

| متغیر | مقدار پیشنهادی | توضیح |
|------|----------------|-------|
| `NEXTAUTH_SECRET` | رشته‌ی تصادفی ۳۲ کاراکتری | **الزامی** — با `openssl rand -hex 32` بسازید |
| `XRAY_DOMAIN` | `yourapp.up.railway.app` | دامنه Railway شما (پس از اولین deploy معلوم می‌شود) |
| `XRAY_PORT` | `8443` | پورت داخلی Xray |
| `PORT` | `3000` | پورت Next.js (Railway خودش تنظیم می‌کند) |
| `DEFAULT_ADMIN_PASSWORD` | رمز دلخواه | رمز ادمین پیش‌فرض (اگر تنظیم نشود: `admin12345`) |
| `DATABASE_URL` | `file:/app/db/cyberx.db` | مسیر دیتابیس (پیش‌فرض درست است) |

### مرحله ۴: تنظیم دامنه
1. در تب **Settings** → **Networking**
2. روی **Generate Domain** کلیک کنید
3. Railway دامنه‌ای مثل `yourapp.up.railway.app` به شما می‌دهد
4. این دامنه را در متغیر `XRAY_DOMAIN` و در بخش Settings پنل قرار دهید

### مرحله ۵: اولین ورود
1. به `https://yourapp.up.railway.app/login` بروید
2. با `admin` / `admin12345` (یا رمزی که تنظیم کردید) وارد شوید
3. **همچنان بعد از اولین ورود، رمز ادمین را از تنظیمات تغییر دهید!**

### مرحله ۶: تنظیم Xray
1. به بخش **اینباندها** بروید — ۸ اینباند پیش‌فرض آماده است
2. در بخش **تنظیمات**، دامنه را تأیید کنید
3. روی دکمه **Start Xray** در sidebar کلیک کنید

### مرحله ۷: ساخت کاربر و دریافت کانفیگ
1. به بخش **کاربران** بروید
2. روی **ایجاد کاربر** بزنید
3. بعد از ساخت، روی آیکون لینک کنار کاربر کلیک کنید
4. صفحه اشتراک باز می‌شود با ۸ کانفیگ + QR code + راهنمای نصب
5. لینک اشتراک را به کاربر بدهید

---

## 🛠 توسعه محلی

### پیش‌نیازها
- Node.js 22+ و Bun (یا npm)
- سیستم‌عامل لینوکس/مک (برای اجرای Xray-core)

### نصب
```bash
# نصب وابستگی‌ها
bun install

# ساخت دیتابیس
bun run db:push

# seed داده‌های اولیه (ادمین، اینباندها، بسته‌ها)
bun run scripts/seed.ts

# اجرای سرور توسعه
bun run dev
```

سپس به `http://localhost:3000/login` بروید و با `admin` / `admin12345` وارد شوید.

### اجرای Xray به‌صورت محلی
اگر می‌خواهید Xray واقعی اجرا شود:
```bash
# دانلود Xray-core
mkdir -p xray-core
cd xray-core
curl -fsSL https://github.com/XTLS/Xray-core/releases/latest/download/Xray-linux-64.zip -o xray.zip
unzip xray.zip && rm xray.zip && chmod +x xray
cd ..

# حالا وقتی پنل را اجرا می‌کنید، به‌صورت خودکار Xray را هم اجرا می‌کند
```

اگر Xray موجود نباشد، پنل در حالت **شبیه‌سازی** اجرا می‌شود (برای توسعه UI).

---

## 📁 ساختار پروژه

```
.
├── prisma/
│   └── schema.prisma              # اسکیمای دیتابیس
├── src/
│   ├── app/
│   │   ├── layout.tsx             # لی‌اوت RTL + فونت‌های فارسی
│   │   ├── globals.css            # تم سایبرپانک
│   │   ├── page.tsx               # روت اصلی (redirect)
│   │   ├── login/                 # صفحه ورود
│   │   ├── dashboard/             # پنل ادمین (محافظت‌شده)
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx           # داشبورد اصلی
│   │   │   ├── users/             # مدیریت کاربران
│   │   │   ├── inbounds/          # مدیریت اینباندها
│   │   │   ├── plans/             # بسته‌ها
│   │   │   ├── audit/             # لاگ ممیزی
│   │   │   ├── backups/           # بکاپ‌ها
│   │   │   └── settings/          # تنظیمات (تلگرام، ادمین، ۲FA)
│   │   ├── sub/[token]/           # صفحه اشتراک کاربر (عمومی)
│   │   ├── status/                # صفحه وضعیت عمومی
│   │   └── api/                   # REST API
│   │       ├── auth/              # NextAuth
│   │       ├── stats/             # آمار زنده سرور
│   │       ├── users/             # CRUD کاربران
│   │       ├── inbounds/          # CRUD اینباندها
│   │       ├── plans/             # CRUD بسته‌ها
│   │       ├── settings/          # تنظیمات
│   │       ├── audit/             # لاگ ممیزی
│   │       ├── backups/           # بکاپ‌گیری
│   │       ├── admins/            # مدیریت ادمین‌ها
│   │       ├── 2fa/               # احراز هویت دومرحله‌ای
│   │       ├── xray/              # کنترل پردازش Xray
│   │       ├── sub/[token]/       # خروجی base64 اشتراک
│   │       ├── telegram/          # تست ربات تلگرام
│   │       ├── health-check/      # سلامت‌یابی کانفیگ
│   │       ├── export/            # خروجی CSV
│   │       └── public/            # API عمومی (بدون ورود)
│   ├── components/
│   │   ├── ui/                    # shadcn/ui
│   │   ├── cyber/                 # کامپوننت‌های سایبرپانک
│   │   ├── layout/                # sidebar و shell
│   │   └── subscription/          # صفحه اشتراک
│   └── lib/
│       ├── auth.ts                # NextAuth config
│       ├── xray.ts                # مدیر پردازش Xray
│       ├── subscription.ts        # تولید لینک‌های ۸ پروتکل
│       ├── jalali.ts              # تبدیل تاریخ شمسی
│       ├── stats.ts               # جمع‌آوری آمار سرور
│       ├── format.ts              # فرمت‌بندی نمایشی
│       ├── totp.ts                # TOTP wrapper
│       ├── audit.ts               # لاگ ممیزی
│       ├── i18n.ts                # رشته‌های چندزبانه
│       └── db.ts                  # Prisma client
├── xray-core/                     # باینری Xray (در runtime دانلود می‌شود)
├── scripts/
│   └── seed.ts                    # اسکریپت seed
├── Dockerfile                     # Multi-stage build
├── docker-entrypoint.sh           # اسکریپت راه‌اندازی
├── railway.json                   # کانفیگ Railway
├── .dockerignore
└── README.md                      # این فایل
```

---

## 🔒 امنیت

### نکات مهم برای محیط تولید
1. **حتماً رمز ادمین پیش‌فرض را تغییر دهید** (از بخش تنظیمات)
2. `NEXTAUTH_SECRET` را با رشته‌ی تصادفی ۳۲+ کاراکتری تنظیم کنید
3. احراز هویت دومرحله‌ای (۲FA) را برای ادمین فعال کنید
4. اگر با چند ادمین کار می‌کنید، فقط یک نفر Super Admin باشد
5. بکاپ‌های منظم بگیرید (بخش بکاپ‌ها)

### محدودیت‌های Railway
- Railway فقط ترافیک **HTTPS/WSS** را روی پورت ۴۴۳ اکسپوز می‌کند
- اتصال TCP خام در دسترس نیست — به همین دلیل Reality و XTLS-Vision **به‌طور کامل کار نمی‌کنند** (کانفیگ تولید می‌شود اما اتصال واقعی ممکن نیست)
- پروتکل‌های WS, gRPC, xHTTP که روی HTTP/2 یا WebSocket کار می‌کنند، کاملاً عملیاتی هستند

---

## 🤝 مشارکت

PR و issue привет! لطفاً قبل از مشارکت:
1. یک branch جدید بسازید
2. کد را با `bun run lint` بررسی کنید
3. تغییرات را با پیام commit فارسی/انگلیسی واضح ثبت کنید

---

## 📜 لایسنس

MIT License — آزاد برای استفاده تجاری و شخصی.

---

**ساخته‌شده با ❤️ و ☕ — CyberX VPN Panel**
