# ============================================================
# CyberX VPN Panel — Dockerfile
# Multi-stage build: download Xray-core + build Next.js app
# Deployable to Railway with a single click
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

# Install OpenSSL + curl (needed by Prisma) and bun
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

# Install runtime dependencies for systeminformation + sqlite
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    wget \
    unzip \
    procps \
    util-linux \
    && rm -rf /var/lib/apt/lists/*

# Copy Xray binary from downloader stage
COPY --from=xray-downloader /tmp/xray/xray /app/xray-core/xray
RUN chmod +x /app/xray-core/xray

# Copy Next.js standalone build
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy Prisma files (for db:push at runtime)
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma

# Create db directory
RUN mkdir -p /app/db /app/backups /app/xray-core

# Environment defaults
ENV NODE_ENV=production
ENV PORT=3000
ENV XRAY_PORT=8443
ENV XRAY_DOMAIN=localhost
ENV DATABASE_URL="file:/app/db/cyberx.db"
ENV NEXTAUTH_SECRET="change-me-in-production-please"
ENV NEXTAUTH_URL="http://localhost:3000"

EXPOSE 3000
EXPOSE 8443

# Startup script: run db push, seed, start Xray, then start Next.js
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

CMD ["/app/docker-entrypoint.sh"]
