import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '../api';
import { useToast } from '../components/Toast';

function formatBytes(b) {
  if (!b || b === 0) return '۰ بایت';
  const units = ['بایت', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(b) / Math.log(1024));
  const val = (b / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 2);
  return toPersianDigits(val) + ' ' + units[i];
}

function toPersianDigits(s) {
  return String(s).replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
}

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [qrModal, setQrModal] = useState(null);
  const toast = useToast();

  const load = async () => {
    try {
      const d = await api.get('/api/clients');
      setClients(d.clients || []);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (c) => {
    if (!confirm(`حذف کلاینت «${c.remark}»؟ این عمل قابل بازگشت نیست.`)) return;
    try {
      await api.del('/api/clients/' + c.id);
      toast.success('کلاینت حذف شد.');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleToggle = async (c) => {
    try {
      await api.put('/api/clients/' + c.id, { enabled: !c.enabled });
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleRegen = async (c) => {
    if (!confirm('تولید UUID جدید؟ لینک قبلی دیگر کار نخواهد کرد.')) return;
    try {
      await api.post('/api/clients/' + c.id + '/regenerate-uuid');
      toast.success('UUID جدید تولید شد.');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const copyLink = async (c) => {
    try {
      const d = await api.get('/api/clients/' + c.id + '/link');
      await navigator.clipboard.writeText(d.link);
      toast.success('لینک کپی شد.');
    } catch (e) {
      toast.error(e.message);
    }
  };

  const showQr = async (c) => {
    try {
      const d = await api.get('/api/clients/' + c.id + '/link');
      setQrModal({ link: d.link, subUrl: d.subUrl, remark: c.remark });
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">کلاینت‌ها</h1>
          <p className="text-sm text-slate-400 mt-1">مدیریت کاربران VLESS</p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setShowModal(true);
          }}
          className="btn-primary"
        >
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          کلاینت جدید
        </button>
      </div>

      <div className="card !p-0 overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-slate-400">در حال بارگذاری...</div>
        ) : clients.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-slate-400 mb-2">هنوز کلاینتی اضافه نشده است.</div>
            <button
              onClick={() => setShowModal(true)}
              className="btn-primary mt-3"
            >
              افزودن اولین کلاینت
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-right text-xs text-slate-400 border-b border-white/5">
                  <th className="px-4 py-3 font-medium">نام</th>
                  <th className="px-4 py-3 font-medium">UUID</th>
                  <th className="px-4 py-3 font-medium">ترافیک</th>
                  <th className="px-4 py-3 font-medium">انقضا</th>
                  <th className="px-4 py-3 font-medium">وضعیت</th>
                  <th className="px-4 py-3 font-medium text-left">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => {
                  const used = (c.traffic_used_up || 0) + (c.traffic_used_down || 0);
                  const limit = c.traffic_limit_gb
                    ? c.traffic_limit_gb * 1024 * 1024 * 1024
                    : null;
                  const pct = limit ? Math.min(100, (used / limit) * 100) : 0;
                  const expired = c.expires_at && new Date(c.expires_at) < new Date();
                  return (
                    <tr
                      key={c.id}
                      className="border-b border-white/5 hover:bg-white/[0.02] transition"
                    >
                      <td className="px-4 py-3 font-medium text-slate-100">{c.remark}</td>
                      <td className="px-4 py-3">
                        <code className="text-xs text-slate-400 font-mono" dir="ltr">
                          {c.uuid.slice(0, 8)}…
                        </code>
                      </td>
                      <td className="px-4 py-3">
                        {limit ? (
                          <div className="min-w-[120px]">
                            <div className="text-xs text-slate-300">
                              {formatBytes(used)} / {formatBytes(limit)}
                            </div>
                            <div className="w-24 h-1.5 bg-white/5 rounded-full mt-1 overflow-hidden">
                              <div
                                className={
                                  'h-full ' + (pct > 80 ? 'bg-rose-500' : 'bg-gradient-accent')
                                }
                                style={{ width: pct + '%' }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">
                            {formatBytes(used)} <span className="text-slate-600">(نامحدود)</span>
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {c.expires_at ? (
                          <span
                            className={
                              expired ? 'text-rose-400' : 'text-slate-300'
                            }
                          >
                            {toPersianDigits(c.expires_at.slice(0, 10))}
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleToggle(c)}
                          title={c.enabled ? 'غیرفعال کردن' : 'فعال کردن'}
                          className={
                            'relative inline-flex h-5 w-9 items-center rounded-full transition ' +
                            (c.enabled ? 'bg-gradient-accent' : 'bg-white/10')
                          }
                        >
                          <span
                            className={
                              'inline-block h-3.5 w-3.5 transform rounded-full bg-white transition ' +
                              (c.enabled ? '-translate-x-0.5' : '-translate-x-5')
                            }
                          />
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => showQr(c)}
                            title="نمایش QR و لینک"
                            className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-slate-200"
                          >
                            <svg
                              className="w-4 h-4"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0v.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
                              />
                            </svg>
                          </button>
                          <button
                            onClick={() => copyLink(c)}
                            title="کپی لینک اتصال"
                            className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-slate-200"
                          >
                            <svg
                              className="w-4 h-4"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10a2 2 0 00-2 2v1a2 2 0 002 2h12a2 2 0 002-2v-1a2 2 0 00-2-2z"
                              />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleRegen(c)}
                            title="تولید UUID جدید"
                            className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-slate-200"
                          >
                            <svg
                              className="w-4 h-4"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                              />
                            </svg>
                          </button>
                          <button
                            onClick={() => {
                              setEditing(c);
                              setShowModal(true);
                            }}
                            title="ویرایش"
                            className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-slate-200"
                          >
                            <svg
                              className="w-4 h-4"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                              />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(c)}
                            title="حذف"
                            className="p-2 rounded-lg hover:bg-rose-500/10 text-slate-400 hover:text-rose-300"
                          >
                            <svg
                              className="w-4 h-4"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <ClientModal
          client={editing}
          onClose={() => setShowModal(false)}
          onSaved={() => {
            setShowModal(false);
            load();
          }}
        />
      )}

      {qrModal && <QrModal data={qrModal} onClose={() => setQrModal(null)} />}
    </div>
  );
}

function ClientModal({ client, onClose, onSaved }) {
  const toast = useToast();
  const [remark, setRemark] = useState(client?.remark || '');
  const [limitGb, setLimitGb] = useState(client?.traffic_limit_gb || '');
  const [expiresAt, setExpiresAt] = useState(client?.expires_at?.slice(0, 10) || '');
  const [enabled, setEnabled] = useState(client ? client.enabled === 1 : true);
  const [resetTraffic, setResetTraffic] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        remark,
        traffic_limit_gb: limitGb ? parseFloat(limitGb) : null,
        expires_at: expiresAt || null,
        enabled,
        reset_traffic: resetTraffic,
      };
      if (client) {
        await api.put('/api/clients/' + client.id, body);
        toast.success('کلاینت به‌روزرسانی شد.');
      } else {
        await api.post('/api/clients', body);
        toast.success('کلاینت ایجاد شد.');
      }
      onSaved();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div className="card w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-slate-100">
            {client ? 'ویرایش کلاینت' : 'کلاینت جدید'}
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/5 text-slate-400">
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">نام / یادداشت</label>
            <input
              className="input"
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              required
              placeholder="مثلاً: گوشی من"
              autoFocus
            />
          </div>
          <div>
            <label className="label">محدودیت ترافیک (GB) — اختیاری</label>
            <input
              type="number"
              step="0.1"
              min="0"
              className="input"
              value={limitGb}
              onChange={(e) => setLimitGb(e.target.value)}
              placeholder="نامحدود"
              dir="ltr"
            />
          </div>
          <div>
            <label className="label">تاریخ انقضا — اختیاری</label>
            <input
              type="date"
              className="input"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              dir="ltr"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="rounded accent-accent-violet"
            />
            <span className="text-sm text-slate-300">فعال</span>
          </label>
          {client && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={resetTraffic}
                onChange={(e) => setResetTraffic(e.target.checked)}
                className="rounded accent-accent-violet"
              />
              <span className="text-sm text-slate-300">صفر کردن ترافیک مصرف‌شده</span>
            </label>
          )}
          <div className="flex gap-2 pt-2">
            <button type="submit" className="btn-primary flex-1" disabled={saving}>
              {saving ? 'در حال ذخیره...' : 'ذخیره'}
            </button>
            <button type="button" onClick={onClose} className="btn-ghost">
              انصراف
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function QrModal({ data, onClose }) {
  const toast = useToast();
  const [subFullUrl] = useState(() => window.location.origin + data.subUrl);

  const copy = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(label + ' کپی شد.');
    } catch {
      toast.error('کپی ناموفق بود.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div className="card w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-slate-100">{data.remark}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/5 text-slate-400">
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex flex-col items-center gap-4">
          <div className="p-4 bg-white rounded-2xl">
            <QRCodeSVG value={data.link} size={200} level="M" />
          </div>
          <div className="w-full">
            <label className="label">لینک اتصال</label>
            <div className="flex gap-2">
              <input
                readOnly
                value={data.link}
                className="input text-xs font-mono"
                dir="ltr"
                onFocus={(e) => e.target.select()}
              />
              <button onClick={() => copy(data.link, 'لینک')} className="btn-ghost shrink-0">
                کپی
              </button>
            </div>
          </div>
          <div className="w-full">
            <label className="label">لینک اشتراک (Subscription URL)</label>
            <div className="flex gap-2">
              <input
                readOnly
                value={subFullUrl}
                className="input text-xs font-mono"
                dir="ltr"
                onFocus={(e) => e.target.select()}
              />
              <button
                onClick={() => copy(subFullUrl, 'لینک اشتراک')}
                className="btn-ghost shrink-0"
              >
                کپی
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
