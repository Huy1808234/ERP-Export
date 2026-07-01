---
name: Mini ERP Export Theme
version: "1.0.0"
colors:
  primary: "#1890ff"        # Xanh dương truyền thống của Ant Design
  secondary: "#595959"      # Xám đậm cho text phụ
  success: "#52c41a"        # Xanh lá cho trạng thái thành công
  warning: "#faad14"        # Vàng cam cho cảnh báo
  error: "#ff4d4f"          # Đỏ cho lỗi
  background: "#f0f2f5"     # Xám nhạt cho nền ứng dụng (đặc trưng ERP)
  surface: "#ffffff"        # Trắng cho các thẻ Card, Table
  border: "#f0f0f0"         # Xám rất nhạt cho viền phân cách
typography:
  h1:
    fontFamily: Inter, sans-serif
    fontSize: 24px
    fontWeight: 600
  h2:
    fontFamily: Inter, sans-serif
    fontSize: 20px
    fontWeight: 500
  body:
    fontFamily: Inter, sans-serif
    fontSize: 14px
    fontWeight: 400
  label:
    fontFamily: Inter, sans-serif
    fontSize: 12px
    fontWeight: 500
rounded:
  sm: 4px
  md: 6px
  lg: 8px
spacing:
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
---

## Overview

Thiết kế dành cho Hệ thống Mini ERP Export Trading tập trung vào tính rõ ràng, chuyên nghiệp và tối ưu cho việc nhập liệu/đọc dữ liệu khối lượng lớn. Màn hình cần tạo cảm giác "gọn gàng", không gây mỏi mắt khi làm việc trong thời gian dài.

## Colors

Bảng màu được tuân thủ chặt chẽ theo tone lạnh và trung tính:
- **Primary (#1890ff):** Dùng cho các nút hành động chính (Primary Button), link, và trạng thái active.
- **Background (#f0f2f5):** Luôn dùng làm màu nền cho toàn trang (layout wrapper).
- **Surface (#ffffff):** Tất cả các nội dung (Table, Form, Card) đều phải được bọc trong một khối nền trắng để nổi bật trên nền xám.
- **Text:** Ưu tiên dùng text màu gần đen hoặc xám đậm, không dùng đen tuyệt đối `#000000` để giảm độ tương phản quá gắt.

## Typography

Toàn bộ hệ thống sử dụng font **Inter**. 
Vì tính chất ERP chứa nhiều số liệu và bảng biểu, font size chuẩn (base size) là `14px`. Tiêu đề các trang dùng `24px` (font-weight `600`).

## Layout & Spacing

- Luôn duy trì khoảng cách padding của một trang chuẩn (page container) là `24px` ở các cạnh.
- Khoảng cách giữa các khối nội dung (ví dụ: giữa 2 Card, hoặc giữa Filter và Table) mặc định là `16px` hoặc `24px`.
- Các nút bấm (Button) trong cùng một hàng cách nhau `8px` hoặc `12px`.

## Elevation

- Các thẻ Card hoặc Drawer chỉ dùng shadow rất nhẹ (`box-shadow` nhẹ) để tạo sự phân tách tinh tế với nền. Không lạm dụng shadow quá dày.
- Các Dropdown, Modal nổi lên trên cùng dùng shadow rõ hơn.

## Do's and Don'ts

- **Do:** Gộp các thông tin liên quan vào cùng một khối Card trắng (Surface).
- **Don't:** Không dùng quá 3 màu nhấn (accent colors) trên cùng một màn hình để tránh rối mắt.
- **Do:** Luôn xử lý các trường hợp bảng trống (Empty State) với một icon màu xám nhạt ở giữa khối Surface.
