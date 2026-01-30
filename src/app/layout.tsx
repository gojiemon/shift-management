import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "シフト管理システム",
  description: "半月ごとのシフト希望提出・管理システム",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
