# Danh Sách Tính Năng — Mini-ERP Thương Mại Xuất Khẩu (B2B Export Trading)

> Hệ thống quản trị dành cho doanh nghiệp thương mại mua hàng trong nước và bán cho đối tác nước ngoài (B2B).
> Không có module sản xuất. Tập trung vào: mua hàng → kho → xuất khẩu → thu tiền quốc tế.

---

## 1. Quản Lý Khách Hàng Nước Ngoài (Foreign Customer / Buyer Management)

- Lưu thông tin buyer: tên công ty, quốc gia, địa chỉ, mã số thuế nước ngoài
- Phân loại buyer theo quốc gia, khu vực (EU, US, ASEAN...)
- Lưu điều khoản thanh toán mặc định theo từng buyer (T/T, L/C, D/P, D/A)
- Lưu tiền tệ giao dịch mặc định (USD, EUR, GBP...)
- Lưu thông tin ngân hàng của buyer (dùng cho chuyển khoản, L/C)
- Lưu lịch sử giao dịch theo từng buyer
- Quản lý hạn mức tín dụng (credit limit) theo buyer
- Ghi chú nội bộ về buyer (ưu tiên, rủi ro, đặc thù)

---

## 2. Quản Lý Nhà Cung Cấp Trong Nước (Domestic Vendor Management)

- Lưu thông tin nhà cung cấp: tên, mã số thuế, địa chỉ, người liên hệ
- Phân loại nhà cung cấp theo ngành hàng
- Lưu điều khoản thanh toán (trả ngay, net 30, net 60...)
- Lưu lịch sử giá mua theo từng nhà cung cấp và từng sản phẩm
- Đánh giá nhà cung cấp (chất lượng, giao hàng đúng hạn, giá cả)
- Quản lý công nợ phải trả (AP) theo từng nhà cung cấp
- Cảnh báo khi gần đến hạn thanh toán

---

## 3. Quản Lý Sản Phẩm & Danh Mục Hàng Hóa

- Tạo danh mục sản phẩm với mã hàng, tên, đơn vị tính
- Lưu mã HS Code (Harmonized System) cho từng sản phẩm — dùng cho hải quan
- Lưu mô tả hàng hóa bằng tiếng Anh (dùng cho hồ sơ xuất khẩu)
- Lưu trọng lượng tịnh (net weight) và trọng lượng cả bì (gross weight)
- Lưu thể tích / kích thước thùng (CBM — Cubic Meter) để tính phí vận chuyển
- Hỗ trợ nhiều đơn vị tính: cái, kg, tấn, thùng, pcs, carton...
- Lưu giá mua (VND) và giá bán (ngoại tệ) mặc định theo từng thị trường
- Gắn nhà cung cấp mặc định cho từng sản phẩm

---

## 4. Mua Hàng Trong Nước (Domestic Purchasing)

### Quy Trình P2P
- Tạo Yêu cầu mua hàng (Purchase Request — PR) từ nhu cầu xuất khẩu
- Phê duyệt PR theo ngưỡng giá trị
- Tạo Đơn đặt hàng nội địa (Purchase Order — PO) bằng VND
- Gửi PO đến nhà cung cấp
- Nhận hàng và tạo Phiếu nhập kho (Goods Receipt Note — GRN)
- Nhận hóa đơn GTGT từ nhà cung cấp (Vendor Invoice)
- Đối chiếu 3 chiều: PO + GRN + Vendor Invoice
- Thanh toán nhà cung cấp, ghi nhận AP

### Xử Lý Ngoại Lệ
- Hàng nhập thiếu / thừa so với PO — ghi số thực nhận, backorder phần còn lại
- Hàng hỏng / sai quy cách — đặt vào khu Quarantine, tạo Rejection
- Hủy PO với lý do bắt buộc
- Trả hàng nhà cung cấp (Purchase Return)

---

## 5. Quản Lý Kho (Warehouse Management)

### Theo Dõi Tồn Kho
- Theo dõi tồn kho theo từng sản phẩm theo thời gian thực
- Không cho phép tồn kho âm
- Đặt giữ hàng (reservation) khi xác nhận Sales Contract
- Cảnh báo tồn kho dưới mức tối thiểu (reorder point)
- Theo dõi tồn kho theo lô hàng (Lot Tracking) — quan trọng cho xuất khẩu

### Phương Pháp Định Giá
- FIFO (First In First Out) — mặc định cho thương mại xuất khẩu
- AVG (Average Cost) — bình quân gia quyền

### Nhập / Xuất Kho
- Phiếu nhập kho từ mua hàng nội địa (GRN)
- Phiếu xuất kho cho lô hàng xuất khẩu (Export Delivery)
- Phiếu điều chỉnh tồn kho (Inventory Adjustment) — cần phê duyệt
- Phiếu nhập kho hàng trả lại từ buyer (Return from Customer)

### Kiểm Kê
- Kiểm kê tồn kho định kỳ
- Đối chiếu số liệu sổ sách vs thực tế
- Ghi nhận hao hụt, hư hỏng với lý do

---

## 6. Bán Hàng Xuất Khẩu — Sales Contract (O2C Export)

### Quy Trình Bán Hàng Xuất Khẩu
- Tạo Báo giá xuất khẩu (Proforma Invoice — PI) bằng ngoại tệ
- Đàm phán và xác nhận Sales Contract / Purchase Order from Buyer
- Kiểm tra tồn kho, đặt giữ hàng
- Xác nhận điều khoản Incoterms (EXW, FOB, CIF, CFR, DDP...)
- Giao hàng và tạo hồ sơ xuất khẩu
- Xuất Commercial Invoice chính thức
- Thu tiền từ buyer

### Chính Sách Giá Xuất Khẩu
- Bảng giá theo từng thị trường / quốc gia
- Giá theo Incoterms (giá EXW, FOB, CIF có thể khác nhau cho cùng 1 sản phẩm)
- Giá theo số lượng (volume discount / tiered pricing)
- Tính giá tự động: giá EXW → cộng phí vận chuyển nội địa → FOB → cộng phí cước / bảo hiểm → CIF
- Lưu lịch sử giá theo từng buyer và từng hợp đồng

### Quản Lý Công Nợ Ngoại Tệ (AR)
- Ghi nhận AR bằng ngoại tệ khi xuất hóa đơn
- Quy đổi sang VND theo tỷ giá tại ngày hóa đơn
- Theo dõi trạng thái thanh toán từng hóa đơn
- Báo cáo AR Aging theo buyer (Current / 1–30 / 31–60 / 61–90 / >90 ngày)
- Ghi nhận chênh lệch tỷ giá khi thu tiền (exchange rate gain/loss)
- Tính Days Sales Outstanding (DSO)

---

## 7. Quản Lý Phương Thức Thanh Toán Quốc Tế

### Telegraphic Transfer (T/T)
- Ghi nhận T/T advance (đặt cọc trước khi giao hàng)
- Ghi nhận T/T balance (thanh toán phần còn lại sau khi giao hàng)
- Đối chiếu số tiền nhận với hóa đơn

### Letter of Credit (L/C)
- Lưu thông tin L/C: số L/C, ngân hàng phát hành, ngày hết hạn, số tiền
- Lưu điều kiện L/C: at sight, deferred payment, usance
- Theo dõi trạng thái L/C: Received → Documents Presented → Accepted → Paid
- Cảnh báo L/C sắp hết hạn giao hàng (shipment deadline)
- Cảnh báo L/C sắp hết hạn xuất trình chứng từ (presentation deadline)
- Ghi nhận discrepancy (sai sót chứng từ) và cách xử lý

### D/P & D/A (Documentary Collection)
- Ghi nhận lệnh nhờ thu (Collection Order) qua ngân hàng
- Theo dõi trạng thái: Sent → Accepted → Paid / Dishonoured
- Ghi nhận rủi ro không thanh toán (D/A đặc biệt)

---

## 8. Hồ Sơ Xuất Khẩu (Export Documentation)

### Chứng Từ Thương Mại
- **Commercial Invoice**: xuất tự động từ Sales Contract, đúng định dạng quốc tế
- **Packing List**: liệt kê số lượng, trọng lượng, kích thước từng kiện hàng
- **Proforma Invoice**: báo giá chính thức gửi buyer trước khi ký hợp đồng

### Chứng Từ Vận Tải
- **Bill of Lading (B/L)**: lưu thông tin vận đơn đường biển (số B/L, tên tàu, cảng đi, cảng đến, ngày tàu chạy)
- **Airway Bill (AWB)**: cho hàng vận chuyển đường không
- **Packing Declaration**: khai báo thông tin đóng gói

### Chứng Từ Xuất Xứ & Chất Lượng
- **Certificate of Origin (C/O)**: lưu thông tin C/O form (Form B, Form D, Form AI, Form E...) — ưu đãi thuế quan
- **Phytosanitary Certificate**: kiểm dịch thực vật (nếu hàng nông sản)
- **Health Certificate / Fumigation Certificate**: nếu yêu cầu
- **Quality Inspection Certificate**: chứng nhận chất lượng từ bên thứ 3

### Hải Quan Xuất Khẩu
- Lưu thông tin tờ khai hải quan xuất khẩu (số tờ khai, ngày thông quan)
- Lưu mã HS Code trên tờ khai
- Theo dõi trạng thái thông quan: Khai báo → Phân luồng → Thông quan
- Lưu chứng từ hoàn thuế GTGT xuất khẩu

### Quản Lý Bộ Chứng Từ
- Nhóm toàn bộ chứng từ theo từng lô hàng (shipment)
- Theo dõi checklist chứng từ: đã có / còn thiếu
- Lưu file PDF/scan cho từng chứng từ
- Gửi bộ chứng từ cho buyer qua hệ thống (email / download link)

---

## 9. Quản Lý Vận Chuyển & Logistics

### Thông Tin Lô Hàng (Shipment)
- Tạo Shipment cho mỗi lần xuất hàng, liên kết với Sales Contract
- Lưu thông tin: cảng xuất (POL), cảng đến (POD), hãng tàu / hãng bay
- Lưu ngày dự kiến xuất hàng (ETD) và ngày dự kiến đến (ETA)
- Cập nhật trạng thái lô hàng theo thời gian thực

### Container & Đóng Hàng
- Lưu thông tin container: số container, loại (20ft, 40ft, 40HQ), seal number
- Tính toán CBM và trọng lượng để xác định loại container phù hợp
- Booking container với hãng tàu
- Lịch cắt hàng (cut-off date) và lịch tàu chạy (sailing schedule)

### Chi Phí Logistics
- Cước biển / cước hàng không (Freight)
- Phụ phí: THC, BAF, CAF, EBS, Origin Charges...
- Phí vận chuyển nội địa (trucking)
- Phí khai báo hải quan
- Phí kiểm định, kiểm dịch
- Phí ngân hàng (L/C charges, collection charges)
- Phí bảo hiểm hàng hóa
- Phân bổ chi phí logistics vào giá vốn từng lô hàng

### Đại Lý Giao Nhận (Forwarder)
- Quản lý danh sách forwarder / shipping agent
- Lưu báo giá cước từ forwarder theo tuyến
- So sánh giá cước giữa các forwarder

---

## 10. Quản Lý Đa Tiền Tệ & Tỷ Giá

- Hỗ trợ nhiều loại tiền tệ: USD, EUR, GBP, JPY, CNY, AUD...
- Lưu tỷ giá hối đoái theo ngày (manual hoặc tích hợp API tỷ giá)
- Tỷ giá ghi sổ (tỷ giá hạch toán kế toán Việt Nam)
- Mọi giao dịch ngoại tệ lưu cả: giá trị ngoại tệ + tỷ giá + giá trị VND quy đổi
- Tính chênh lệch tỷ giá đã thực hiện (realized gain/loss) khi thu/thanh toán
- Tính chênh lệch tỷ giá chưa thực hiện (unrealized gain/loss) cuối kỳ
- Báo cáo tổng hợp công nợ theo từng loại tiền tệ

---

## 11. Kế Toán Thương Mại Xuất Khẩu

### Ghi Nhận Giao Dịch
- Tạo bút toán kế toán tự động từ mọi giao dịch (nhập hàng, xuất hàng, thanh toán, thu tiền)
- Ghi nhận doanh thu xuất khẩu (tài khoản 511) bằng ngoại tệ
- Ghi nhận giá vốn hàng xuất khẩu (tài khoản 632)
- Ghi nhận AR ngoại tệ (tài khoản 131)
- Ghi nhận AP nội địa (tài khoản 331)
- Ghi nhận chi phí logistics vào giá vốn hoặc chi phí bán hàng
- Ghi nhận chênh lệch tỷ giá (tài khoản 413, 515, 635)
- Ghi nhận thuế GTGT đầu vào (hàng mua) và hoàn thuế GTGT xuất khẩu

### Báo Cáo Tài Chính
- Báo cáo Lợi nhuận & Lỗ (P&L) theo tháng / quý / năm
- Báo cáo Bảng cân đối kế toán (Balance Sheet)
- Báo cáo Lưu chuyển tiền tệ (Cash Flow)
- Báo cáo theo kỳ kế toán (fiscal period)

### Báo Cáo Thuế
- Báo cáo thuế GTGT (VAT Report) — đầu vào, đầu ra, hoàn thuế xuất khẩu
- Hồ sơ hoàn thuế GTGT xuất khẩu (liên kết với tờ khai hải quan, C/O)
- Báo cáo thuế TNCN (nếu có)

---

## 12. Dashboard & Báo Cáo Kinh Doanh

### Dashboard Giám Đốc
- Doanh thu xuất khẩu tháng này vs cùng kỳ năm ngoái (theo USD và VND)
- Lợi nhuận gộp (Gross Profit Margin) theo thị trường, theo sản phẩm
- Tổng AR ngoại tệ đang outstanding và phân tích aging
- Tồn kho hiện tại và giá trị tồn kho
- Top 10 buyer theo doanh thu
- Số lô hàng đang trên đường vận chuyển (In Transit)
- Dòng tiền: thu trong tháng vs chi trong tháng

### Dashboard Sales Export
- Danh sách Sales Contract theo trạng thái (Draft / Confirmed / Shipped / Paid)
- Đơn hàng chưa giao (pending shipment)
- AR Aging theo buyer
- Tỷ lệ chuyển đổi báo giá → hợp đồng (PI → Contract conversion rate)
- Doanh thu theo từng thị trường / quốc gia

### Dashboard Logistics / Kho
- Lô hàng sắp xuất (shipment trong 7–14 ngày tới)
- Tồn kho cần chuẩn bị cho đơn hàng sắp giao
- Hàng đang trên đường (ETA tracking)
- Chứng từ còn thiếu theo từng shipment
- L/C sắp hết hạn

### Dashboard Kế Toán
- AP cần thanh toán trong tuần / tháng (theo nhà cung cấp)
- AR quá hạn (theo buyer và dải ngày)
- Dòng tiền dự báo (cash flow forecast)
- Chênh lệch tỷ giá trong kỳ

### KPI Xuất Khẩu
- Doanh thu xuất khẩu (USD / VND)
- Gross Profit Margin (%) theo sản phẩm và thị trường
- Days Sales Outstanding (DSO) — trung bình số ngày thu tiền
- On-time shipment rate (%)
- Số lượng và giá trị đơn hàng mới trong tháng
- Vòng quay tồn kho (Inventory Turnover)
- Chi phí logistics / doanh thu (%)

---

## 13. Workflow & Phê Duyệt

### Ma Trận Phê Duyệt
- Báo giá (PI) > X USD: Sales Manager duyệt
- Hợp đồng (Contract) > Y USD: Giám đốc duyệt
- PO nội địa > Z VND: Giám đốc duyệt
- Điều chỉnh giá vốn / chi phí: Kế toán trưởng duyệt
- Hủy hợp đồng: Giám đốc duyệt

### Phê Duyệt Nhiều Cấp
- Duyệt tuần tự theo cấu hình: Sales → Manager → Director
- Từ chối ở bất kỳ bước nào với lý do bắt buộc
- Thông báo tự động (email / in-app) khi cần duyệt

### Audit Trail
- Lưu đầy đủ: ai làm gì, lúc nào, giá trị cũ / mới
- Không cho phép xóa audit trail
- Lưu lý do với mọi hành động hủy, điều chỉnh

---

## 14. Phân Quyền (RBAC)

| Vai trò | Quyền chính |
|---|---|
| Giám đốc | Xem tất cả, duyệt hợp đồng lớn, xem báo cáo tài chính |
| Sales Export | Tạo PI, tạo Contract, theo dõi shipment, xem AR |
| Purchasing | Tạo PO, quản lý nhà cung cấp, theo dõi nhập hàng |
| Logistics | Tạo Shipment, quản lý chứng từ, theo dõi vận chuyển |
| Kế toán | Ghi nhận thanh toán, quản lý AR/AP, xuất báo cáo tài chính |
| Kho | Nhập/xuất kho, kiểm kê, xem tồn kho |
| Kế toán trưởng | Tất cả quyền kế toán, duyệt điều chỉnh giá trị lớn |

- Phân quyền theo hành động: Create, Read, Update, Delete, Approve, Cancel, Export
- Phân quyền theo trường: không hiện giá vốn với Sales, không hiện thông tin thanh toán L/C với Kho

---

## 15. Tích Hợp & Tiện Ích

- Xuất PDF: Commercial Invoice, Packing List, Proforma Invoice đúng định dạng quốc tế
- Gửi email trực tiếp từ hệ thống với chứng từ đính kèm
- Import dữ liệu từ Excel (sản phẩm, buyer, giá...)
- Export báo cáo sang Excel / PDF
- Tích hợp tỷ giá hối đoái tự động (Vietcombank / ECB API)
- Lịch sử phiên bản cho mọi document (version history)
- Tìm kiếm toàn văn (full-text search) trên hợp đồng, buyer, sản phẩm
