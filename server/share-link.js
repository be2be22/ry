function buildShareLink(client, settings) {
  let serverNames = [];
  try {
    serverNames = JSON.parse(settings.reality_server_names);
    if (!Array.isArray(serverNames)) serverNames = [];
  } catch {
    serverNames = [];
  }
  const sni = serverNames[0] || (settings.reality_dest || '').split(':')[0] || '';

  let shortIds = [];
  try {
    shortIds = JSON.parse(settings.reality_short_ids);
    if (!Array.isArray(shortIds)) shortIds = [];
  } catch {
    shortIds = [];
  }
  // Prefer a non-empty short id; fall back to empty ("any")
  const sid = shortIds.find((s) => s && s.length) || shortIds[0] || '';

  const fp = settings.default_fingerprint || 'chrome';
  const host = settings.public_host || 'CHANGE_ME_HOST';
  const port = settings.public_port || settings.xray_port || '8443';
  const serviceName = settings.grpc_service_name || 'GunService';

  const params = new URLSearchParams({
    security: 'reality',
    sni,
    fp,
    pbk: settings.reality_public_key || '',
    sid,
    type: 'grpc',
    serviceName,
    mode: 'gun',
  });

  const remark = encodeURIComponent(client.remark || 'client');
  return `vless://${client.uuid}@${host}:${port}?${params.toString()}#${remark}`;
}

module.exports = { buildShareLink };
