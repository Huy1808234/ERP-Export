import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';
import path from 'path';

// Khởi tạo plugin next-intl
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  /* config options here */
  turbopack: {
    root: process.cwd(),
    // Chỉ watch trong thư mục frontend để tránh tràn bộ nhớ
    resolveAlias: {
      '@': path.resolve(process.cwd(), './src'),
    }
  },
};

// Bọc nextConfig bằng plugin trước khi xuất ra
export default withNextIntl(nextConfig);