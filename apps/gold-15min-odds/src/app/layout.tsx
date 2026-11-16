import type { Metadata } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "十五分钟涨跌",
  description: "黄金与白银的 15 分钟涨跌参考。只读，不构成投资建议。",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN" className={cn("dark font-sans", geist.variable)}>
      <body>{children}</body>
    </html>
  );
}
