import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";

import "@/app/globals.css";
import NextAuthWrapper from "@/providers/next-auth-provider";
import { ThemeProvider } from "@/context/theme.context";
import { routing, type AppLocale } from "@/i18n/routing";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Mini ERP Export",
  description: "Hệ thống quản lý xuất nhập khẩu chuyên nghiệp",
};

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as AppLocale)) {
    notFound();
  }

  const appLocale = locale as AppLocale;
  const messages = await getMessages();

  return (
    <html lang={appLocale} suppressHydrationWarning data-scroll-behavior="smooth">
      <body className={inter.className} suppressHydrationWarning>
        <NextIntlClientProvider locale={appLocale} messages={messages}>
          <AntdRegistry>
            <ThemeProvider>
              <NextAuthWrapper>{children}</NextAuthWrapper>
            </ThemeProvider>
          </AntdRegistry>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
