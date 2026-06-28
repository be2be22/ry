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

# Install Xray-core (latest stable)
ARG XRAY_VERSION=v25.6.16
RUN wget -qO /tmp/xray.zip "https://github.com/XTLS/Xray-core/releases/download/${XRAY_VERSION}/Xray-linux-64.zip" \
    && mkdir -p /usr/local/bin/xray \
    && unzip -o /tmp/xray.zip -d /usr/local/bin/xray/ \
    && chmod +x /usr/local/bin/xray/xray \
    && ln -s /usr/local/bin/xray/xray /usr/local/bin/xray-bin \
    && rm -f /tmp/xray.zip

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
# -----------------------------------------------------------------------------
ENV PANEL_PORT=5000 \
    XRAY_PORT=80 \
    XRAY_WS_PATH="/vless" \
    ADMIN_USER="admin" \
    ADMIN_PASS="" \
    PANEL_SECRET="change-this-secret-in-production" \
    TZ="Asia/Tehran" \
    PUBLIC_DOMAIN=""

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
