import { useEffect, useState } from 'react';
import { api } from '../api';
import { useToast } from '../components/Toast';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

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

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [restarting, setRestarting] = useState(false);
  const toast = useToast();

  const load = async () => {
    try {
      const d = await api.get('/api/dashboard');
      setData(d);
    } catch (e) {
      // Silent on poll failure to avoid toast spam
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  const restart = async () => {
    if (!confirm('ری‌استارت کردن فرایند Xray؟')) return;
    setRestarting(true);
    try {
      await api.post('/api/dashboard/restart');
      toast.success('دستور ری‌استارت ارسال شد.');
      setTimeout(load, 1500);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setRestarting(false);
    }
  };

  if (loading || !data) {
    return <div className="text-center py-12 text-slate-400">در حال بارگذاری...</div>;
  }

  const chartData = (data.daily || []).map((d) => ({
    date: d.date.slice(5),
    up: Math.round((d.up || 0) / 1024 / 1024),
    down: Math.round((d.down || 0) / 1024 / 1024),
  }));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">داشبورد</h1>
          <p className="text-sm text-slate-400 mt-1">نمای کلی از وضعیت سرور</p>
        </div>
        <button onClick={restart} disabled={restarting} className="btn-ghost">
          <svg
            className={'w-4 h-4 ' + (restarting ? 'animate-spin' : '')}
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
          {restarting ? 'در حال ری‌استارت...' : 'ری‌استارت Xray'}
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-400 mb-1">وضعیت Xray</div>
              <div className="text-base font-bold flex items-center gap-2">
                <span
                  className={
                    'relative inline-flex w-3 h-3 rounded-full ' +
                    (data.xrayRunning ? 'bg-emerald-400 animate-pulse-glow' : 'bg-rose-500')
                  }
                />
                {data.xrayRunning ? 'در حال اجرا' : 'متوقف'}
              </div>
            </div>
            <svg
              className="w-8 h-8 text-accent-violet/50"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </div>
        </div>
        <div className="card">
          <div className="text-xs text-slate-400 mb-1">کلاینت‌های فعال</div>
          <div className="text-2xl font-bold text-slate-100">
            {toPersianDigits(data.activeClients)}{' '}
            <span className="text-sm text-slate-400 font-normal">
              از {toPersianDigits(data.totalClients)}
            </span>
          </div>
        </div>
        <div className="card">
          <div className="text-xs text-slate-400 mb-1">دانلود امروز</div>
          <div className="text-2xl font-bold text-accent-cyan">{formatBytes(data.todayDown)}</div>
        </div>
        <div className="card">
          <div className="text-xs text-slate-400 mb-1">آپلود امروز</div>
          <div className="text-2xl font-bold text-accent-violet">{formatBytes(data.todayUp)}</div>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-100">ترافیک هفت روز اخیر</h2>
          <div className="text-xs text-slate-500">به مگابایت</div>
        </div>
        <div className="h-72">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ left: 0, right: 8, top: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="upGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="downGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#06b6d4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis
                  dataKey="date"
                  stroke="#64748b"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} width={40} />
                <Tooltip
                  contentStyle={{
                    background: '#10121e',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 12,
                    color: '#e2e8f0',
                    fontFamily: 'Vazirmatn',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="up"
                  name="آپلود"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  fill="url(#upGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="down"
                  name="دانلود"
                  stroke="#06b6d4"
                  strokeWidth={2}
                  fill="url(#downGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-500 text-sm">
              هنوز داده‌ای ثبت نشده است
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="text-xs text-slate-400 mb-3">مجموع ترافیک کلاینت‌ها</div>
        <div className="flex gap-8 flex-wrap">
          <div>
            <div className="text-xs text-slate-500 mb-1">آپلود کل</div>
            <div className="text-xl font-bold text-accent-violet">{formatBytes(data.totalUp)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">دانلود کل</div>
            <div className="text-xl font-bold text-accent-cyan">{formatBytes(data.totalDown)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">مجموع</div>
            <div className="text-xl font-bold text-slate-100">
              {formatBytes(data.totalUp + data.totalDown)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
