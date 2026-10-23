import type { Metadata } from "next";
import "./globals.css";
import "./resource-experience.css";
import "./workspace-updates.css";

export const metadata: Metadata = {
  title: "海外渠道AI资源工作台",
  description: "统一沉淀 Skill、MCP、Agent 与内部网站，让团队资源更容易找到、理解和复用。",
  icons: {
    icon: "/dida-mark.png",
    shortcut: "/dida-mark.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
