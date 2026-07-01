import type { Metadata, Viewport } from "next";
import { Vazirmatn, JetBrains_Mono, Press_Start_2P } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { XrayProvider } from "@/components/xray-provider";

const vazirmatn = Vazirmatn({
  variable: "--font-vazirmatn",
  subsets: ["arabic", "latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

const pressStart = Press_Start_2P({
  variable: "--font-press-start",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CyberX | پنل مدیریت VPN",
  description:
    "پنل مدیریت VPN سایبر‌ایکس — کنترل کامل Xray-core با رابط کاربری سایبرپانک فارسی",
  keywords: ["VPN", "Xray", "VLESS", "VMess", "Trojan", "پنل", "CyberX"],
  authors: [{ name: "CyberX" }],
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icon.svg",
  },
  openGraph: {
    title: "CyberX — پنل مدیریت VPN",
    description: "کنترل کامل Xray-core با رابط سایبرپانک فارسی",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#050810",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body
        className={`${vazirmatn.variable} ${jetbrainsMono.variable} ${pressStart.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <XrayProvider>{children}</XrayProvider>
          <Toaster />
          <SonnerToaster position="top-center" dir="rtl" />
        </ThemeProvider>
      </body>
    </html>
  );
}
