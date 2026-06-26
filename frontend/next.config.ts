import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';
import path from 'path';
import { fileURLToPath } from 'url';

const frontendRoot = path.dirname(fileURLToPath(import.meta.url));

// Khởi tạo plugin next-intl
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  // 1. Tối ưu cho quá trình Deploy (Cực kỳ quan trọng cho Docker)
  output: 'standalone',

  // 2. Tăng cường bảo mật và chuẩn React
  reactStrictMode: true,
  poweredByHeader: false, // Ẩn header "X-Powered-By: Next.js"

  // 3. Tối ưu Compiler trên Production
  compiler: {
    // Tự động xóa các log debug khi build production để tránh rò rỉ dữ liệu
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error'], // Giữ lại console.error để log lỗi
    } : false,
  },

  // 4. Cấu hình Turbopack (Chỉ có tác dụng khi dev local)
  turbopack: {
    root: frontendRoot,
  },

  // 5. Nếu bắt buộc phải dùng Alias trong config (thay vì tsconfig.json)
  // Bạn phải cấu hình cho cả Webpack để lúc build production không bị lỗi
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(frontendRoot, 'src'),
    };
    return config;
  },
};

export default withNextIntl(nextConfig);