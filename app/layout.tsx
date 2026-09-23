import type { Metadata } from "next";
import "./globals.css";
import "./diary.css";

export const metadata: Metadata = {
  title: "Liflow — 今日を整える",
  description: "予定・タスク・生活記録をつないで、今なにをするかを決める生活管理アプリ。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
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
