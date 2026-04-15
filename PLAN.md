# Cấu Trúc Hệ Thống XNK (Mini ERP Export-Import)

Hệ thống Mini-ERP chuyên biệt cho ngành xuất nhập khẩu, giúp số hóa quy trình từ khâu chốt sale, mua hàng, theo dõi lịch tàu, quản lý chứng từ cho tới khi lô hàng hoàn tất và thanh toán.

Nó bao gồm 7 phân hệ chính sau đây:

---

## 1. Quản Trị Đối Tác (CRM / SRM)
- **Khách hàng (Importers/Buyers):** Quản lý thông tin công ty, địa chỉ đích đến.
- **Nhà cung cấp (Suppliers/Factories/Vendors):** Quản lý xưởng sản xuất nội địa, nhà cung ứng bao bì.
- **Đơn vị Logistics (Forwarders/Shipping Lines):** Hãng tàu, đại lý khai thuê hải quan, nhà xe kéo container.

---

## 2. Quản Lý Sản Phẩm (Products & Master Data)
- **Định danh hàng hóa:** Tên tiếng Việt / Tiếng Anh, Mã hải quan (HS Code), SKU.
- **Quy cách đóng gói (Packing Details - Rất quan trọng):** Số lượng trên hộp/thùng, Số khối / Thể tích (CBM), Trọng lượng tịnh (Net Weight), Trọng lượng cả bì (Gross Weight), Quy cách xếp Pallet.

---

## 3. Bán Hàng & Báo Giá (Sales & Quotation)
- **Incoterms:** Làm báo giá với nhiều điều kiện xuất khẩu (FOB, CIF, EXW, DAP...).
- **Proforma Invoice (PI):** Cấp hóa đơn chiếu lệ làm căn cứ chốt đơn và nhận tiền cọc của khách hàng nước ngoài.
- **Sales Contract:** Hợp đồng thương mại quốc tế (Ngoại thương).

---

## 4. Mua Hàng & Sourcing (Purchasing)
- **Purchase Order (PO):** Tạo lệnh thu mua gửi xuống xưởng. Liên kết chặt chẽ với PI ở trên.
- **Sản xuất & QC:** Theo dõi tiến độ hoàn thành đơn hàng từ xưởng nội địa và ngày giao hàng dự kiến (Delivery Date).

---

## 5. Vận Tải & Logistics (Shipments & Bookings)
- **Booking Lịch Tàu:** Cập nhật số Booking lấy từ Forwarder. Quản lý Ngày tàu chạy (ETD), Ngày cập cảng đích (ETA), Cảng đi (POL), Cảng đến (POD).
- **Khai báo Hải quan:** Quản lý số tờ khai, luồng xanh/vàng/đỏ.
- **Container Tracking:** Theo dõi biển số xe kéo, Mã Container (20ft, 40ft), Số Chì niêm phong (Seal).

---

## 6. Quản Lý Chứng Từ XNK (Document Management)
Cho phép tự động điền các thông tin từ các Module trên vào form chuẩn để xuất file PDF/Excel.
- **Hồ sơ cốt lõi:** Commercial Invoice (Hóa đơn thương mại), Packing List (Phiếu đóng gói chi tiết từ số Container).
- **Hồ sơ chuyên ngành:** Quản lý việc cấp C/O (Giấy Chứng nhận Xuất xứ), Phyto (Kiểm dịch thực vật), Fumigation (Hun trùng).
- **Kho File Scan:** Nơi Upload và lưu bản lưu trữ B/L hoặc các Tờ khai có chữ ký số gốc.

---

## 7. Kế Toán & Dòng Tiền (Finance & Costing)
Hiển thị báo cáo lời lỗ (Profit & Loss - P&L) rõ ràng theo từng Lô hàng.
- **Costing Lô hàng:** Ghi nhận mọi phụ phí (Local Charge, Cước Bển Ocean Freight, Phí bốc xếp) để tính tổng chi phí Logistics.
- **Quản trị dòng tiền (CashFlow):** 
   - Kiểm soát tiền về: Theo dõi khoản khách cọc T/T, tiền L/C.
   - Kiểm soát tiền chi: Trả xưởng, trả hãng tàu tải.
- **Báo cáo Lợi nhuận lô hàng:** Khấu trừ tự động báo cáo = Tiền nhận thực tế trừ đi Tổng mọi chi phí lô hàng.

---

## Câu Hỏi Định Hướng Cho Dự Án

Hãy phản hồi các thông tin sau để có thể thiết kế Logic Database ngay từ bây giờ:

1. Công ty chuyên **Xuất khẩu (Export)**, **Nhập khẩu (Import)**, hay cả hai?
2. Mặt hàng kinh doanh chính (Physical Goods) của công ty là gì? (Ví dụ: Nông sản, đồ thủ công, thủy sản...)
3. Hình thức vận tải sử dụng nhiều nhất: Lô Biển Nguyên (FCL), Lẻ (LCL) hay Máy bay (Air)?
4. Chúng ta sẽ bắt đầu code ngay **Module 1 (Đối tác)** và **Module 2 (Sản phẩm)** trước nhé?
