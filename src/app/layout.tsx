import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";

const cairo = Cairo({ subsets: ["arabic", "latin"], weight: ["400", "600", "700", "800"] });

export const metadata: Metadata = {
  title: "خريطة الوظيفة · Maroc — كل فرص الشغل على الخريطة",
  description:
    "خريطة تفاعلية لفرص الشغل بالمغرب: القطاع الخاص والقطاع العام (مباريات التوظيف) في جميع المدن.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body className={`${cairo.className} antialiased`}>{children}</body>
    </html>
  );
}
