// Format helpers for display — safe for client and server
// کمک‌کننده‌های قالب‌بندی برای نمایش — امن برای کلاینت و سرور

/** Format bytes for display — Persian digits. */
export function formatBytes(bytes: number | bigint, decimals = 2): string {
  const b = Number(bytes);
  if (b === 0) return "۰ بایت";
  const k = 1024;
  const sizes = ["بایت", "کیلوبایت", "مگابایت", "گیگابایت", "ترابایت"];
  const i = Math.floor(Math.log(b) / Math.log(k));
  const value = parseFloat((b / Math.pow(k, i)).toFixed(decimals));
  const persianValue = value.toLocaleString("fa-IR");
  return `${persianValue} ${sizes[i]}`;
}

/** Format uptime seconds to a Persian human string. */
export function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const fa = (n: number) => n.toLocaleString("fa-IR");
  if (d > 0) return `${fa(d)} روز و ${fa(h)} ساعت و ${fa(m)} دقیقه`;
  if (h > 0) return `${fa(h)} ساعت و ${fa(m)} دقیقه`;
  if (m > 0) return `${fa(m)} دقیقه و ${fa(s)} ثانیه`;
  return `${fa(s)} ثانیه`;
}
