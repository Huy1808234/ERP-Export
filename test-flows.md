# Checklist Test Luồng — Mini-ERP Thương Mại Xuất Khẩu B2B

> Mục tiêu: test hệ thống theo luồng nghiệp vụ thực tế từ dữ liệu nền -> mua hàng -> nhập kho -> bán xuất khẩu -> logistics -> chứng từ -> thu/chi tiền -> kế toán -> báo cáo.

---

## 0. Nguyên Tắc Test

- Test theo hành trình end-to-end trước, sau đó mới test từng màn hình chi tiết.
- Mỗi nghiệp vụ cần kiểm tra cả dữ liệu đầu vào, trạng thái sau xử lý, số liệu tồn kho/công nợ, và quyền truy cập.
- Mỗi hành động quan trọng cần kiểm tra audit trail nếu hệ thống có hỗ trợ.
- Khi test lỗi, phải kiểm tra thông báo lỗi có rõ ràng và dữ liệu không bị ghi sai.

### 0.1. Thứ Tự Test Khuyến Nghị

Đi theo thứ tự này để phát hiện lỗi chặn luồng trước, rồi mới test sâu từng module:

| Thứ tự | Nhóm test | Module/màn hình | Điều kiện qua bước |
|---|---|---|---|
| P0-01 | Smoke hệ thống | Login, đổi ngôn ngữ, sidebar, search header, reload trang | Không trắng màn hình, không 401/403 sai, không mixed locale nghiêm trọng trên màn đang test |
| P0-02 | Dữ liệu nền | Đối Tác, Sản Phẩm, Tiền tệ/tỷ giá, Forwarder, User/Role | Tạo/sửa/tìm kiếm được dữ liệu tối thiểu cho P2P và O2C |
| P0-03 | Phê duyệt | Ma Trận Phê Duyệt, Smart Approvals | Có rule cho PR/PO/Contract/Inventory Adjustment/AP Payment; duyệt/từ chối chạy đúng role |
| P0-04 | P2P happy path | PR -> PO -> GRN -> Vendor Invoice -> 3-Way Matching -> AP | Tồn kho tăng, Vendor Invoice khớp, AP phát sinh |
| P0-05 | O2C happy path | Inquiry -> Quotation -> Pricing Policy -> PI -> Sales Contract -> Signature/Approve | Contract approved/confirmed, reservation giữ hàng đúng |
| P0-06 | Kho và xuất hàng | Reservation -> Shipment -> Export Delivery -> Issue Stock | Tồn kho giảm, reserved stock giảm, không phát sinh lỗi FOR UPDATE |
| P0-07 | Chứng từ và AR | Commercial Invoice issue -> Export Document -> AR Aging -> T/T Allocation | CI issued tạo AR, AR giảm khi phân bổ thanh toán |
| P0-08 | Finance/AP | L/C, D/P/D/A, T/T, AP payment batch | Thanh toán buyer/vendor cập nhật đúng công nợ và journal |
| P0-09 | Portal buyer | Buyer login -> xem PI/Contract/Shipment/Documents/Statement | Buyer chỉ thấy dữ liệu của chính mình |
| P1-01 | Ngoại lệ mua/kho | GRN reject, PO short receipt, P2P/QC Exception, Purchase Return | Candidate hiện đúng, claim/resolve không crash, AP chỉ ghi phần hợp lệ |
| P1-02 | Ngoại lệ O2C | Customer Return, cancel contract/PO, overdue AR, partial payment | Trạng thái và số liệu được rollback/cập nhật đúng |
| P1-03 | Báo cáo/dashboard | Operation Overview, Accounting & Tax, AR/AP Aging, Stock History | Số liệu khớp với chứng từ đã tạo ở P0 |
| P2-01 | I18n debt scan | Chuyển English/Vietnamese trên từng module | Ghi lại text hard-code còn lẫn, không block P0 nếu nghiệp vụ chạy đúng |
| P2-02 | Lint/cleanup debt | Backend lint legacy, unused imports frontend | Ghi nhận nợ kỹ thuật; không trộn với bug nghiệp vụ trừ khi gây runtime |

Nguyên tắc dừng test: nếu một bước P0 fail do trắng trang, API 500, sai số tồn kho/công nợ, hoặc role không đúng, dừng flow đó và fix trước khi test tiếp các bước sau.

### 0.2. Bản Đồ Test Theo Sidebar

| Nhóm menu | Test trước | Test sau | Điểm bắt buộc kiểm tra |
|---|---|---|---|
| Trung Tâm Điều Hành | Operation Overview | Smart Approvals, Approval Matrix | Dashboard load được, số liệu không âm vô lý, phê duyệt hiển thị request mới |
| Dữ Liệu Nền Tảng | Global Partners, Product Catalog | Live Inventory, Stock History, Stock Counts | Buyer/vendor/product dùng được ở PR/PO/PI; không lộ giá vốn sai role |
| Kho | Live Inventory, Stock History | Export Delivery, Customer Returns, Inventory Counts | Stock tăng/giảm/reserved đúng; xuất kho không âm; kiểm kê tạo chênh lệch |
| Kinh Doanh O2C | Market Inquiries, Sales Quotations, Pricing Policies | Proforma Invoice, Export Contract, Commercial Invoice | Giá lấy đúng policy/incoterm; PI -> contract -> CI không mất dòng hàng |
| Mua Hàng P2P | PR, PO, Goods Receipt | Vendor Invoice, Vendor Scorecards, Purchase Return, P2P/QC Exceptions, 3-Way Matching | PO nhận hàng đúng dòng; GRN reject tạo candidate; Vendor Invoice khớp 3 chiều |
| Chuỗi Cung Ứng | Global Logistics | Export Documents | Shipment có container/ETD/ETA; chứng từ sinh/upload/share portal được |
| Quản Trị Tài Chính | L/C, D/P/D/A, T/T | Buyer Receivables, AP, Accounting & Tax | AR/AP aging đúng hạn; payment allocation đúng ngoại tệ/tỷ giá; journal cân debit/credit |
| Quản Trị Hệ Thống | Team Management | RBAC, Settings, FX Management | Role thấy đúng menu; user không quyền bị chặn; tỷ giá dùng được khi tạo chứng từ |

### 0.3. Regression Bắt Buộc Sau Các Fix Runtime Gần Đây

- [ ] Tạo Export Delivery từ Shipment và bấm Issue Stock; backend log không còn lỗi `FOR UPDATE cannot be applied to the nullable side of an outer join`.
- [ ] Issue Commercial Invoice từ Shipment đã có export delivery; CI tạo AR và export document.
- [ ] Gửi ký Sales Contract cho buyer; invitation tạo được, contract chuyển trạng thái pending buyer signature.
- [ ] Tạo QC exception từ GRN rejected line; candidate biến mất khỏi danh sách pending sau khi tạo.
- [ ] Send claim và resolve QC exception; purchase return/claim cập nhật đúng trạng thái.
- [ ] Cancel PO chưa nhận hàng; PO có GRN hoặc received quantity phải bị chặn.
- [ ] Receive Customer Return đã approved; tồn kho tăng lại đúng số lượng.
- [ ] Tạo AP payment batch, duyệt, mark paid; AP status chuyển paid/partial đúng.
- [ ] Reverse AP settlement audit; paid amount giảm đúng và có journal reversal.
- [ ] Chuyển English/Vietnamese trên Account Receivables và Purchase Exceptions; ghi nhận module nào còn hard-code.

### 0.4. Chuẩn Ghi Nhận Lỗi

Mỗi lỗi nên ghi theo format:

```txt
[Priority] Module - Màn hình - Hành động
Data dùng test:
Kết quả mong đợi:
Kết quả thực tế:
Ảnh/log/API:
Có block P0 không:
```

### 0.5. Lộ Trình Test Chi Tiết Từng Luồng

Chạy theo đúng thứ tự dưới đây. Không nhảy sang luồng sau nếu điều kiện pass của luồng hiện tại chưa đạt.

#### Luồng 0 - Smoke Và Nền Tảng Kỹ Thuật

Mục tiêu: xác nhận app không trắng màn hình, auth/session ổn, menu điều hướng được.

1. [ ] Mở trang login.
2. [ ] Đăng nhập bằng Admin.
3. [ ] Reload dashboard sau login.
4. [ ] Đổi ngôn ngữ Vietnamese -> English -> Vietnamese.
5. [ ] Mở/thu sidebar, scroll hết menu.
6. [ ] Test global search với mã sản phẩm, buyer, PO, shipment nếu đã có data.
7. [ ] Mở từng nhóm menu chính trong sidebar, chỉ cần xác nhận page không trắng.
8. [ ] Mở dev console/network, ghi nhận API 500 hoặc lỗi hydration nếu có.

Pass khi: không trắng trang, không loop login, sidebar/search hoạt động, không có API 500 ở màn dashboard chính.

#### Luồng 1 - Dữ Liệu Nền Bắt Buộc

Mục tiêu: tạo dữ liệu đủ để chạy P2P và O2C end-to-end.

1. [ ] Tạo hoặc kiểm tra Currency: VND, USD, EUR.
2. [ ] Nhập tỷ giá USD/VND và EUR/VND.
3. [ ] Tạo Buyer nước ngoài A.
4. [ ] Tạo Buyer nước ngoài B để test portal không xem chéo.
5. [ ] Tạo Vendor trong nước.
6. [ ] Tạo Forwarder/Logistics Partner.
7. [ ] Tạo Product có đủ SKU, tên Việt/Anh, HS code, unit, packing, purchase price, export price, preferred vendor.
8. [ ] Mở Product Catalog và kiểm tra product vừa tạo hiển thị.
9. [ ] Mở Live Inventory kiểm tra product có stock ban đầu hoặc stock = 0 rõ ràng.
10. [ ] Tạo user theo role: Sales, Purchasing, Warehouse, Logistics, Accounting, Buyer Portal.
11. [ ] Đăng nhập thử ít nhất Admin + Sales + Warehouse + Accounting.

Pass khi: buyer/vendor/product/forwarder/user dùng được trong dropdown của các màn PR/PO/PI/Shipment.

#### Luồng 2 - Ma Trận Phê Duyệt Và Smart Approvals

Mục tiêu: đảm bảo các nghiệp vụ lớn không bị kẹt vì thiếu rule duyệt.

1. [ ] Mở Approval Matrix.
2. [ ] Tạo/check rule cho Purchase Request.
3. [ ] Tạo/check rule cho Purchase Order.
4. [ ] Tạo/check rule cho Sales Contract.
5. [ ] Tạo/check rule cho Inventory Adjustment.
6. [ ] Tạo/check rule cho AP Payment Batch.
7. [ ] Tạo/check rule cho AP Payment Reversal nếu có.
8. [ ] Với mỗi rule, kiểm tra amount range, currency, approver role, step order.
9. [ ] Mở Smart Approvals, xác nhận màn load được khi chưa có request.

Pass khi: các luồng PR/PO/Contract/AP/Adjustment có rule hoặc có behavior fallback được hiểu rõ và ghi chú.

#### Luồng 3 - P2P Happy Path: Mua Hàng -> Nhập Kho -> AP

Mục tiêu: kiểm tra procurement chuẩn không ngoại lệ.

1. [ ] Login Purchasing.
2. [ ] Tạo Purchase Request cho Product, quantity đủ lớn, gắn vendor đề xuất nếu có.
3. [ ] Submit PR.
4. [ ] Login approver hoặc Admin.
5. [ ] Duyệt PR trong Smart Approvals.
6. [ ] Login Purchasing.
7. [ ] Tạo Purchase Order từ PR đã duyệt.
8. [ ] Kiểm tra PO lấy đúng product, quantity, unit price, VAT, total.
9. [ ] Submit/send PO theo flow hiện tại.
10. [ ] Duyệt PO nếu có approval.
11. [ ] Login Warehouse.
12. [ ] Tạo Goods Receipt từ PO.
13. [ ] Nhập đủ quantity, rejected quantity = 0.
14. [ ] Save GRN.
15. [ ] Mở Live Inventory, kiểm tra current stock tăng đúng.
16. [ ] Mở Stock History, kiểm tra ledger nhập kho có reference GRN/PO.
17. [ ] Login Accounting.
18. [ ] Tạo Vendor Invoice từ PO/GRN.
19. [ ] Mở 3-Way Matching, kiểm tra PO + GRN + Vendor Invoice khớp.
20. [ ] Mở Công nợ NCC/AP, kiểm tra AP phát sinh đúng vendor, amount, due date.
21. [ ] Duyệt công nợ hoặc tạo AP Payment Batch.
22. [ ] Duyệt batch payment.
23. [ ] Mark batch paid.
24. [ ] Kiểm tra AP status chuyển Paid/Partial đúng.
25. [ ] Mở Accounting & Tax, kiểm tra journal cân debit/credit nếu có màn hiển thị.

Pass khi: stock tăng đúng, AP tạo đúng, payment batch paid được, không có API 500.

#### Luồng 4 - P2P Exception: Nhận Thiếu, Hàng Lỗi, Claim NCC

Mục tiêu: test ngoại lệ mua hàng và trang P2P/QC Exceptions.

1. [ ] Tạo PO mới quantity 100.
2. [ ] Tạo GRN nhận 80, rejected 0.
3. [ ] Mở P2P/QC Exceptions.
4. [ ] Kiểm tra candidate PO short receipt hiển thị backorder 20.
5. [ ] Tạo QC exception từ candidate nếu flow cho phép.
6. [ ] Gửi claim cho vendor.
7. [ ] Resolve claim bằng replacement hoặc credit note.
8. [ ] Kiểm tra Product backorder và Vendor claim/backorder giảm/đóng đúng.
9. [ ] Tạo PO/GRN khác: nhận 100, rejected 10.
10. [ ] Mở P2P/QC Exceptions, kiểm tra GRN rejected line hiển thị.
11. [ ] Tạo Purchase Return từ hàng lỗi nếu flow hỗ trợ.
12. [ ] Kiểm tra Vendor Scorecard cập nhật defect/claim count.
13. [ ] Tạo Vendor Invoice cho PO có reject.
14. [ ] Mở 3-Way Matching, kiểm tra AP chỉ ghi phần hàng hợp lệ hoặc cảnh báo mismatch rõ ràng.

Pass khi: exception candidate đúng nguồn, claim/resolve không crash, AP không ghi sai cho hàng lỗi.

#### Luồng 5 - O2C Happy Path: Inquiry -> Contract

Mục tiêu: test bán hàng xuất khẩu trước khi đụng kho/chứng từ.

1. [ ] Login Sales.
2. [ ] Tạo Market Inquiry cho Buyer A.
3. [ ] Chọn Product và quantity.
4. [ ] Chuyển Inquiry thành Sales Quotation.
5. [ ] Kiểm tra giá bán, currency, incoterm, expiry.
6. [ ] Tạo Pricing Policy cho product/buyer/incoterm nếu chưa có.
7. [ ] Tạo Proforma Invoice từ Quotation.
8. [ ] Gửi PI hoặc chuyển trạng thái PI theo flow hiện tại.
9. [ ] Buyer hoặc Sales accept PI.
10. [ ] Tạo Sales Contract từ PI.
11. [ ] Submit Sales Contract for approval.
12. [ ] Duyệt Sales Contract.
13. [ ] Gửi ký buyer nếu dùng e-sign.
14. [ ] Mở portal signing bằng token hoặc buyer portal.
15. [ ] Buyer ký/verify OTP nếu flow hỗ trợ.
16. [ ] Kiểm tra Contract status/signature status cập nhật.

Pass khi: Inquiry -> Quotation -> PI -> Contract không mất dòng hàng, tổng tiền và currency đúng.

#### Luồng 6 - Kho Xuất Khẩu: Reservation -> Export Delivery

Mục tiêu: kiểm tra giữ hàng, xuất kho và các lỗi lock đã fix.

1. [ ] Đảm bảo product trong contract có tồn kho khả dụng.
2. [ ] Trigger reservation khi contract approved/confirmed theo flow hiện tại.
3. [ ] Mở Live Inventory, kiểm tra reserved stock tăng.
4. [ ] Tạo Shipment từ Sales Contract.
5. [ ] Chọn forwarder, POL/POD, ETD/ETA.
6. [ ] Tạo container cho Shipment.
7. [ ] Mở Export Delivery.
8. [ ] Tạo phiếu xuất từ Shipment.
9. [ ] Kiểm tra line item lấy đúng product/quantity từ contract.
10. [ ] Issue Export Delivery.
11. [ ] Mở Live Inventory, kiểm tra current stock giảm và reserved stock giảm.
12. [ ] Mở Stock History, kiểm tra ledger xuất kho có reference Export Delivery.
13. [ ] Thử tạo Export Delivery lần 2 cho cùng Shipment.
14. [ ] Kiểm tra hệ thống chặn duplicate rõ ràng.

Pass khi: xuất kho không âm, không lỗi `FOR UPDATE`, shipment không tạo duplicate delivery active.

#### Luồng 7 - Logistics Và Bộ Chứng Từ Xuất Khẩu

Mục tiêu: shipment có đầy đủ timeline, container và chứng từ.

1. [ ] Login Logistics.
2. [ ] Mở Shipment vừa tạo.
3. [ ] Cập nhật booking number, shipping line, vessel, voyage.
4. [ ] Cập nhật container number, seal, package count nếu có.
5. [ ] Chuyển trạng thái shipment: booked -> loading -> customs cleared -> on board.
6. [ ] Mở Export Documents.
7. [ ] Generate Commercial Invoice/Packing List snapshot nếu có.
8. [ ] Upload B/L hoặc AWB.
9. [ ] Upload C/O, quality certificate nếu có.
10. [ ] Mark document reviewed/approved.
11. [ ] Share document lên Buyer Portal.
12. [ ] Kiểm tra document checklist của shipment.

Pass khi: chứng từ hiện đúng version/current, buyer chỉ tải được file đã share.

#### Luồng 8 - Commercial Invoice -> AR -> Thu Tiền

Mục tiêu: kiểm tra AR sinh đúng từ Commercial Invoice đã phát hành.

1. [ ] Mở Commercial Invoices.
2. [ ] Tạo draft CI từ Shipment.
3. [ ] Kiểm tra line item, buyer, contract, currency, exchange rate, due date.
4. [ ] Issue Commercial Invoice.
5. [ ] Mở Công Nợ Buyer/AR.
6. [ ] Kiểm tra AR mới sinh với invoice number đúng.
7. [ ] Kiểm tra AR Aging: chưa tới hạn nằm Current/Trong hạn.
8. [ ] Ghi nhận T/T Advance hoặc T/T Balance trong Finance.
9. [ ] Allocate payment vào AR.
10. [ ] Kiểm tra paid amount foreign/VND cập nhật.
11. [ ] Nếu thanh toán đủ, kiểm tra AR status Paid.
12. [ ] Kiểm tra DSO và dashboard doanh thu cập nhật.

Pass khi: CI issue tạo AR, payment allocation giảm AR đúng ngoại tệ/tỷ giá.

#### Luồng 9 - Trade Finance: L/C Và D/P, D/A

Mục tiêu: kiểm tra nghiệp vụ tài chính thương mại ngoài T/T.

1. [ ] Với contract khác, tạo Letter of Credit.
2. [ ] Nhập LC number, issuing bank, amount, expiry, latest shipment date.
3. [ ] Kiểm tra deadline/cảnh báo trong dashboard finance.
4. [ ] Chuyển trạng thái L/C qua các bước received -> checked -> documents presented -> accepted -> paid.
5. [ ] Ghi nhận discrepancy nếu có.
6. [ ] Resolve discrepancy.
7. [ ] Với contract khác, tạo Collection D/P hoặc D/A.
8. [ ] Cập nhật collection order, maturity date, bank status.
9. [ ] Ghi nhận collection paid hoặc overdue.
10. [ ] Kiểm tra AR liên quan được allocate hoặc cảnh báo đúng.

Pass khi: deadline đúng ngày, trạng thái trade finance phản ánh vào AR/payment.

#### Luồng 10 - Inventory Control: Adjustment, Count, Snapshot

Mục tiêu: kiểm tra các chức năng kho không thuộc nhập/xuất thường.

1. [ ] Mở Inventory Adjustment.
2. [ ] Tạo adjustment tăng/giảm stock có lý do.
3. [ ] Submit adjustment approval nếu amount cần duyệt.
4. [ ] Duyệt adjustment.
5. [ ] Kiểm tra stock và ledger thay đổi.
6. [ ] Tạo Inventory Count.
7. [ ] Nhập counted quantity khác system quantity.
8. [ ] Submit count.
9. [ ] Approve count.
10. [ ] Kiểm tra chênh lệch được hạch toán/ledger nếu flow hỗ trợ.
11. [ ] Tạo Inventory Period Snapshot.
12. [ ] Kiểm tra snapshot giữ nguyên số liệu tại thời điểm tạo.

Pass khi: adjustment/count không cho tồn âm, approval và ledger rõ ràng.

#### Luồng 11 - Customer Return

Mục tiêu: kiểm tra trả hàng buyer sau bán.

1. [ ] Tạo Customer Return từ Buyer/Shipment/Contract.
2. [ ] Chọn product và quantity trả.
3. [ ] Submit return.
4. [ ] Approve return.
5. [ ] Receive return về kho.
6. [ ] Kiểm tra Live Inventory tăng lại.
7. [ ] Kiểm tra Stock History có ledger RETURN.
8. [ ] Reject một return khác và kiểm tra không đổi tồn kho.

Pass khi: chỉ return approved mới được receive, tồn kho tăng đúng quantity.

#### Luồng 12 - Accounting, Reports, Dashboard

Mục tiêu: đối chiếu số liệu quản trị sau khi đã có đủ chứng từ.

1. [ ] Mở Operation Overview.
2. [ ] Kiểm tra doanh thu, gross margin nếu role được xem cost.
3. [ ] Mở Accounting & Tax.
4. [ ] Kiểm tra journal entries từ CI, AP payment, inventory.
5. [ ] Mở AR Aging, kiểm tra khớp AR page.
6. [ ] Mở AP Aging, kiểm tra khớp AP page.
7. [ ] Mở Stock History, kiểm tra movement theo product.
8. [ ] Export Excel/PDF nếu màn hỗ trợ.
9. [ ] Đổi date range và refresh.

Pass khi: số liệu dashboard không lệch rõ ràng với chứng từ nguồn.

#### Luồng 13 - Buyer Portal End-To-End

Mục tiêu: kiểm tra trải nghiệm và bảo mật dữ liệu phía buyer.

1. [ ] Login Buyer A.
2. [ ] Xem dashboard portal.
3. [ ] Tạo inquiry từ portal.
4. [ ] Admin Sales thấy inquiry.
5. [ ] Buyer A xem PI/Contract của mình.
6. [ ] Buyer A ký contract nếu có flow e-sign.
7. [ ] Buyer A xem shipment tracking.
8. [ ] Buyer A tải document đã share.
9. [ ] Buyer A xem statement/AR.
10. [ ] Buyer A upload T/T receipt.
11. [ ] Accounting xác nhận receipt.
12. [ ] Buyer A tạo support ticket.
13. [ ] Admin trả lời ticket.
14. [ ] Login Buyer B.
15. [ ] Thử mở URL/data của Buyer A.

Pass khi: Buyer B không xem được dữ liệu Buyer A, portal cập nhật trạng thái theo admin.

#### Luồng 14 - RBAC Và Negative Test

Mục tiêu: đảm bảo quyền không bị thủng.

1. [ ] Login Sales, thử mở AP payment và cost-sensitive screen.
2. [ ] Login Warehouse, thử mở AR/AP và giá vốn.
3. [ ] Login Purchasing, thử ghi nhận thanh toán buyer.
4. [ ] Login Accounting, thử chỉnh shipment/PO nếu role không được phép.
5. [ ] Login Buyer Portal, thử mở admin route.
6. [ ] Test API bằng URL trực tiếp nếu có thể.
7. [ ] Kiểm tra menu ẩn và API trả 403/redirect đúng.

Pass khi: quyền bị chặn ở cả UI và API, không chỉ ẩn menu.

#### Luồng 15 - I18n Và Nợ Kỹ Thuật Không Chặn P0

Mục tiêu: ghi nhận debt có hệ thống sau khi nghiệp vụ chính đã pass.

1. [ ] Chuyển sang English.
2. [ ] Đi từng menu sidebar.
3. [ ] Ghi lại màn còn hard-code tiếng Việt.
4. [ ] Chuyển sang Vietnamese.
5. [ ] Ghi lại màn còn hard-code English không phù hợp.
6. [ ] Chạy frontend lint và ghi số warning.
7. [ ] Chạy backend lint và ghi nhóm lỗi chính.
8. [ ] Không sửa lẫn vào bug P0 nếu không gây crash/runtime.

Pass khi: có danh sách debt rõ module, file, màn hình, priority.

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
