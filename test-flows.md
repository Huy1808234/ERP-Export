# Checklist Test Luồng — Mini-ERP Thương Mại Xuất Khẩu B2B

> Mục tiêu: test hệ thống theo luồng nghiệp vụ thực tế từ dữ liệu nền -> mua hàng -> nhập kho -> bán xuất khẩu -> logistics -> chứng từ -> thu/chi tiền -> kế toán -> báo cáo.

---

## 0. Nguyên Tắc Test

- Test theo hành trình end-to-end trước, sau đó mới test từng màn hình chi tiết.
- Mỗi nghiệp vụ cần kiểm tra cả dữ liệu đầu vào, trạng thái sau xử lý, số liệu tồn kho/công nợ, và quyền truy cập.
- Mỗi hành động quan trọng cần kiểm tra audit trail nếu hệ thống có hỗ trợ.
- Khi test lỗi, phải kiểm tra thông báo lỗi có rõ ràng và dữ liệu không bị ghi sai.

---

## 1. Tài Khoản Và Vai Trò Cần Chuẩn Bị

| Vai trò | Mục đích test |
|---|---|
| Admin / Giám đốc | Cấu hình, xem toàn hệ thống, duyệt nghiệp vụ lớn |
| Sales Export | Tạo buyer, inquiry, PI, sales contract |
| Purchasing | Tạo PR, PO, quản lý vendor |
| Warehouse / Kho | Nhập kho, xuất kho, kiểm kê, điều chỉnh tồn |
| Logistics | Tạo shipment, container, tracking, chứng từ |
| Accounting / Kế toán | Quản lý AR/AP, thanh toán, tỷ giá, báo cáo |
| Buyer Portal User | Test phía khách hàng B2B |

### 1.1. Data Tài Khoản Test Đề Xuất

> Mật khẩu dưới đây chỉ dùng cho môi trường dev/test. Nếu hệ thống có rule mật khẩu riêng, đổi theo rule hiện tại.

| User | Email | Mật khẩu test | Vai trò | Dùng để test |
|---|---|---|---|---|
| Nguyễn Minh Admin | admin@mini-erp.test | Test@123456 | Admin / Giám đốc | Cấu hình hệ thống, tạo user, xem toàn bộ dashboard, duyệt nghiệp vụ lớn |
| Trần Hà Sales | sales@mini-erp.test | Test@123456 | Sales Export | Buyer, inquiry, quotation, PI, sales contract, theo dõi AR cơ bản |
| Phạm Quốc Purchasing | purchasing@mini-erp.test | Test@123456 | Purchasing | Vendor, PR, PO, theo dõi mua hàng trong nước |
| Lê Anh Kho | warehouse@mini-erp.test | Test@123456 | Warehouse / Kho | GRN, tồn kho, lot, reservation, xuất kho, kiểm kê |
| Võ Thanh Logistics | logistics@mini-erp.test | Test@123456 | Logistics | Shipment, container, forwarder, tracking, bộ chứng từ xuất khẩu |
| Đặng Thu Accounting | accounting@mini-erp.test | Test@123456 | Accounting / Kế toán | AR, AP, thanh toán buyer/vendor, tỷ giá, báo cáo kế toán |
| Sarah Buyer | buyer.us@customer.test | Test@123456 | Buyer Portal User | Đăng nhập portal, tạo inquiry, xem PI/contract, tracking, download chứng từ |
| Kenji Buyer | buyer.jp@customer.test | Test@123456 | Buyer Portal User | Test buyer khác để kiểm tra không xem chéo dữ liệu |

### 1.2. Kỳ Vọng Phân Quyền Khi Test User

| User | Nên được phép | Nên bị chặn |
|---|---|---|
| admin@mini-erp.test | Xem/sửa toàn bộ, duyệt PR/PI/Contract/PO lớn | Không áp dụng |
| sales@mini-erp.test | Tạo buyer, inquiry, PI, contract, xem shipment liên quan | Không được thanh toán vendor, không sửa tồn kho, không xem giá vốn nếu có field permission |
| purchasing@mini-erp.test | Tạo vendor, PR, PO, xem trạng thái GRN/vendor invoice | Không được thu tiền buyer, không duyệt contract lớn |
| warehouse@mini-erp.test | Nhập kho, xuất kho, kiểm kê, xem tồn kho | Không được xem AR/AP, không được sửa giá bán/giá vốn nếu bị giới hạn |
| logistics@mini-erp.test | Tạo shipment, container, upload chứng từ, cập nhật tracking | Không được ghi nhận thanh toán, không sửa PO/PI |
| accounting@mini-erp.test | Ghi nhận AR/AP, thanh toán, tỷ giá, báo cáo tài chính | Không nên tạo/sửa shipment nếu phân quyền chặt |
| buyer.us@customer.test | Xem inquiry/PI/contract/shipment/chứng từ của chính buyer US | Không xem được dữ liệu buyer JP hoặc dữ liệu admin nội bộ |
| buyer.jp@customer.test | Xem inquiry/PI/contract/shipment/chứng từ của chính buyer JP | Không xem được dữ liệu buyer US hoặc dữ liệu admin nội bộ |

Checklist:

- [ ] Tạo đủ user theo từng vai trò.
- [ ] Đăng nhập được từng user.
- [ ] Kiểm tra menu hiển thị đúng theo quyền.
- [ ] Kiểm tra user không có quyền thì không truy cập được màn hình nhạy cảm.

---

## 2. Dữ Liệu Nền Cần Có Trước Khi Test

### 2.1. Buyer Nước Ngoài

- [ ] Tạo buyer nước ngoài.
- [ ] Nhập tên công ty.
- [ ] Nhập quốc gia/khu vực.
- [ ] Nhập địa chỉ.
- [ ] Nhập mã số thuế nước ngoài nếu có.
- [ ] Chọn tiền tệ mặc định: USD/EUR/GBP.
- [ ] Chọn điều khoản thanh toán: T/T, L/C, D/P, D/A.
- [ ] Nhập ngân hàng buyer.
- [ ] Nhập credit limit.
- [ ] Nhập ghi chú nội bộ.
- [ ] Kiểm tra buyer xuất hiện trong danh sách.
- [ ] Kiểm tra tìm kiếm/lọc buyer.

### 2.2. Vendor Trong Nước

- [ ] Tạo vendor.
- [ ] Nhập tên nhà cung cấp.
- [ ] Nhập mã số thuế.
- [ ] Nhập địa chỉ.
- [ ] Nhập người liên hệ.
- [ ] Chọn ngành hàng.
- [ ] Chọn điều khoản thanh toán: trả ngay/net 30/net 60.
- [ ] Nhập đánh giá vendor nếu có.
- [ ] Kiểm tra vendor xuất hiện trong danh sách.
- [ ] Kiểm tra tìm kiếm/lọc vendor.

### 2.3. Sản Phẩm

- [ ] Tạo sản phẩm.
- [ ] Nhập mã hàng.
- [ ] Nhập tên sản phẩm.
- [ ] Nhập đơn vị tính.
- [ ] Nhập HS Code.
- [ ] Nhập mô tả tiếng Anh.
- [ ] Nhập net weight.
- [ ] Nhập gross weight.
- [ ] Nhập CBM/kích thước thùng.
- [ ] Nhập giá mua VND.
- [ ] Nhập giá bán ngoại tệ.
- [ ] Gắn vendor mặc định.
- [ ] Kiểm tra sản phẩm xuất hiện trong danh sách.
- [ ] Kiểm tra sản phẩm dùng được ở PR/PO/PI.

### 2.4. Tiền Tệ Và Tỷ Giá

- [ ] Tạo/kiểm tra danh sách tiền tệ: VND, USD, EUR.
- [ ] Nhập tỷ giá ngày hiện tại.
- [ ] Kiểm tra tỷ giá dùng được khi tạo PI/invoice/thanh toán.
- [ ] Kiểm tra giao dịch ngoại tệ lưu cả giá trị ngoại tệ và giá trị VND quy đổi.

### 2.5. Forwarder / Shipping Agent

- [ ] Tạo forwarder.
- [ ] Nhập tuyến vận chuyển.
- [ ] Nhập báo giá cước.
- [ ] Kiểm tra forwarder chọn được trong shipment.

---

## 3. Luồng Chính End-to-End

Luồng tổng:

```txt
Master Data
-> Purchase Request
-> Purchase Order
-> Goods Receipt
-> Vendor Invoice
-> Inventory
-> Proforma Invoice
-> Sales Contract
-> Reservation
-> Shipment
-> Export Documents
-> Commercial Invoice
-> AR Collection
-> Vendor Payment
-> Accounting Reports
```

---

## 4. Luồng Mua Hàng Trong Nước P2P

### 4.1. Purchase Request

- [ ] Đăng nhập bằng user Purchasing hoặc Sales.
- [ ] Tạo Purchase Request từ nhu cầu xuất khẩu.
- [ ] Chọn sản phẩm.
- [ ] Nhập số lượng.
- [ ] Chọn vendor đề xuất nếu có.
- [ ] Nhập lý do mua hàng.
- [ ] Lưu PR.
- [ ] Kiểm tra trạng thái PR là Draft/Pending.
- [ ] Gửi PR duyệt.
- [ ] Đăng nhập user có quyền duyệt.
- [ ] Duyệt PR.
- [ ] Kiểm tra trạng thái PR sau duyệt.

### 4.2. Purchase Order

- [ ] Tạo PO từ PR đã duyệt.
- [ ] Kiểm tra PO lấy đúng sản phẩm/số lượng/vendor.
- [ ] Kiểm tra tiền tệ là VND.
- [ ] Nhập ngày giao hàng dự kiến.
- [ ] Lưu PO.
- [ ] Gửi PO cho vendor.
- [ ] Kiểm tra trạng thái PO.

### 4.3. Goods Receipt

- [ ] Tạo GRN từ PO.
- [ ] Nhập số lượng thực nhận.
- [ ] Nhập kho nhận hàng.
- [ ] Nhập lot/batch nếu có.
- [ ] Lưu GRN.
- [ ] Kiểm tra tồn kho tăng.
- [ ] Kiểm tra giá trị tồn kho tăng.
- [ ] Kiểm tra lot tracking.

### 4.4. Vendor Invoice Và 3-Way Matching

- [ ] Tạo Vendor Invoice từ PO/GRN.
- [ ] Nhập số hóa đơn GTGT.
- [ ] Nhập ngày hóa đơn.
- [ ] Nhập tiền hàng và VAT.
- [ ] Kiểm tra đối chiếu 3 chiều: PO + GRN + Vendor Invoice.
- [ ] Kiểm tra hệ thống báo khớp nếu số lượng/giá trị đúng.
- [ ] Kiểm tra tạo công nợ phải trả AP.

### 4.5. Thanh Toán Vendor

- [ ] Đăng nhập user Accounting.
- [ ] Mở công nợ AP của vendor.
- [ ] Tạo phiếu thanh toán.
- [ ] Nhập số tiền thanh toán.
- [ ] Lưu thanh toán.
- [ ] Kiểm tra AP giảm.
- [ ] Kiểm tra trạng thái invoice vendor là Paid/Partially Paid.

---

## 5. Test Ngoại Lệ Mua Hàng Và Kho

### 5.1. Nhận Thiếu Hàng

- [ ] Tạo PO số lượng 100.
- [ ] Tạo GRN nhận 80.
- [ ] Kiểm tra hệ thống ghi nhận nhận thiếu 20.
- [ ] Kiểm tra backorder nếu có.
- [ ] Kiểm tra tồn chỉ tăng 80.

### 5.2. Nhận Thừa Hàng

- [ ] Tạo PO số lượng 100.
- [ ] Tạo GRN nhận 110.
- [ ] Kiểm tra hệ thống cảnh báo nhận thừa.
- [ ] Kiểm tra cần duyệt hoặc cần xác nhận nếu có cấu hình.

### 5.3. Hàng Lỗi / Quarantine

- [ ] Khi nhận hàng, đánh dấu một phần hàng bị lỗi.
- [ ] Đưa hàng vào khu Quarantine.
- [ ] Tạo Rejection nếu có.
- [ ] Kiểm tra hàng lỗi không được tính vào tồn khả dụng.

### 5.4. Hủy PO

- [ ] Mở PO chưa hoàn tất.
- [ ] Thực hiện hủy PO.
- [ ] Kiểm tra bắt buộc nhập lý do.
- [ ] Kiểm tra trạng thái PO là Cancelled.
- [ ] Kiểm tra audit trail ghi nhận người hủy và lý do.

### 5.5. Trả Hàng Vendor

- [ ] Tạo Purchase Return từ GRN/PO.
- [ ] Nhập số lượng trả.
- [ ] Nhập lý do trả hàng.
- [ ] Lưu phiếu trả hàng.
- [ ] Kiểm tra tồn kho giảm.
- [ ] Kiểm tra AP/vendor invoice điều chỉnh nếu có.

---

## 6. Luồng Kho

### 6.1. Tồn Kho

- [ ] Kiểm tra tồn kho sau GRN.
- [ ] Kiểm tra tồn theo sản phẩm.
- [ ] Kiểm tra tồn theo lot.
- [ ] Kiểm tra tồn khả dụng.
- [ ] Thử xuất quá tồn.
- [ ] Kiểm tra hệ thống chặn tồn âm.

### 6.2. Reservation

- [ ] Tạo Sales Contract cần giao hàng.
- [ ] Đặt giữ hàng cho contract.
- [ ] Kiểm tra tồn khả dụng giảm.
- [ ] Kiểm tra tồn thực tế chưa giảm.
- [ ] Hủy reservation nếu contract bị hủy.
- [ ] Kiểm tra tồn khả dụng tăng lại.

### 6.3. Export Delivery

- [ ] Tạo phiếu xuất kho cho shipment.
- [ ] Chọn đúng lot theo FIFO nếu có.
- [ ] Lưu phiếu xuất.
- [ ] Kiểm tra tồn thực tế giảm.
- [ ] Kiểm tra giá vốn xuất kho.

### 6.4. Inventory Adjustment

- [ ] Tạo phiếu điều chỉnh tồn kho.
- [ ] Nhập số lượng điều chỉnh.
- [ ] Nhập lý do.
- [ ] Gửi duyệt nếu cần.
- [ ] Duyệt điều chỉnh.
- [ ] Kiểm tra tồn kho cập nhật.
- [ ] Kiểm tra audit trail.

### 6.5. Kiểm Kê

- [ ] Tạo kỳ kiểm kê.
- [ ] Nhập số lượng thực tế.
- [ ] So sánh với số hệ thống.
- [ ] Ghi nhận chênh lệch.
- [ ] Nhập lý do hao hụt/hư hỏng.
- [ ] Chốt kiểm kê.
- [ ] Kiểm tra tồn kho sau kiểm kê.

---

## 7. Luồng Bán Hàng Xuất Khẩu O2C

### 7.1. Inquiry / Báo Giá

- [ ] Tạo inquiry từ buyer hoặc từ Sales.
- [ ] Chọn buyer.
- [ ] Chọn sản phẩm.
- [ ] Nhập số lượng.
- [ ] Chọn tiền tệ.
- [ ] Chọn Incoterms.
- [ ] Nhập yêu cầu giao hàng.
- [ ] Chuyển inquiry thành PI nếu có.

### 7.2. Proforma Invoice

- [ ] Tạo PI.
- [ ] Chọn buyer.
- [ ] Chọn sản phẩm.
- [ ] Nhập số lượng.
- [ ] Nhập giá bán ngoại tệ.
- [ ] Chọn Incoterms: EXW/FOB/CIF/CFR/DDP.
- [ ] Chọn payment term: T/T, L/C, D/P, D/A.
- [ ] Kiểm tra tổng tiền ngoại tệ.
- [ ] Kiểm tra quy đổi VND theo tỷ giá.
- [ ] Xuất PDF PI.
- [ ] Kiểm tra PDF đúng thông tin buyer, sản phẩm, giá, điều kiện giao hàng.

### 7.3. Chính Sách Giá Theo Incoterms

- [ ] Test giá EXW.
- [ ] Test giá FOB = EXW + local trucking/origin charges nếu có.
- [ ] Test giá CIF = FOB + freight + insurance nếu có.
- [ ] Kiểm tra cùng sản phẩm có thể có giá khác nhau theo thị trường/quốc gia.
- [ ] Kiểm tra lịch sử giá theo buyer.

### 7.4. Sales Contract

- [ ] Chuyển PI thành Sales Contract.
- [ ] Kiểm tra dữ liệu kế thừa từ PI.
- [ ] Nhập số hợp đồng.
- [ ] Nhập ngày hợp đồng.
- [ ] Kiểm tra trạng thái Draft.
- [ ] Gửi duyệt nếu vượt ngưỡng.
- [ ] Đăng nhập Manager/Director để duyệt.
- [ ] Kiểm tra trạng thái Confirmed sau duyệt.

### 7.5. Reservation Cho Sales Contract

- [ ] Từ contract đã confirmed, đặt giữ hàng.
- [ ] Kiểm tra tồn khả dụng giảm.
- [ ] Kiểm tra contract hiển thị đã reserved.
- [ ] Nếu không đủ tồn, kiểm tra hệ thống cảnh báo.

---

## 8. Luồng Logistics Và Shipment

### 8.1. Tạo Shipment

- [ ] Tạo shipment từ Sales Contract.
- [ ] Kiểm tra link với contract.
- [ ] Nhập cảng xuất POL.
- [ ] Nhập cảng đến POD.
- [ ] Chọn forwarder.
- [ ] Nhập hãng tàu/hãng bay.
- [ ] Nhập ETD.
- [ ] Nhập ETA.
- [ ] Lưu shipment.

### 8.2. Container

- [ ] Thêm container.
- [ ] Nhập container number.
- [ ] Nhập seal number.
- [ ] Chọn loại container: 20ft/40ft/40HQ.
- [ ] Kiểm tra CBM và gross weight.
- [ ] Kiểm tra hệ thống gợi ý/cảnh báo nếu vượt tải hoặc vượt CBM.

### 8.3. Chi Phí Logistics

- [ ] Nhập freight.
- [ ] Nhập trucking.
- [ ] Nhập origin charges.
- [ ] Nhập customs fee.
- [ ] Nhập inspection/quarantine fee nếu có.
- [ ] Nhập insurance.
- [ ] Nhập bank charges nếu có.
- [ ] Kiểm tra tổng chi phí logistics.
- [ ] Kiểm tra phân bổ chi phí vào giá vốn shipment.

### 8.4. Tracking Trạng Thái Shipment

- [ ] Cập nhật trạng thái Draft.
- [ ] Cập nhật trạng thái Booked.
- [ ] Cập nhật trạng thái Packed.
- [ ] Cập nhật trạng thái Exported.
- [ ] Cập nhật trạng thái In Transit.
- [ ] Cập nhật trạng thái Arrived.
- [ ] Cập nhật trạng thái Completed.
- [ ] Kiểm tra timeline hiển thị đúng.
- [ ] Kiểm tra dashboard logistics cập nhật.

---

## 9. Luồng Hồ Sơ Xuất Khẩu

### 9.1. Chứng Từ Thương Mại

- [ ] Xuất Proforma Invoice.
- [ ] Xuất Commercial Invoice từ Sales Contract/Shipment.
- [ ] Xuất Packing List.
- [ ] Kiểm tra thông tin buyer.
- [ ] Kiểm tra thông tin sản phẩm.
- [ ] Kiểm tra HS Code.
- [ ] Kiểm tra net/gross weight.
- [ ] Kiểm tra số kiện/CBM.
- [ ] Kiểm tra Incoterms và payment term.

### 9.2. Chứng Từ Vận Tải

- [ ] Nhập Bill of Lading nếu vận tải biển.
- [ ] Nhập Airway Bill nếu vận tải hàng không.
- [ ] Nhập tên tàu/chuyến.
- [ ] Nhập cảng đi/cảng đến.
- [ ] Nhập ngày tàu chạy.
- [ ] Upload file PDF/scan.

### 9.3. Chứng Từ Xuất Xứ Và Chất Lượng

- [ ] Nhập Certificate of Origin.
- [ ] Chọn form C/O: Form B, D, AI, E nếu có.
- [ ] Upload Phytosanitary Certificate nếu hàng nông sản.
- [ ] Upload Health/Fumigation Certificate nếu cần.
- [ ] Upload Quality Inspection Certificate nếu có.

### 9.4. Hải Quan Xuất Khẩu

- [ ] Nhập số tờ khai hải quan.
- [ ] Nhập ngày thông quan.
- [ ] Nhập trạng thái: Khai báo/Phân luồng/Thông quan.
- [ ] Kiểm tra HS Code trên tờ khai.
- [ ] Upload chứng từ hoàn thuế GTGT nếu có.

### 9.5. Checklist Bộ Chứng Từ

- [ ] Kiểm tra shipment có checklist chứng từ.
- [ ] Kiểm tra chứng từ đã có được đánh dấu done.
- [ ] Kiểm tra chứng từ còn thiếu được cảnh báo.
- [ ] Tải từng file chứng từ.
- [ ] Tải toàn bộ bộ chứng từ nếu có.
- [ ] Gửi chứng từ cho buyer qua email/download link nếu có.

---

## 10. Luồng Thanh Toán Quốc Tế Và AR

### 10.1. Commercial Invoice Và AR

- [ ] Tạo Commercial Invoice chính thức.
- [ ] Kiểm tra invoice ghi nhận AR ngoại tệ.
- [ ] Kiểm tra tỷ giá tại ngày invoice.
- [ ] Kiểm tra giá trị VND quy đổi.
- [ ] Kiểm tra AR Aging có invoice mới.

### 10.2. T/T Advance Và Balance

- [ ] Ghi nhận T/T advance.
- [ ] Nhập số tiền đặt cọc.
- [ ] Kiểm tra trạng thái invoice/contract là Partially Paid nếu phù hợp.
- [ ] Ghi nhận T/T balance.
- [ ] Kiểm tra tổng tiền nhận khớp invoice.
- [ ] Kiểm tra trạng thái Paid.
- [ ] Kiểm tra AR giảm.

### 10.3. Letter Of Credit

- [ ] Tạo hồ sơ L/C.
- [ ] Nhập số L/C.
- [ ] Nhập ngân hàng phát hành.
- [ ] Nhập số tiền.
- [ ] Nhập ngày hết hạn.
- [ ] Nhập shipment deadline.
- [ ] Nhập presentation deadline.
- [ ] Cập nhật trạng thái Received.
- [ ] Cập nhật Documents Presented.
- [ ] Cập nhật Accepted.
- [ ] Cập nhật Paid.
- [ ] Kiểm tra cảnh báo L/C sắp hết hạn.
- [ ] Ghi nhận discrepancy nếu chứng từ sai.

### 10.4. D/P Và D/A

- [ ] Tạo Collection Order.
- [ ] Cập nhật trạng thái Sent.
- [ ] Cập nhật Accepted.
- [ ] Cập nhật Paid.
- [ ] Test trạng thái Dishonoured.
- [ ] Kiểm tra rủi ro không thanh toán được ghi nhận.

### 10.5. Chênh Lệch Tỷ Giá

- [ ] Tạo invoice tỷ giá ngày A.
- [ ] Ghi nhận thu tiền tỷ giá ngày B.
- [ ] Kiểm tra realized exchange gain/loss.
- [ ] Kiểm tra bút toán hoặc báo cáo chênh lệch tỷ giá.

---

## 11. Luồng Kế Toán

### 11.1. Ghi Nhận Tự Động

- [ ] Mua hàng tạo AP nội địa.
- [ ] GRN tăng tồn kho.
- [ ] Vendor invoice ghi nhận VAT đầu vào nếu có.
- [ ] Xuất kho ghi nhận giá vốn.
- [ ] Commercial Invoice ghi nhận doanh thu xuất khẩu.
- [ ] Commercial Invoice ghi nhận AR ngoại tệ.
- [ ] Thu tiền buyer giảm AR.
- [ ] Thanh toán vendor giảm AP.
- [ ] Logistics cost được ghi nhận vào giá vốn hoặc chi phí bán hàng.

### 11.2. Báo Cáo Kế Toán

- [ ] Kiểm tra P&L.
- [ ] Kiểm tra Balance Sheet.
- [ ] Kiểm tra Cash Flow.
- [ ] Kiểm tra VAT Report.
- [ ] Kiểm tra AR Aging.
- [ ] Kiểm tra AP Aging.
- [ ] Kiểm tra báo cáo công nợ theo từng loại tiền tệ.
- [ ] Kiểm tra báo cáo chênh lệch tỷ giá.

---

## 12. Dashboard Và Báo Cáo Quản Trị

### 12.1. Dashboard Giám Đốc

- [ ] Doanh thu xuất khẩu tháng này.
- [ ] Doanh thu theo USD và VND.
- [ ] Gross profit margin.
- [ ] AR outstanding.
- [ ] AR Aging.
- [ ] Tồn kho hiện tại.
- [ ] Giá trị tồn kho.
- [ ] Top buyer theo doanh thu.
- [ ] Shipment đang in transit.
- [ ] Dòng tiền thu/chi trong tháng.

### 12.2. Dashboard Sales Export

- [ ] Danh sách PI.
- [ ] Danh sách Sales Contract theo trạng thái.
- [ ] Đơn hàng chưa giao.
- [ ] AR theo buyer.
- [ ] Tỷ lệ chuyển đổi PI -> Contract.
- [ ] Doanh thu theo thị trường/quốc gia.

### 12.3. Dashboard Logistics / Kho

- [ ] Shipment sắp xuất trong 7-14 ngày.
- [ ] Tồn kho cần chuẩn bị cho đơn sắp giao.
- [ ] Hàng đang trên đường.
- [ ] Chứng từ còn thiếu theo shipment.
- [ ] L/C sắp hết hạn nếu có.

### 12.4. Dashboard Kế Toán

- [ ] AP cần thanh toán trong tuần/tháng.
- [ ] AR quá hạn theo buyer.
- [ ] Cash flow forecast.
- [ ] Chênh lệch tỷ giá trong kỳ.

---

## 13. Workflow Phê Duyệt

### 13.1. Ma Trận Phê Duyệt

- [ ] PI vượt ngưỡng X USD yêu cầu Sales Manager duyệt.
- [ ] Contract vượt ngưỡng Y USD yêu cầu Giám đốc duyệt.
- [ ] PO nội địa vượt ngưỡng Z VND yêu cầu Giám đốc duyệt.
- [ ] Điều chỉnh giá vốn/chi phí yêu cầu Kế toán trưởng duyệt.
- [ ] Hủy hợp đồng yêu cầu Giám đốc duyệt.

### 13.2. Từ Chối Duyệt

- [ ] Gửi một chứng từ đi duyệt.
- [ ] Người duyệt từ chối.
- [ ] Kiểm tra bắt buộc nhập lý do.
- [ ] Kiểm tra trạng thái chứng từ là Rejected.
- [ ] Kiểm tra người tạo nhận thông báo nếu có.
- [ ] Kiểm tra audit trail có lý do từ chối.

### 13.3. Thông Báo

- [ ] Khi cần duyệt, người duyệt nhận thông báo.
- [ ] Khi duyệt xong, người tạo nhận thông báo.
- [ ] Khi từ chối, người tạo nhận thông báo.
- [ ] Khi L/C sắp hết hạn, user liên quan nhận thông báo.
- [ ] Khi AP gần đến hạn, kế toán nhận thông báo.

---

## 14. RBAC Và Bảo Mật

### 14.1. Kiểm Tra Theo Vai Trò

- [ ] Sales tạo được PI.
- [ ] Sales tạo được Contract.
- [ ] Sales không duyệt được contract lớn nếu không có quyền.
- [ ] Purchasing tạo được PO.
- [ ] Purchasing không xem được báo cáo tài chính nếu không có quyền.
- [ ] Warehouse nhập/xuất kho được.
- [ ] Warehouse không thấy giá vốn nếu hệ thống có phân quyền trường.
- [ ] Logistics tạo shipment và chứng từ được.
- [ ] Accounting ghi nhận thanh toán được.
- [ ] Accounting xem AR/AP được.
- [ ] Director xem được dashboard toàn hệ thống.

### 14.2. Audit Trail

- [ ] Sửa buyer có log.
- [ ] Sửa vendor có log.
- [ ] Sửa sản phẩm có log.
- [ ] Duyệt/từ chối PR có log.
- [ ] Hủy PO có log.
- [ ] Điều chỉnh tồn kho có log.
- [ ] Hủy contract có log.
- [ ] Không xóa được audit trail.

---

## 15. Import, Export, PDF Và Tìm Kiếm

- [ ] Import sản phẩm từ Excel.
- [ ] Import buyer từ Excel nếu có.
- [ ] Import bảng giá nếu có.
- [ ] Export danh sách sản phẩm ra Excel.
- [ ] Export báo cáo ra Excel/PDF.
- [ ] Xuất PDF PI.
- [ ] Xuất PDF Commercial Invoice.
- [ ] Xuất PDF Packing List.
- [ ] Kiểm tra định dạng PDF đúng logo/thông tin công ty/buyer/sản phẩm.
- [ ] Gửi email chứng từ có file đính kèm nếu có.
- [ ] Tìm kiếm toàn văn theo số hợp đồng.
- [ ] Tìm kiếm toàn văn theo buyer.
- [ ] Tìm kiếm toàn văn theo mã sản phẩm.

---

## 16. Customer Portal B2B

Luồng portal:

```txt
Register
-> Login
-> Create Inquiry
-> View PI / Contract
-> E-sign
-> Track Shipment
-> Download Documents
-> Upload T/T Receipt
-> Create Support Ticket
```

### 16.1. Public Portal

- [ ] Truy cập portal khi chưa đăng nhập.
- [ ] Xem catalog sản phẩm.
- [ ] Xem mô tả sản phẩm.
- [ ] Xem HS Code.
- [ ] Xem hình ảnh demo.
- [ ] Xem giới thiệu công ty.
- [ ] Xem dịch vụ logistics.
- [ ] Xem thông tin liên hệ.
- [ ] Đăng ký tài khoản buyer mới.

### 16.2. Buyer Login

- [ ] Buyer đăng nhập.
- [ ] Buyer chỉ thấy dữ liệu của chính mình.
- [ ] Buyer không xem được dữ liệu buyer khác.
- [ ] Buyer cập nhật thông tin cá nhân nếu có.

### 16.3. Inquiry

- [ ] Buyer tạo inquiry.
- [ ] Buyer chọn sản phẩm.
- [ ] Buyer nhập số lượng.
- [ ] Buyer nhập cảng đến/quốc gia.
- [ ] Buyer gửi inquiry.
- [ ] Sales nhìn thấy inquiry trong admin.
- [ ] Sales chuyển inquiry thành PI.

### 16.4. PI / Contract / E-Sign

- [ ] Buyer xem danh sách PI.
- [ ] Buyer xem chi tiết PI.
- [ ] Buyer tải PDF PI.
- [ ] Buyer xem Sales Contract.
- [ ] Buyer phê duyệt/ký điện tử contract nếu có.
- [ ] Admin thấy trạng thái buyer đã ký/duyệt.

### 16.5. Shipment Tracking

- [ ] Buyer xem danh sách shipment của mình.
- [ ] Buyer xem timeline shipment.
- [ ] Buyer xem ETD/ETA.
- [ ] Buyer xem tên tàu/chuyến.
- [ ] Buyer xem số container.
- [ ] Buyer xem số seal.
- [ ] Khi admin cập nhật trạng thái shipment, portal cập nhật theo.

### 16.6. Document Center

- [ ] Buyer xem bộ chứng từ theo shipment.
- [ ] Buyer tải Commercial Invoice.
- [ ] Buyer tải Packing List.
- [ ] Buyer tải B/L hoặc AWB.
- [ ] Buyer tải C/O nếu có.
- [ ] Buyer không tải được chứng từ của buyer khác.

### 16.7. Payment Upload

- [ ] Buyer xem Statement of Account.
- [ ] Buyer upload T/T Receipt hoặc Swift MT103.
- [ ] Kế toán thấy file upload trong admin.
- [ ] Kế toán xác nhận thanh toán.
- [ ] Portal cập nhật trạng thái thanh toán.

### 16.8. Support Ticket

- [ ] Buyer tạo ticket khiếu nại.
- [ ] Buyer nhập nội dung.
- [ ] Buyer đính kèm hình ảnh.
- [ ] Admin thấy ticket.
- [ ] Admin phản hồi ticket.
- [ ] Buyer thấy phản hồi.
- [ ] Đóng ticket.

---

## 17. Bộ Kịch Bản Test Tối Thiểu

### Scenario A: Mua Hàng Và Nhập Kho Thành Công

```txt
Vendor -> Product -> PR -> Approve PR -> PO -> GRN -> Vendor Invoice -> AP
```

- [ ] Hoàn tất toàn bộ flow.
- [ ] Tồn kho tăng đúng.
- [ ] AP phát sinh đúng.

### Scenario B: Bán Xuất Khẩu Và Thu Tiền T/T

```txt
Buyer -> PI -> Sales Contract -> Reservation -> Shipment -> Export Delivery -> Commercial Invoice -> T/T Collection -> AR Paid
```

- [ ] Hoàn tất toàn bộ flow.
- [ ] Tồn kho giảm đúng.
- [ ] AR phát sinh và được thanh toán.
- [ ] Doanh thu lên dashboard.

### Scenario C: Shipment Có Đủ Bộ Chứng Từ

```txt
Shipment -> Container -> Packing List -> Commercial Invoice -> B/L -> C/O -> Document Checklist Done
```

- [ ] Tạo đủ chứng từ.
- [ ] Upload đủ file.
- [ ] Checklist báo hoàn tất.
- [ ] Buyer tải được chứng từ từ portal.

### Scenario D: L/C Và Cảnh Báo Deadline

```txt
Contract -> L/C Received -> Shipment Deadline -> Documents Presented -> Accepted -> Paid
```

- [ ] Tạo L/C.
- [ ] Kiểm tra cảnh báo deadline.
- [ ] Cập nhật đủ trạng thái.
- [ ] Ghi nhận thanh toán.

### Scenario E: Phân Quyền

```txt
Login từng role -> Kiểm tra menu -> Thử thao tác không có quyền -> Kiểm tra bị chặn
```

- [ ] Sales không xem được màn hình nhạy cảm kế toán nếu bị giới hạn.
- [ ] Warehouse không thấy giá vốn nếu bị giới hạn.
- [ ] Accounting không duyệt contract nếu không có quyền.
- [ ] Director duyệt được nghiệp vụ lớn.

---

## 18. Ghi Chú Khi Test

| Ngày test | Người test | Module | Kết quả | Lỗi phát hiện | Ghi chú |
|---|---|---|---|---|---|
|  |  |  |  |  |  |
|  |  |  |  |  |  |
|  |  |  |  |  |  |
