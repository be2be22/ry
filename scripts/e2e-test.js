// Full authenticated flow test:
// 1. Boot server (fresh DATA_DIR)
// 2. Parse admin password from stdout
// 3. Login → get JWT
// 4. GET /api/clients (should be empty array)
// 5. POST /api/clients (create one)
// 6. GET /api/clients (should have 1)
// 7. GET /api/clients/:id/link (should return vless:// link)
// 8. GET /sub/:token (should return base64 of link)
// 9. DELETE /api/clients/:id
// 10. GET /api/clients (should be empty again)
const http = require('http');
const { spawn } = require('child_process');

const DATA_DIR = '/home/z/my-project/xray-panel/.data-e2e';
const env = {
  ...process.env,
  DATA_DIR,
  XRAY_BIN: '/bin/true',
  PORT: '3198',
};

const { execSync } = require('child_process');
try { execSync('rm -rf ' + DATA_DIR); } catch {}

const proc = spawn('node', ['server/index.js'], {
  cwd: '/home/z/my-project/xray-panel',
  env,
  stdio: ['ignore', 'pipe', 'pipe'],
});

let password = null;
proc.stdout.on('data', (d) => {
  const s = d.toString();
  process.stdout.write('[server] ' + s);
  const m = s.match(/password:\s*(\S+)/);
  if (m) password = m[1];
});
proc.stderr.on('data', (d) => process.stderr.write('[server-err] ' + d.toString()));

function req(path, opts = {}) {
  return new Promise((resolve, reject) => {
    const r = http.request(
      { host: '127.0.0.1', port: env.PORT, path, method: opts.method || 'GET', headers: opts.headers || {} },
      (res) => {
        let body = '';
        res.on('data', (d) => (body += d));
        res.on('end', () => resolve({ status: res.statusCode, body, headers: res.headers }));
      }
    );
    r.on('error', reject);
    if (opts.body) r.write(opts.body);
    r.end();
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  await sleep(1500);
  if (!password) { console.error('Could not capture admin password'); process.exit(1); }

  try {
    // 1. Login
    const login = await req('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password }),
    });
    if (login.status !== 200) throw new Error('login failed: ' + login.status + ' ' + login.body);
    const token = JSON.parse(login.body).token;
    console.log('1. LOGIN OK, got JWT');

    const authHeaders = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token };

    // 2. GET /api/clients (empty)
    let r = await req('/api/clients', { headers: authHeaders });
    if (r.status !== 200) throw new Error('clients list failed');
    let clients = JSON.parse(r.body).clients;
    if (clients.length !== 0) throw new Error('expected empty clients, got ' + clients.length);
    console.log('2. CLIENTS list empty OK');

    // 3. POST create
    r = await req('/api/clients', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ remark: 'test-phone', traffic_limit_gb: 10, enabled: true }),
    });
    if (r.status !== 200) throw new Error('create failed: ' + r.body);
    const client = JSON.parse(r.body).client;
    if (!client.uuid || !client.link || !client.link.startsWith('vless://')) {
      throw new Error('client missing uuid/link: ' + JSON.stringify(client));
    }
    console.log('3. CREATE OK — uuid=' + client.uuid.slice(0, 8) + ', link starts with vless://');
    console.log('   link=' + client.link);

    // 4. GET link endpoint
    r = await req('/api/clients/' + client.id + '/link', { headers: authHeaders });
    if (r.status !== 200) throw new Error('link endpoint failed');
    const linkData = JSON.parse(r.body);
    if (!linkData.link || !linkData.subUrl) throw new Error('missing link fields');
    console.log('4. LINK endpoint OK — subUrl=' + linkData.subUrl);

    // 5. GET /sub/:token (no auth needed)
    r = await req(linkData.subUrl);
    if (r.status !== 200) throw new Error('sub endpoint failed: ' + r.status + ' ' + r.body);
    // Should be base64 of the vless link
    const decoded = Buffer.from(r.body, 'base64').toString('utf-8');
    if (!decoded.startsWith('vless://')) throw new Error('sub did not return base64 vless link');
    const subInfo = r.headers['subscription-userinfo'];
    if (!subInfo || !subInfo.includes('upload=') || !subInfo.includes('total=')) {
      throw new Error('missing Subscription-Userinfo header: ' + subInfo);
    }
    console.log('5. SUB endpoint OK — decoded vless link, Subscription-Userinfo present');
    console.log('   Subscription-Userinfo=' + subInfo);

    // 6. Disable the client
    r = await req('/api/clients/' + client.id, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ enabled: false }),
    });
    if (r.status !== 200) throw new Error('disable failed');
    console.log('6. DISABLE OK');

    // 7. Sub endpoint should now 403
    r = await req(linkData.subUrl);
    if (r.status !== 403) throw new Error('expected 403 for disabled client, got ' + r.status);
    console.log('7. SUB on disabled client → 403 OK');

    // 8. Re-enable
    await req('/api/clients/' + client.id, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ enabled: true }),
    });

    // 9. Regenerate UUID
    r = await req('/api/clients/' + client.id + '/regenerate-uuid', {
      method: 'POST',
      headers: authHeaders,
    });
    if (r.status !== 200) throw new Error('regen failed');
    const regenClient = JSON.parse(r.body).client;
    if (regenClient.uuid === client.uuid) throw new Error('UUID did not change');
    console.log('9. REGEN-UUID OK — new uuid=' + regenClient.uuid.slice(0, 8));

    // 10. DELETE
    r = await req('/api/clients/' + client.id, { method: 'DELETE', headers: authHeaders });
    if (r.status !== 200) throw new Error('delete failed');
    r = await req('/api/clients', { headers: authHeaders });
    clients = JSON.parse(r.body).clients;
    if (clients.length !== 0) throw new Error('expected empty after delete');
    console.log('10. DELETE OK — clients list is empty again');

    // 11. Settings
    r = await req('/api/settings', { headers: authHeaders });
    if (r.status !== 200) throw new Error('settings get failed');
    const settings = JSON.parse(r.body).settings;
    if (settings.reality_private_key !== undefined) {
      throw new Error('private key leaked in settings response!');
    }
    if (!settings.reality_dest) throw new Error('missing default reality_dest');
    console.log('11. SETTINGS OK — private key NOT leaked, defaults present');

    console.log('\n=== Full E2E flow passed ===');
  } catch (e) {
    console.error('E2E test failed:', e.message);
    process.exit(1);
  } finally {
    proc.kill('SIGTERM');
    setTimeout(() => process.exit(0), 300);
  }
})();
