# =============================================================================
# Dockerfile - Custom Lightweight Xray Panel (Flask + Xray-core)
# Single-port architecture: Xray on port 80 with fallback to Flask panel
# =============================================================================
FROM alpine:3.19

LABEL maintainer="Custom Xray Panel"
LABEL description="Lightweight Xray management panel with Farsi UI + live logs"
LABEL version="1.0.0"

# -----------------------------------------------------------------------------
# Install: Xray-core, Python, Flask, sqlite, supervisor
# -----------------------------------------------------------------------------
RUN apk add --no-cache --update \
        ca-certificates \
        tzdata \
        curl \
        wget \
        sqlite \
        sqlite-libs \
        python3 \
        py3-pip \
        bash \
        iptables \
    && cp /usr/share/zoneinfo/Asia/Tehran /etc/localtime \
    && echo "Asia/Tehran" > /etc/timezone

# Install Xray-core (latest stable as of 2026-06)
# Updated to v26.3.27 - latest release
ARG XRAY_VERSION=v26.3.27
RUN wget -qO /tmp/xray.zip "https://github.com/XTLS/Xray-core/releases/download/${XRAY_VERSION}/Xray-linux-64.zip" \
    && mkdir -p /usr/local/bin/xray \
    && unzip -o /tmp/xray.zip -d /usr/local/bin/xray/ \
    && chmod +x /usr/local/bin/xray/xray \
    && ln -s /usr/local/bin/xray/xray /usr/local/bin/xray-bin \
    && rm -f /tmp/xray.zip \
    && /usr/local/bin/xray-bin version

# Install Python dependencies (use --break-system-packages for Alpine 3.19+)
COPY requirements.txt /tmp/requirements.txt
RUN pip3 install --no-cache-dir --break-system-packages -r /tmp/requirements.txt

# -----------------------------------------------------------------------------
# App directory structure
# -----------------------------------------------------------------------------
RUN mkdir -p /app /etc/xray /var/log/xray /data

# Copy application files
COPY panel/ /app/
COPY xray_config.template.json /etc/xray/config.template.json
COPY entrypoint.sh /entrypoint.sh
COPY generate_config.py /app/generate_config.py

RUN chmod +x /entrypoint.sh /app/generate_config.py

# -----------------------------------------------------------------------------
# Environment variables (overridable by Bunnyshell)
# NOTE: Secrets (ADMIN_PASS, PANEL_SECRET) are intentionally EMPTY here and
# MUST be set at runtime via Bunnyshell env vars (type: SECRET).
# Defining them with default values in ENV triggers Docker security warnings.
# -----------------------------------------------------------------------------
ENV PANEL_PORT=5000 \
    XRAY_PORT=80 \
    XRAY_WS_PATH="/vless" \
    ADMIN_USER="admin" \
    TZ="Asia/Tehran" \
    PUBLIC_DOMAIN=""
# ADMIN_PASS and PANEL_SECRET are read at runtime, not baked into image.

# -----------------------------------------------------------------------------
# Single public port (80) - Bunnyshell edge forwards HTTPS here
# -----------------------------------------------------------------------------
EXPOSE 80

# -----------------------------------------------------------------------------
# Health check
# -----------------------------------------------------------------------------
HEALTHCHECK --interval=60s --timeout=10s --start-period=30s --retries=3 \
    CMD wget --spider -q "http://127.0.0.1:80/" || exit 1

WORKDIR /app

ENTRYPOINT ["/entrypoint.sh"]
