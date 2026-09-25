import type { Metadata } from "next";
import "./globals.css";
import "./diary.css";

export const metadata: Metadata = {
  title: "Liflow — 今日を整える",
  description: "予定・タスク・生活記録をつないで、今なにをするかを決める生活管理アプリ。",
  manifest: "/manifest.webmanifest",
  applicationName: "Liflow",
  appleWebApp: { capable: true, title: "Liflow", statusBarStyle: "default" },
  icons: {
    icon: [{ url: "/favicon.svg" }, { url: "/icons/liflow-app.svg", type: "image/svg+xml" }],
    shortcut: "/favicon.svg",
    apple: "/icons/liflow-app-192.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased">{children}</body>
    </html>
  );
}
