import type { Metadata } from "next";
import "./globals.css";
import { SiteShell } from "@/components/site-shell";

export const metadata: Metadata = {
  title: "软件工程学院大创报销经费合规风控平台",
  description: "面向大创项目报销的合规申报、Agent 风控报告、运营复核与规则配置。",
  icons: {
    icon: [{ url: "/api/photos/sysu-favicon", type: "image/x-icon" }],
    shortcut: ["/api/photos/sysu-favicon"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full">
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  );
}
