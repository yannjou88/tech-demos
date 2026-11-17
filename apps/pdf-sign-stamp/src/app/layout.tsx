import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist } from "next/font/google";
import "@fontsource/caveat/latin-400.css";
import "@fontsource/dancing-script/latin-400.css";
import "@fontsource/ma-shan-zheng/chinese-simplified-400.css";
import "@fontsource/ma-shan-zheng/latin-400.css";
import "@fontsource/noto-sans/latin-700.css";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "签字盖章",
  description:
    "在浏览器里给 PDF 签名、盖章并下载。文件不会离开你的设备。A convenience tool, not a certified e-signature service.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" className={`${geist.variable} h-full font-sans antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
