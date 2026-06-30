import { useEffect, useState, useRef } from 'react';
import { api } from '../api';
import { useToast } from '../components/Toast';

export default function Logs() {
  const toast = useToast();
  const [logs, setLogs] = useState([]);
  const [type, setType] = useState('error');
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [total, setTotal] = useState(0);
  const scrollRef = useRef(null);

  const load = async () => {
    try {
      const d = await api.get('/api/logs?type=' + type + '&lines=200');
      setLogs(d.logs || []);
      setTotal(d.total || 0);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    load();
  }, [type]);

  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [autoRefresh, type]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">لاگ‌ها</h1>
          <p className="text-sm text-slate-400 mt-1">آخرین خطوط لاگ Xray</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-xl bg-bg-700/60 border border-white/10 p-1">
            <button
              onClick={() => setType('error')}
              className={
                'px-3 py-1.5 rounded-lg text-xs font-medium transition ' +
                (type === 'error' ? 'bg-gradient-accent text-white' : 'text-slate-400')
              }
            >
              خطا
            </button>
            <button
              onClick={() => setType('access')}
              className={
                'px-3 py-1.5 rounded-lg text-xs font-medium transition ' +
                (type === 'access' ? 'bg-gradient-accent text-white' : 'text-slate-400')
              }
            >
              دسترسی
            </button>
          </div>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={'btn-ghost ' + (autoRefresh ? '!text-emerald-300' : '')}
          >
            <span
              className={
                'w-2 h-2 rounded-full ' +
                (autoRefresh ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500')
              }
            />
            {autoRefresh ? 'خودکار' : 'متوقف'}
          </button>
          <button onClick={load} className="btn-ghost" title="بارگذاری مجدد">
            <svg
              className={'w-4 h-4 ' + (loading ? 'animate-spin' : '')}
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
        </div>
      </div>

      <div className="card !p-0">
        <div className="px-4 py-2 border-b border-white/5 text-xs text-slate-500 flex items-center justify-between">
          <span>
            {type === 'access' ? 'لاگ دسترسی' : 'لاگ خطا'} — {total} خط
          </span>
          <span>آخرین ۲۰۰ خط</span>
        </div>
        {loading ? (
          <div className="text-center py-12 text-slate-400">در حال بارگذاری...</div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">
            خطی موجود نیست. سطح لاگ را در تنظیمات بررسی کنید.
          </div>
        ) : (
          <div
            ref={scrollRef}
            className="font-mono text-xs p-4 overflow-x-auto max-h-[600px] overflow-y-auto"
            dir="ltr"
          >
            {logs.map((line, i) => (
              <div
                key={i}
                className="py-0.5 text-slate-300 whitespace-pre-wrap break-all hover:bg-white/[0.02] leading-relaxed"
              >
                <span className="text-slate-600 select-none mr-2">
                  {String(i + 1).padStart(3, '0')}
                </span>
                {line}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
