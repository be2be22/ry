# syntax=docker/dockerfile:1.6

# =============================================================================
# Stage 1 — Build the React frontend with Vite
# =============================================================================
FROM node:20-alpine AS client-builder
WORKDIR /app/client

# Install client deps (cached unless package.json changes)
COPY client/package.json client/package-lock.json* ./
RUN npm install --no-audit --no-fund

# Build the client
COPY client/ ./
RUN npm run build

# =============================================================================
# Stage 2 — Install backend production dependencies
# =============================================================================
FROM node:20-alpine AS server-builder
RUN apk add --no-cache python3 make g++ libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund

# =============================================================================
# Stage 3 — Final runtime image
# =============================================================================
FROM node:20-alpine AS runtime
RUN apk add --no-cache ca-certificates wget unzip tini

# --- Download the official Xray-core binary ---
# Update XRAY_VERSION to the latest release from
# https://github.com/XTLS/Xray-core/releases
# (verified: v25.6.8 exists; some intermediate tags are yanked by upstream)
ARG XRAY_VERSION=v25.6.8
RUN set -eux; \
    wget -q -O /tmp/xray.zip \
      "https://github.com/XTLS/Xray-core/releases/download/${XRAY_VERSION}/Xray-linux-64.zip"; \
    mkdir -p /tmp/xray; \
    unzip -o /tmp/xray.zip -d /tmp/xray >/dev/null; \
    mv /tmp/xray/xray /usr/local/bin/xray; \
    chmod +x /usr/local/bin/xray; \
    rm -rf /tmp/xray*; \
    /usr/local/bin/xray version

WORKDIR /app

# --- Node app code + production deps + built frontend ---
COPY --from=server-builder  /app/node_modules ./node_modules
COPY --from=server-builder  /app/package.json ./package.json
COPY server/                ./server/

COPY --from=client-builder  /app/client/dist ./client/dist

# --- Environment ---
# IMPORTANT: do NOT set PORT here — Railway injects $PORT at runtime and the
# panel listens on whatever value Railway provides. Setting PORT in the image
# can cause a mismatch between what the panel listens on and what Railway's
# public domain routes to (→ 502 errors).
ENV DATA_DIR=/data \
    XRAY_BIN=/usr/local/bin/xray \
    STATIC_DIR=/app/client/dist \
    NODE_ENV=production \
    XRAY_PORT=8443 \
    XRAY_API_PORT=10085

RUN mkdir -p /data
# NOTE: do NOT declare a Docker VOLUME here — Railway rejects it.
# Data persists only for the lifetime of the current deploy container.
# To make /data survive redeploys, attach a Railway Volume at /data in the
# service Settings tab (Railway manages the volume outside the Dockerfile).

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server/index.js"]
