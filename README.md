#  Mini ERP Export Trading

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=next.js&logoColor=white)
![NestJS](https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)
![Ant Design](https://img.shields.io/badge/Ant%20Design-0170FE?style=for-the-badge&logo=antdesign&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)

Hệ thống quản trị tài nguyên doanh nghiệp (ERP) thu nhỏ chuyên biệt dành cho lĩnh vực **thương mại xuất khẩu (Export Trading)**. Dự án được thiết kế với kiến trúc Frontend - Backend tách biệt, đảm bảo khả năng mở rộng, hiệu suất cao, UI/UX chuyên nghiệp cho đặc thù nhập liệu khối lượng lớn, và bảo mật thông tin chặt chẽ.

---

## Tính Năng Nổi Bật (Key Features)

Hệ thống bao gồm các phân hệ cốt lõi phục vụ toàn bộ quy trình xuất nhập khẩu:

-  **Quản lý Đơn hàng & Hợp đồng (Sales & Purchases)**: Sales Contracts, Purchase Orders, Purchase Requests, Quotations.
-  **Quản lý Chuỗi cung ứng (Supply Chain)**: Inventory, Lots (Lô hàng), Shipments (Vận chuyển/Booking), Goods Receipts, Products, Quality Control.
-  **Tài chính & Kế toán (Accounting & Finance)**: Account Receivables (Khoản phải thu), Account Payables (Khoản phải trả), Commercial Invoices, Vendor Invoices, Trade Finance.
-  **Quy trình Phê duyệt (Approval Matrix)**: Quản lý luồng phê duyệt đa cấp linh hoạt.
-  **Quản lý Khách hàng & Đối tác (CRM/Partners)**: Partners, Inquiries, Portal dành cho khách hàng/đối tác.
-  **Bảo mật & Quản trị (Admin/Security)**: Roles, Users, Audit Logs, JWT Authentication đa lớp.

---

##  Công Nghệ Sử Dụng (Tech Stack)

###  Frontend (`/frontend`)
- **Framework**: [Next.js v16+](https://nextjs.org/) (App Router)
- **Language**: TypeScript
- **UI & Styling**: [Ant Design v6](https://ant.design/), Tailwind CSS v4, Framer Motion (Animations)
- **State & Data**: React Hooks, API Services (kiến trúc dịch vụ độc lập), Socket.io-client (Realtime)
- **Others**: Recharts (Biểu đồ), next-intl (i18n), NextAuth v5 beta

###  Backend (`/backend`)
- **Framework**: [NestJS v11](https://nestjs.com/)
- **Language**: TypeScript
- **Database (ORM)**: PostgreSQL (thông qua TypeORM)
- **Caching & Queue**: Redis, BullMQ
- **Authentication**: Passport-JWT, Bcrypt
- **Real-time**: WebSockets (Socket.io)
- **Others**: NodeMailer (Email), PDFMake (Xuất PDF), ExcelJS/XLSX

---

##  Cấu Trúc Thư Mục (Project Structure)
Dự án được tổ chức theo cấu trúc monorepo đơn giản:

```text
mini-erp-export/
├── backend/            # Mã nguồn NestJS API
│   ├── src/
│   │   ├── modules/    # 40+ phân hệ nghiệp vụ ERP (sales, inventory, accounting...)
│   │   ├── auth/       # Xác thực, phân quyền
│   │   ├── database/   # TypeORM, migrations
│   │   └── common/     # Guards, Filters, Interceptors, DTOs chung
│   └── package.json
│
├── frontend/           # Mã nguồn Next.js (App Router)
│   ├── src/
│   │   ├── app/        # Route definitions (admin, auth, portal...)
│   │   ├── components/ # Reusable UI (ui, shared, features)
│   │   ├── services/   # Logic API domain tách biệt
│   │   ├── context/    # React context & Local app state
│   │   └── types/      # TypeScript definitions
│   └── package.json
│
├── nginx/              # Cấu hình Reverse Proxy Nginx cho Production
├── docker-compose.prod.yml # Cấu hình deploy bằng Docker Compose
└── package.json        # Chứa lệnh khởi chạy đồng thời (concurrently)
```

---

##  Hướng Dẫn Cài Đặt (Getting Started)

### Yêu cầu hệ thống
- [Node.js](https://nodejs.org/) (Khuyến nghị v20+)
- [PostgreSQL](https://www.postgresql.org/) (v14+)
- [Redis](https://redis.io/)
- NPM hoặc Yarn

### 1. Cài đặt Dependencies

Tại thư mục gốc, cài đặt toàn bộ dependencies cho cả frontend và backend:
```bash
npm run install:all
```

### 2. Cấu hình Biến Môi Trường (Environment Variables)

- **Backend (`backend/.env`)**: Copy từ `.env.example`. Thiết lập PostgreSQL, JWT Secret, Redis URL, Mailer...
- **Frontend (`frontend/.env`)**: Thiết lập `NEXT_PUBLIC_API_URL` trỏ về backend API, cấu hình NextAuth...

### 3. Khởi chạy Server Development

Chạy lệnh tại thư mục gốc để khởi chạy đồng thời cả Frontend (Cổng mặc định `3000`) và Backend (Cổng mặc định `3001` hoặc tuỳ cấu hình):
```bash
npm run dev
```

---

##  UI/UX & Design System (Thiết Kế)

Dự án được thiết kế chuyên biệt cho hệ thống ERP, tối ưu hóa trải nghiệm nhập liệu và đọc dữ liệu khối lượng lớn:
- **Tone màu chính**: Tone lạnh và trung tính (Primary: `#1890ff`, Background: `#f0f2f5`, Surface: `#ffffff`).
- **Typography**: Font **Inter**. Base size `14px` cho các bảng biểu, số liệu; `24px` cho tiêu đề trang.
- **Layout**: Padding chuẩn `24px`. Phân tách khối rõ ràng qua thẻ Card nền trắng với `box-shadow` nhẹ nhàng để không gây mỏi mắt.
- **Micro-interactions**: Hover effects mượt mà, Skeleton loading state, và các Empty state thân thiện (kèm icon xám nhạt).

---

##  Tiêu Chuẩn Lập Trình (Coding Convention)

Dự án tuân thủ nghiêm ngặt các quy tắc lập trình (Senior Fullstack Rules) nhằm tránh "nợ kỹ thuật" và duy trì mã nguồn sạch, dễ bảo trì:

### Kiến trúc & Nguyên tắc chung
1. **Frontend Architecture**: Thư mục `app/` chỉ định nghĩa routes, mỏng nhất có thể. Business logic và call API nằm trong `services/` hoặc `hooks/`. UI tách biệt tại `components/`.
2. **Backend Architecture**: NestJS duy trì cấu trúc module phẳng. Controller chỉ nhận request, validate DTO, gọi Service, trả response. Không chứa logic nghiệp vụ phức tạp.
3. **Type Safety & DRY**: 100% sử dụng TypeScript rõ ràng. KHÔNG dùng `any`. Tối đa hóa tái sử dụng các components từ `components/ui` và `components/shared`.
4. **State Handling**: Mọi API call trên Frontend phải hiển thị đủ 4 trạng thái: Loading, Error, Empty, Success.

### Database & Định danh (Quan trọng)
- **Database ID**: Mọi khóa chính, tham chiếu đều sử dụng `_id` (`ticket._id`, `findBy_id()`). Tuyệt đối không dùng `id` hay `uuid` để đảm bảo đồng nhất với Backend.
- **User Identification**: Mọi định danh người dùng trong nghiệp vụ bắt buộc dùng `username` (vd: `created_by_username`, `assignee_username`). Không dùng `email` hay `user_id` làm khóa nghiệp vụ.

### Error Handling & Security
- **Backend**: Bắt buộc dùng NestJS built-in exceptions (`NotFoundException`, `BadRequestException`). Validate DTO với `class-validator`.
- **Frontend**: API service throw error chuẩn mực; hook hoặc component chịu trách nhiệm catch error và hiển thị UI thân thiện. Không expose thông tin nhạy cảm.

---
*Developed for Mini ERP Export Trading B2B.*
