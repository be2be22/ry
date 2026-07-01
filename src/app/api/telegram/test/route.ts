// /api/telegram/test — send a test message
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [tokenSetting, chatIdSetting] = await Promise.all([
    db.setting.findUnique({ where: { key: "telegram_bot_token" } }),
    db.setting.findUnique({ where: { key: "telegram_chat_id" } }),
  ]);

  const token = tokenSetting?.value;
  const chatId = chatIdSetting?.value;
  if (!token || !chatId) {
    return NextResponse.json({ error: "توکن ربات یا Chat ID تنظیم نشده" }, { status: 400 });
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: "🤖 پیام تست از پنل سایبر‌ایکس — اتصال موفق بود!",
        parse_mode: "HTML",
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: errText }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
