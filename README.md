# Mini ERP Export Trading

Hệ thống quản trị tài nguyên doanh nghiệp (ERP) thu nhỏ chuyên biệt dành cho lĩnh vực thương mại xuất khẩu. Dự án được thiết kế với kiến trúc Frontend - Backend tách biệt, đảm bảo khả năng mở rộng, hiệu suất cao và bảo mật thông tin.

##  Tính Năng Nổi Bật (Key Features)

Hệ thống bao gồm các phân hệ cốt lõi phục vụ quy trình xuất nhập khẩu:
- **Quản lý Đơn hàng & Hợp đồng (Sales & Purchases)**: Sales Contracts, Purchase Orders, Purchase Requests, Quotations.
- **Quản lý Chuỗi cung ứng (Supply Chain)**: Inventory, Lots (Lô hàng), Shipments (Vận chuyển/Booking), Goods Receipts, Products, Quality Control.
- **Tài chính & Kế toán (Accounting & Finance)**: Account Receivables (Khoản phải thu), Account Payables (Khoản phải trả), Commercial Invoices, Vendor Invoices, Trade Finance.
- **Quy trình Phê duyệt (Approval Matrix)**: Quản lý luồng phê duyệt đa cấp linh hoạt.
- **Quản lý Khách hàng & Đối tác (CRM/Partners)**: Partners, Inquiries, Portal dành cho khách hàng/đối tác.
- **Bảo mật & Quản trị (Admin/Security)**: Roles, Users, Audit Logs, JWT Authentication.

##  Công Nghệ Sử Dụng (Tech Stack)

### Frontend
- **Framework**: [Next.js](https://nextjs.org/) (App Router, v16+)
- **Ngôn ngữ**: TypeScript
- **UI Library**: [Ant Design](https://ant.design/) (v6), Tailwind CSS (v4)
- **State Management & Data Fetching**: React Hooks, API Services
- **Authentication**: NextAuth (v5 beta)
- **Tiện ích khác**: Framer Motion (Animations), Recharts (Biểu đồ), Socket.io-client (Realtime), next-intl (i18n đa ngôn ngữ).

### Backend
- **Framework**: [NestJS](https://nestjs.com/) (v11)
- **Ngôn ngữ**: TypeScript
- **Cơ sở dữ liệu (ORM)**: PostgreSQL (thông qua TypeORM)
- **Caching & Message Queue**: Redis, BullMQ
- **Authentication**: Passport-JWT, Bcrypt
- **Real-time**: WebSockets (Socket.io)
- **Tiện ích khác**: NodeMailer (Gửi email), PDFMake (Xuất PDF), ExcelJS/XLSX.

##  Cấu Trúc Thư Mục (Project Structure)

Dự án được tổ chức theo cấu trúc monorepo-style đơn giản với các thành phần chính:

```text
mini-erp-export/
├── backend/            # Mã nguồn NestJS API
│   ├── src/
│   │   ├── modules/    # Chứa 40+ phân hệ nghiệp vụ ERP (sales, inventory, accounting...)
│   │   ├── auth/       # Xử lý xác thực, phân quyền
│   │   ├── database/   # Cấu hình TypeORM, migrations
│   │   └── common/     # Guards, Filters, Interceptors, DTOs chung
│   └── package.json
│
├── frontend/           # Mã nguồn Next.js
│   ├── src/
│   │   ├── app/        # App Router pages (admin, auth, portal...)
│   │   ├── components/ # UI Components (ui, shared, features)
│   │   ├── services/   # Logic gọi API backend tách biệt
│   │   ├── hooks/      # Custom React Hooks
│   │   └── types/      # TypeScript definitions
│   └── package.json
│
├── nginx/              # Cấu hình Reverse Proxy Nginx cho môi trường Production
└── docker-compose.prod.yml # Cấu hình deploy bằng Docker Compose
```

##  Hướng Dẫn Cài Đặt (Getting Started)

### Yêu cầu hệ thống (Prerequisites)
- [Node.js](https://nodejs.org/) (Khuyến nghị v20+)
- [PostgreSQL](https://www.postgresql.org/) (v14+)
- [Redis](https://redis.io/) (Dùng cho Cache và Message Queue)
- NPM hoặc Yarn

### 1. Cài đặt Dependencies

Tại thư mục gốc, bạn có thể cài đặt toàn bộ dependencies cho cả frontend và backend:
```bash
npm run install:all
```
Hoặc cài đặt riêng biệt ở từng thư mục:
```bash
cd backend && npm install
cd ../frontend && npm install
```

### 2. Cấu hình Biến Môi Trường (Environment Variables)

**Backend (`backend/.env`):**
Cần thiết lập kết nối CSDL PostgreSQL, cấu hình JWT Secret, URL của Redis, Mailer, v.v. (Nhân bản file `.env.example` nếu có).

**Frontend (`frontend/.env`):**
Thiết lập `NEXT_PUBLIC_API_URL` trỏ về backend API, cấu hình NextAuth, v.v.

### 3. Khởi chạy Server Môi Trường Phát Triển (Development)

Sử dụng lệnh tại thư mục gốc để khởi chạy đồng thời cả Frontend và Backend:
```bash
npm run dev
```

*Hoặc bạn có thể mở 2 terminal để khởi chạy độc lập:*
- Terminal 1: `cd backend && npm run dev`
- Terminal 2: `cd frontend && npm run dev`

##  Tiêu Chuẩn Lập Trình (Coding Convention)

Dự án tuân thủ nghiêm ngặt các quy tắc lập trình (Senior Fullstack Rules) nhằm tránh "nợ kỹ thuật" và duy trì code sạch:
- **Kiến trúc rõ ràng**: NestJS giữ nguyên kiến trúc phẳng, không lạm dụng abstractions. Next.js giữ page mỏng, tách biệt logic call API vào thư mục `services/`.
- **Type Safety**: Bắt buộc sử dụng TypeScript cho toàn bộ dữ liệu, tham số, component props. Không sử dụng `any`.
- **UI/UX Tiêu Chuẩn**: Tái sử dụng linh kiện từ `components/ui` và `components/shared`. Phải xử lý đầy đủ 4 trạng thái (Loading, Error, Empty, Success) khi làm việc với API.
- **Convention Database**: 
  - Khóa chính và reference ID bắt buộc dùng chuẩn `_id` (ví dụ: `ticket._id`, không dùng `id`).
  - Định danh người dùng dùng `username` thay cho email/userId (ví dụ: `created_by_username`).
- **Error Handling (Backend)**: Bắt buộc dùng Built-in exceptions của NestJS (VD: `NotFoundException`, `BadRequestException`).
- **DRY (Don't Repeat Yourself)**: Không tạo component mới nếu đã có tính năng tương đương. Đóng gói logic cẩn thận.
