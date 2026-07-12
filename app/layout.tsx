import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "画师串工作台",
  description: "解析、调整、预览并收藏 NovelAI 画师串。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
