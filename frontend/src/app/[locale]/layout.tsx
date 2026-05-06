import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AntdRegistry } from '@ant-design/nextjs-registry';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';

import '@/app/globals.css';
import NextAuthWrapper from "@/library/next.auth.wrapper";
import { ThemeProvider } from "@/library/theme.context";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Mini ERP Export",
  description: "Hệ thống quản lý xuất nhập khẩu chuyên nghiệp",
};

export default async function RootLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const messages = await getMessages(); // Lấy các câu từ điển ra

  // Bảo vệ hệ thống: Nếu locale không phải en/vi thì văng ra 404 ngay
  const locales = ['en', 'vi'];
  if (!locales.includes(locale)) {
    notFound();
  }

  return (
    //  Gán lang động theo locale để trình duyệt hiểu ngôn ngữ đang dùng
    <html lang={locale} className="" suppressHydrationWarning data-scroll-behavior="smooth">
      <body className={inter.className} suppressHydrationWarning>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <AntdRegistry>
            <ThemeProvider>
              <NextAuthWrapper>
                {children}
              </NextAuthWrapper>
            </ThemeProvider>
          </AntdRegistry>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}