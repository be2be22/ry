#!/bin/bash
# Setup script for FastApiCloud WS Config Panel
# Downloads Xray-core binary and prepares the environment
set -e

echo "🚀 FastApiCloud WS Config Panel - Setup"
echo "========================================"

# Check if we're in the project root
if [ ! -f "package.json" ]; then
  echo "❌ Error: package.json not found. Please run this script from the project root."
  exit 1
fi

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
if command -v bun &> /dev/null; then
  bun install
elif command -v npm &> /dev/null; then
  npm install
elif command -v yarn &> /dev/null; then
  yarn install
else
  echo "❌ Error: Neither bun, npm, nor yarn found. Please install one of them."
  exit 1
fi

# Download Xray binary if not present
echo ""
echo "🔧 Setting up Xray-core..."
mkdir -p bin xray-data

if [ -f "bin/xray" ]; then
  echo "✓ Xray binary already exists, skipping download"
else
  echo "⬇️  Downloading Xray-core..."
  
  # Detect architecture
  ARCH=$(uname -m)
  case "$ARCH" in
    x86_64|amd64)
      XRAY_ARCH="64"
      ;;
    aarch64|arm64)
      XRAY_ARCH="arm64-v8a"
      ;;
    *)
      echo "❌ Error: Unsupported architecture: $ARCH"
      exit 1
      ;;
  esac
  
  # Detect OS
  OS=$(uname -s | tr '[:upper:]' '[:lower:]')
  
  DOWNLOAD_URL="https://github.com/XTLS/Xray-core/releases/latest/download/Xray-${OS}-${XRAY_ARCH}.zip"
  echo "   Downloading from: $DOWNLOAD_URL"
  
  curl -L -s -o /tmp/xray.zip "$DOWNLOAD_URL"
  
  echo "   Extracting..."
  unzip -o /tmp/xray.zip -d /tmp/xray-extracted > /dev/null
  
  cp /tmp/xray-extracted/xray bin/xray
  chmod +x bin/xray
  
  cp /tmp/xray-extracted/geoip.dat xray-data/
  cp /tmp/xray-extracted/geosite.dat xray-data/
  
  rm -rf /tmp/xray.zip /tmp/xray-extracted
  
  echo "✓ Xray-core installed: $(bin/xray version | head -1)"
fi

# Generate self-signed certificate for TLS (if not present)
if [ ! -f "xray-data/cert.pem" ]; then
  echo ""
  echo "🔐 Generating self-signed TLS certificate..."
  openssl req -x509 -newkey rsa:2048 -nodes \
    -keyout xray-data/key.pem \
    -out xray-data/cert.pem \
    -days 365 \
    -subj "/CN=fastapicloud.com" \
    -addext "subjectAltName=DNS:fastapicloud.com,DNS:*.fastapicloud.com" 2>/dev/null
  echo "✓ Self-signed certificate generated"
  echo "  ⚠️  For production, replace with a real Let's Encrypt certificate"
fi

# Setup environment file
if [ ! -f ".env" ]; then
  echo ""
  echo "📝 Creating .env file..."
  cat > .env << 'EOF'
DATABASE_URL=file:./db/custom.db
XRAY_PUBLIC_HOST=fastapicloud.com
XRAY_PUBLIC_PORT=8443
XRAY_TLS_ENABLED=true
XRAY_CERT_PATH=xray-data/cert.pem
XRAY_KEY_PATH=xray-data/key.pem
EOF
  echo "✓ .env file created"
fi

# Setup database
echo ""
echo "🗄️  Setting up database..."
mkdir -p db
bunx prisma db push --accept-data-loss 2>/dev/null || npx prisma db push --accept-data-loss
bunx prisma generate 2>/dev/null || npx prisma generate
echo "✓ Database ready"

# Create default admin
echo ""
echo "👤 Creating default admin user..."
node -e "
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const db = new PrismaClient();
(async () => {
  const count = await db.admin.count();
  if (count === 0) {
    const hash = await bcrypt.hash('admin123', 10);
    await db.admin.create({
      data: { username: 'admin', password: hash, email: 'admin@fastapicloud.com', role: 'admin' }
    });
    console.log('✓ Default admin created (username: admin, password: admin123)');
  } else {
    console.log('✓ Admin user already exists');
  }
  await db.\$disconnect();
})();
" 2>/dev/null || echo "⚠️  Could not create admin user (will be created on first login)"

echo ""
echo "========================================"
echo "✅ Setup complete!"
echo ""
echo "🚀 To start the development server:"
echo "   bun run dev    (or: npm run dev)"
echo ""
echo "🌐 Then open: http://localhost:3000"
echo ""
echo "🔐 Default login: admin / admin123"
echo ""
echo "⚙️  To start Xray server:"
echo "   1. Login to the panel"
echo "   2. Go to Settings → سرور Xray محلی"
echo "   3. Click 'اجرای Xray'"
echo ""
echo "📚 For production deployment:"
echo "   - Replace xray-data/cert.pem with real Let's Encrypt cert"
echo "   - Set XRAY_PUBLIC_PORT=443 in .env"
echo "   - Set up a reverse proxy (Caddy/Nginx) if needed"
echo "========================================"
