import { useEffect, useState } from 'react';
import { api } from '../api';
import { useToast } from '../components/Toast';

export default function Settings() {
  const toast = useToast();
  const [s, setS] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [form, setForm] = useState({
    xray_port: '',
    public_host: '',
    public_port: '',
    reality_dest: '',
    reality_server_names: '',
    reality_short_ids: '',
    grpc_service_name: '',
    default_fingerprint: 'chrome',
    xray_log_level: 'warning',
  });

  const load = async () => {
    try {
      const d = await api.get('/api/settings');
      setS(d.settings);
      let serverNames = '';
      let shortIds = '';
      try {
        serverNames = (JSON.parse(d.settings.reality_server_names) || []).join(', ');
      } catch {
        /* ignore */
      }
      try {
        shortIds = (JSON.parse(d.settings.reality_short_ids) || []).join(', ');
      } catch {
        /* ignore */
      }
      setForm({
        xray_port: d.settings.xray_port || '',
        public_host: d.settings.public_host || '',
        public_port: d.settings.public_port || '',
        reality_dest: d.settings.reality_dest || '',
        reality_server_names: serverNames,
        reality_short_ids: shortIds,
        grpc_service_name: d.settings.grpc_service_name || '',
        default_fingerprint: d.settings.default_fingerprint || 'chrome',
        xray_log_level: d.settings.xray_log_level || 'warning',
      });
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const serverNames = form.reality_server_names
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);
      const shortIds = form.reality_short_ids
        .split(',')
        .map((x) => x.trim())
        // allow empty string entries (they mean "any")
        .filter((x, i, arr) => x !== '' || arr.length === 1);
      await api.put('/api/settings', {
        xray_port: form.xray_port,
        public_host: form.public_host,
        public_port: form.public_port,
        reality_dest: form.reality_dest,
        reality_server_names: JSON.stringify(serverNames),
        reality_short_ids: JSON.stringify(shortIds),
        grpc_service_name: form.grpc_service_name,
        default_fingerprint: form.default_fingerprint,
        xray_log_level: form.xray_log_level,
      });
      toast.success('تنظیمات ذخیره شد. Xray در حال ری‌استارت است.');
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const genKeypair = async () => {
    if (!confirm('تولید کلید REALITY جدید؟ تمام کلاینت‌ها باید لینک جدید دریافت کنند.')) return;
    setGenerating(true);
    try {
      const d = await api.post('/api/settings/generate-keypair');
      toast.success('کلید REALITY جدید تولید شد. PublicKey: ' + d.publicKey.slice(0, 12) + '…');
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setGenerating(false);
    }
  };

  const genShortId = async () => {
    try {
      const d = await api.post('/api/settings/generate-shortid');
      toast.success('ShortId جدید اضافه شد.');
      setForm((f) => ({ ...f, reality_short_ids: (d.shortIds || []).join(', ') }));
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  if (loading || !s) {
    return <div className="text-center py-12 text-slate-400">در حال بارگذاری...</div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">تنظیمات</h1>
        <p className="text-sm text-slate-400 mt-1">پیکربندی سرور و REALITY</p>
      </div>

      <form onSubmit={save} className="card space-y-5">
        <h2 className="text-base font-semibold text-slate-100 border-b border-white/5 pb-3">
          اتصال
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="label">پورت داخلی Xray</label>
            <input
              className="input"
              value={form.xray_port}
              onChange={(e) => setForm({ ...form, xray_port: e.target.value })}
              dir="ltr"
            />
            <p className="text-xs text-slate-500 mt-1">
              پورتی که Xray روی آن گوش می‌دهد (env: XRAY_PORT)
            </p>
          </div>
          <div>
            <label className="label">هاست عمومی (TCP Proxy)</label>
            <input
              className="input"
              value={form.public_host}
              onChange={(e) => setForm({ ...form, public_host: e.target.value })}
              placeholder="example.up.railway.app"
              dir="ltr"
            />
            <p className="text-xs text-slate-500 mt-1">
              هاستی که Railway بعد از فعال‌سازی TCP Proxy به شما می‌دهد.
            </p>
          </div>
          <div>
            <label className="label">پورت عمومی (TCP Proxy)</label>
            <input
              className="input"
              value={form.public_port}
              onChange={(e) => setForm({ ...form, public_port: e.target.value })}
              placeholder="مثلاً 12345"
              dir="ltr"
            />
            <p className="text-xs text-slate-500 mt-1">
              پورتی که Railway برای TCP Proxy اختصاص می‌دهد.
            </p>
          </div>
        </div>

        <h2 className="text-base font-semibold text-slate-100 border-b border-white/5 pb-3 pt-2">
          REALITY
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">مخفی‌سازی (dest)</label>
            <input
              className="input"
              value={form.reality_dest}
              onChange={(e) => setForm({ ...form, reality_dest: e.target.value })}
              placeholder="www.microsoft.com:443"
              dir="ltr"
            />
            <p className="text-xs text-slate-500 mt-1">
              یک سایت معتبر با TLS 1.3 و HTTP/2 — ترجیحاً سایت پرترافیک.
            </p>
          </div>
          <div>
            <label className="label">serverNames (با کاما جدا کنید)</label>
            <input
              className="input"
              value={form.reality_server_names}
              onChange={(e) => setForm({ ...form, reality_server_names: e.target.value })}
              placeholder="www.microsoft.com"
              dir="ltr"
            />
            <p className="text-xs text-slate-500 mt-1">
              معمولاً همان دامنه‌ی dest بدون :443
            </p>
          </div>
          <div>
            <label className="label">shortIds (با کاما جدا کنید)</label>
            <input
              className="input"
              value={form.reality_short_ids}
              onChange={(e) => setForm({ ...form, reality_short_ids: e.target.value })}
              placeholder="خالی = هر ID، یا رشته هگز ۸ کاراکتری"
              dir="ltr"
            />
            <p className="text-xs text-slate-500 mt-1">
              برای پذیرفتن هر shortId، یک مقدار خالی بگذارید.
            </p>
          </div>
          <div>
            <label className="label">gRPC serviceName</label>
            <input
              className="input"
              value={form.grpc_service_name}
              onChange={(e) => setForm({ ...form, grpc_service_name: e.target.value })}
              placeholder="GunService"
              dir="ltr"
            />
          </div>
          <div>
            <label className="label">Fingerprint پیش‌فرض کلاینت</label>
            <select
              className="input"
              value={form.default_fingerprint}
              onChange={(e) => setForm({ ...form, default_fingerprint: e.target.value })}
            >
              <option value="chrome">chrome</option>
              <option value="firefox">firefox</option>
              <option value="safari">safari</option>
              <option value="ios">ios</option>
              <option value="android">android</option>
              <option value="edge">edge</option>
              <option value="random">random</option>
            </select>
          </div>
          <div>
            <label className="label">سطح لاگ Xray</label>
            <select
              className="input"
              value={form.xray_log_level}
              onChange={(e) => setForm({ ...form, xray_log_level: e.target.value })}
            >
              <option value="debug">debug</option>
              <option value="info">info</option>
              <option value="warning">warning (پیشنهادی)</option>
              <option value="error">error</option>
              <option value="none">none</option>
            </select>
          </div>
        </div>

        <div className="rounded-xl bg-bg-700/40 border border-white/5 p-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="min-w-0">
              <div className="text-sm font-medium text-slate-200">کلید عمومی REALITY (pbk)</div>
              <code
                className="text-xs text-slate-400 font-mono mt-1 block break-all"
                dir="ltr"
              >
                {s?.reality_public_key || '— هنوز تولید نشده —'}
              </code>
              <div className="text-xs text-slate-500 mt-1">
                این مقدار در لینک کلاینت‌ها قرار می‌گیرد. کلید خصوصی هرگز به کلاینت داده نمی‌شود.
              </div>
            </div>
            <button
              type="button"
              onClick={genKeypair}
              disabled={generating}
              className="btn-ghost shrink-0"
            >
              {generating ? 'در حال تولید...' : 'تولید کلید جدید'}
            </button>
          </div>
        </div>

        <div className="flex justify-between items-center pt-2">
          <button type="button" onClick={genShortId} className="btn-ghost text-xs">
            + افزودن shortId تصادفی
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'در حال ذخیره...' : 'ذخیره و ری‌استارت Xray'}
          </button>
        </div>
      </form>

      <div className="card text-sm text-slate-400 leading-6">
        <div className="font-semibold text-slate-200 mb-2">یادآوری Railway</div>
        <ol className="list-decimal pr-5 space-y-1">
          <li>پورت داخلی Xray را روی <code className="font-mono text-slate-300">XRAY_PORT</code> تنظیم کنید.</li>
          <li>در تنظیمات سرویس Railway، TCP Proxy را روی همان پورت فعال کنید.</li>
          <li>هاست و پورت عمومی که Railway می‌دهد را در همین فرم وارد کنید.</li>
          <li>یک Volume روی <code className="font-mono text-slate-300">/data</code> مانت کنید تا داده‌ها پس از redeploy باقی بمانند.</li>
        </ol>
      </div>
    </div>
  );
}
