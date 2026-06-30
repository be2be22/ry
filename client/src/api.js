const BASE = '';

async function request(method, path, body, opts = {}) {
  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (token && !opts._noAuth) headers.Authorization = 'Bearer ' + token;

  const fetchOpts = { method, headers };
  if (body !== undefined) fetchOpts.body = JSON.stringify(body);

  const res = await fetch(BASE + path, fetchOpts);

  if (opts._raw) return res;

  if (res.status === 401) {
    localStorage.removeItem('token');
    if (!window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
  }

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const msg = (data && data.error) || 'HTTP ' + res.status;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  get: (p, opts) => request('GET', p, undefined, opts),
  post: (p, body, opts) => request('POST', p, body, opts),
  put: (p, body, opts) => request('PUT', p, body, opts),
  del: (p, opts) => request('DELETE', p, undefined, opts),
};
