# ============================================================
# CyberX VPN Panel — Dockerfile
# Multi-stage build:
#   1) Download Xray-core
#   2) Build Next.js app
#   3) Production image — nginx (reverse proxy) + Xray + Next.js
#
# Architecture:
#   Railway (443 HTTPS) → nginx (3000) → Next.js (3001) OR Xray (8443)
#   nginx routes:
#     - /vless-ws, /vmess-ws, /trojan-ws, /vless-xhttp → Xray (WebSocket/xHTTP)
#     - /vless-grpc/*, /trojan-grpc/* → Xray (gRPC)
#     - everything else → Next.js
# ============================================================

# ---------- Stage 1: Download Xray-core ----------
FROM alpine:3.20 AS xray-downloader
ARG XRAY_VERSION=v25.1.30
RUN apk add --no-cache curl unzip
WORKDIR /tmp
RUN curl -fsSL "https://github.com/XTLS/Xray-core/releases/download/${XRAY_VERSION}/Xray-linux-64.zip" -o xray.zip \
    && unzip xray.zip -d /tmp/xray \
    && chmod +x /tmp/xray/xray \
    && rm -f xray.zip

# ---------- Stage 2: Build Next.js app ----------
FROM node:22-slim AS builder
WORKDIR /app

# Install OpenSSL (for Prisma) + bun
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && npm install -g bun

# Copy package files
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# Copy source
COPY . .

# Generate Prisma client
RUN bun run db:generate

# Build Next.js (standalone output)
RUN bun run build

# ---------- Stage 3: Production image ----------
FROM node:22-slim AS runner
WORKDIR /app

# Runtime deps: ca-certificates for HTTPS, procps/util-linux for systeminformation,
# openssl for Prisma, nginx for reverse proxy
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    procps \
    util-linux \
    openssl \
    curl \
    nginx \
    && rm -rf /var/lib/apt/lists/*

# Copy Xray binary + geoip/geosite data
COPY --from=xray-downloader /tmp/xray/xray /app/xray-core/xray
COPY --from=xray-downloader /tmp/xray/geoip.dat /app/xray-core/geoip.dat
COPY --from=xray-downloader /tmp/xray/geosite.dat /app/xray-core/geosite.dat
RUN chmod +x /app/xray-core/xray

# Copy Next.js standalone build
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy the FULL node_modules from builder to ensure ALL runtime deps are available
COPY --from=builder /app/node_modules ./node_modules

# Copy Prisma schema (so `prisma db push` can run at runtime)
COPY --from=builder /app/prisma ./prisma

# Copy the runtime seed script
COPY --from=builder /app/scripts/seed-runtime.cjs /app/scripts/seed-runtime.cjs

# Copy nginx config
COPY nginx.conf /etc/nginx/nginx.conf

# Create runtime directories
RUN mkdir -p /app/db /app/backups /app/xray-core /app/data /var/log/nginx /var/run

# Environment defaults (override at deploy time)
# nginx listens on PORT (Railway's exposed port, usually 3000)
# Next.js listens on 3001 (internal only)
# Xray listens on 8443 (internal only)
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_PORT=3001
ENV XRAY_PORT=8443
ENV XRAY_DOMAIN=localhost
ENV DATABASE_URL="file:/app/db/cyberx.db"
ENV NEXTAUTH_SECRET="change-me-in-production-please"
ENV NEXTAUTH_URL="http://localhost:3000"
ENV DEFAULT_ADMIN_PASSWORD="admin12345"

# Expose only the nginx port (Railway's HTTPS port)
# Xray's TCP port (for Reality) needs a separate Railway TCP proxy
EXPOSE 3000

# Startup: init DB, start Xray, start Next.js, start nginx (foreground)
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

CMD ["/app/docker-entrypoint.sh"]
