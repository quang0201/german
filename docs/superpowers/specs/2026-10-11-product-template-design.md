# Sản phẩm (Product) làm khuôn mẫu công đoạn, và báo cáo nhiều mã SX

Ngày: 2026-10-11. Trạng thái: chờ duyệt.

## 1. Mục tiêu

- Xem **nhiều mã sản xuất cùng lúc** trên trang Báo cáo (ví dụ `4004 xanh`, `4004 đen`, `TÚI 4004 đỏ`), cộng gộp sản lượng theo **số công đoạn (CĐ)**.
- Có khái niệm **Sản phẩm** (ví dụ `4004`): mã SX thuộc một sản phẩm, sản phẩm có danh sách CĐ mẫu.
- Không làm hỏng dữ liệu cũ: mã SX giữ tên sản phẩm dạng chữ và bản CĐ riêng trong giai đoạn chuyển tiếp ("lưu cả hai"); phần lưu trùng sẽ bỏ ở đợt sau.

## 2. Quyết định đã chốt với người dùng

| Quyết định | Chọn |
|---|---|
| Công đoạn thuộc về đâu | Sản phẩm là **khuôn mẫu**: tạo mã SX thì sao chép CĐ mẫu sang, mã SX giữ bản riêng, sửa riêng được |
| Dữ liệu cũ | Tự gom khi **cùng số gốc và cùng danh sách CĐ**; mã khác thì để trống, gán tay |
| Chuyển tiếp | Lưu cả hai: giữ `ProductName` và CĐ riêng của mã SX; thêm liên kết `ProductId` |
| Cách xem nhiều mã | **Cộng gộp theo số CĐ**, mở chi tiết thấy từng mã |
| Xuất Excel nhiều mã | Chưa làm; tắt nút khi chọn nhiều mã |

## 3. Mô hình dữ liệu

Thêm mới, không xóa hay đổi nghĩa cột nào đang có:

- `Products`: `Id`, `Code` (không trùng, không phân biệt hoa thường), `Name`, `IsActive`, `CreatedAt`, `UpdatedAt`.
- `ProductOperationTemplates`: `Id`, `ProductId`, `OperationNumber`, `Name`, `Unit`, `FixedPrice?`, `SortOrder`, `IsActive`. Duy nhất theo (`ProductId`, `OperationNumber`).
- `ProductionOrders.ProductId` (nullable, khóa ngoại tới `Products`, xóa sản phẩm không xóa mã SX).

Giữ nguyên: `ProductionOrders.ProductName`, bảng `ProductionOperations` của từng mã SX, `ProductionEntries` (trỏ vào CĐ của mã SX).

## 4. Chuyển dữ liệu cũ (backfill)

- Chế độ chạy mới của ứng dụng, cùng kiểu `migrations` và `seed`: `backfill-products`. Mặc định **chỉ xem trước** (dry-run), thêm `--apply` mới ghi.
- Quy tắc gom: số gốc của mã SX (cụm số đứng riêng đầu tiên từ 3 chữ số trở lên; mã không có thì đứng riêng) **và** cùng "chữ ký CĐ" = tập (`OperationNumber`, `Name`, `Unit`). Đơn giá không dùng để gom.
- Mỗi nhóm có từ 2 mã trở lên tạo một sản phẩm: `Code` = số gốc, `Name` = tên chung ngắn nhất của các mã, CĐ mẫu lấy theo mã đầu tiên theo thứ tự mã.
- Mã khác chữ ký, hoặc một mình một số gốc, để trống `ProductId`.
- Xem trước in: sản phẩm sẽ tạo, mã vào từng sản phẩm, mã bị bỏ sót và lý do, các CĐ có đơn giá khác nhau giữa các mã.
- Chạy lại không tạo trùng (nhận biết theo `Code` sản phẩm đã có và mã đã gắn).

## 5. API (chỉ Manager và Admin)

- `GET /api/products`, `GET /api/products/{id}`: danh sách và chi tiết kèm CĐ mẫu và số mã SX đang gắn.
- `POST /api/products`, `PUT /api/products/{id}` (kèm danh sách CĐ mẫu), `DELETE /api/products/{id}` = tắt (`IsActive=false`).
- Mã SX: tạo và sửa nhận thêm `productId?`. Tạo mới có `productId` và không gửi danh sách CĐ thì sao chép CĐ mẫu. Gán `productId` cho mã đã có chỉ tạo liên kết, không đổi CĐ. Dữ liệu trả về thêm `productId`, `productCode`.
- Lỗi: mã sản phẩm trùng (409), CĐ trùng số trong cùng sản phẩm (400), sản phẩm không tồn tại (404).

## 6. Giao diện

- Trang **Sản phẩm** (menu Danh mục): danh sách có tìm kiếm và bộ đếm; hộp thoại thêm/sửa gồm mã, tên, bảng CĐ mẫu; xóa là tắt.
- Hộp thoại **tạo mã SX**: thêm ô Sản phẩm (không bắt buộc); chọn thì điền tên và sao chép CĐ mẫu, vẫn sửa được trước khi lưu. Nút Clone hiện có giữ nguyên.
- Trang **chi tiết mã SX**: hiện sản phẩm; mã chưa gắn có nút Gán sản phẩm; nếu CĐ khác khuôn mẫu thì cảnh báo thông tin, không chặn.
- Sửa CĐ mẫu **không** thay đổi các mã SX đã tạo.

## 7. Báo cáo nhiều mã

- Ô Mã SX chọn nhiều, gom theo sản phẩm (nhóm "4004 · Túi 4004 (3 mã)"); mã chưa gắn nằm nhóm "Chưa gắn sản phẩm". URL `?order=id1,id2`, link cũ `?order=id` vẫn dùng.
- Gộp ở frontend bằng hàm thuần túy từ API tổng hợp hiện có, tối đa 8 mã, gọi song song. Mỗi dòng một số CĐ (hợp của các số CĐ), cộng HC, TC, Bên ngoài, Tổng; mở chi tiết thấy từng mã. Kế hoạch cộng dồn; "Vượt kế hoạch" tính theo tổng.
- Tên CĐ: nếu cùng sản phẩm lấy theo khuôn mẫu, nếu khác thì tên của mã đầu tiên kèm "(+ tên khác)".
- Xuất Excel: tắt khi chọn nhiều mã (gợi ý chọn một mã).
- API tổng hợp hiện có không đổi.

## 8. Kiểm tra

- Backend: gom sản phẩm (đúng nhóm, khác chữ ký thì bỏ sót, đơn giá khác chỉ cảnh báo), dry-run không ghi, chạy lại không trùng, tạo mã sao chép đúng CĐ, gán không đổi CĐ, phân quyền, mã trùng.
- Frontend: hàm gộp theo số CĐ (hợp số CĐ, tổng, mã thiếu CĐ, tên khác, kế hoạch), bộ chọn nhiều mã theo nhóm, đọc và ghi URL.
- Chạy thật trên Docker local với dữ liệu mẫu 4004 (xanh, đen cùng CĐ1/2/5 sẽ gom; đỏ CĐ8/9 không gom) và kiểm tra báo cáo.

## 9. Thứ tự thực hiện (mỗi bước đưa lên được riêng)

1. Bảng, migration và API sản phẩm.
2. Trang Sản phẩm.
3. Hộp thoại tạo mã SX và trang chi tiết mã.
4. Lệnh `backfill-products`.
5. Báo cáo xem nhiều mã.

## 10. Ngoài phạm vi

Excel nhiều mã; áp dụng khuôn mẫu mới cho mã SX đã tạo; gỡ phần lưu trùng (`ProductName`, CĐ riêng); công cụ MCP cho sản phẩm.

## 11. Rủi ro

- Dữ liệu thật có thể có nhiều biến thể mã hơn mẫu thử: bước xem trước là chốt chặn, không tự ghi.
- Mã SX có hai nhóm số gốc trong tên (ví dụ `4004 ... 3000`): lấy cụm số đầu tiên; xem trước giúp phát hiện.
- Hai bản lưu song song có thể lệch nhau: chấp nhận trong giai đoạn chuyển tiếp, cảnh báo khác khuôn mẫu ở trang chi tiết.
