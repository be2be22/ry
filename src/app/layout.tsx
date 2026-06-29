import type { Metadata } from "next";
import { Vazirmatn } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";

const vazirmatn = Vazirmatn({
  subsets: ["arabic", "latin"],
  variable: "--font-vazirmatn",
  display: "swap",
});

export const metadata: Metadata = {
  title: "FastApiCloud | پنل مدیریت کانفیگ WS",
  description:
    "پنل مدیریتی پیشرفته برای ساخت و مدیریت کانفیگ‌های V2Ray/Xray WebSocket - FastApiCloud.com",
  keywords: [
    "FastApiCloud",
    "V2Ray",
    "Xray",
    "WebSocket",
    "VMess",
    "VLESS",
    "Trojan",
    "پنل مدیریت",
    "کانفیگ",
  ],
  authors: [{ name: "FastApiCloud" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "FastApiCloud - پنل مدیریت کانفیگ WS",
    description: "ساخت و مدیریت کانفیگ‌های V2Ray/Xray با WebSocket",
    siteName: "FastApiCloud",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body
        className={`${vazirmatn.variable} font-sans antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
        <SonnerToaster position="top-center" dir="rtl" />
      </body>
    </html>
  );
}
