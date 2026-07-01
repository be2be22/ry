// Subscription page — fetched server-side, displayed with glassmorphism + QR codes
import { db } from "@/lib/db";
import { generateUserConfigs, getEffectiveHost } from "@/lib/subscription";
import { notFound } from "next/navigation";
import { formatJalali, daysRemaining, toPersianDigits } from "@/lib/jalali";
import { SubscriptionClient } from "@/components/subscription/subscription-client";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function SubPage({ params }: PageProps) {
  const { token } = await params;
  const user = await db.vpnUser.findUnique({ where: { subToken: token } });
  if (!user) notFound();

  const host = await getEffectiveHost();
  const configs = await generateUserConfigs(user.uuid, user.username, host);
  const subscriptionUrl = `https://${host}/sub/${user.subToken}`;
  const base64Url = `${subscriptionUrl}?format=base64`;

  const dataLimitBytes = Number(user.dataLimitBytes);
  const usedBytes = Number(user.usedBytes);
  const remainBytes = dataLimitBytes > 0 ? Math.max(0, dataLimitBytes - usedBytes) : 0;
  const usedPct = dataLimitBytes > 0 ? Math.min(100, (usedBytes / dataLimitBytes) * 100) : 0;
  const days = daysRemaining(user.expireAt);
  const expired = user.expireAt ? new Date(user.expireAt) < new Date() : false;

  // If expireAt is null → no expiry (use 100 as "no limit")
  const totalDays = 30; // for progress bar display
  const dayPct = user.expireAt ? Math.min(100, Math.max(0, (days / totalDays) * 100)) : 100;

  return (
    <SubscriptionClient
      user={{
        username: user.username,
        enabled: user.enabled,
        suspended: user.suspended,
        expireAt: user.expireAt?.toISOString() ?? null,
        expireAtJalali: formatJalali(user.expireAt, true),
        dataLimitBytes,
        usedBytes,
        remainBytes,
        usedPct,
        days,
        dayPct,
        expired,
        maxDevices: user.maxDevices,
        notes: user.notes,
        tags: user.tags,
      }}
      configs={configs}
      host={host}
      subscriptionUrl={subscriptionUrl}
      base64Url={base64Url}
    />
  );
}
