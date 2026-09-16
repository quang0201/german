# German HR MCP

MCP local này kết nối tới API của German HR qua stdio. MCP không truy cập trực tiếp PostgreSQL; mọi thao tác đều đi qua API hiện tại nên vẫn dùng RBAC của `Manager/Admin`.

## Khởi tạo

Chạy từ thư mục gốc repository:

```powershell
cd tools/german-mcp
bun install
```

Thiết lập thông tin xác thực trong process chạy MCP. Dùng một trong hai cách:

```powershell
$env:GERMAN_API_BASE_URL = "https://hr.quangt.com"
$env:GERMAN_API_USERNAME = "<manager-user>"
$env:GERMAN_API_PASSWORD = "<password>"
```

Hoặc dùng token MCP do Manager/Admin tạo trên thanh tài khoản:

```powershell
$env:GERMAN_API_MCP_TOKEN = "<mcp-token>"
```

Token được dùng lại qua nhiều lần khởi động MCP. Khi tạo token mới, token cũ bị thu hồi. Sau khi MCP đổi token thành công, backend cấp session cookie trong bộ nhớ cho MCP.

Hoặc dùng session cookie ngắn hạn:

```powershell
$env:GERMAN_API_SESSION_COOKIE = "german.auth=<cookie-value>"
```

Trong ứng dụng web, Manager/Admin có thể bấm **Tạo token MCP** trên thanh tài khoản, sau đó dán token vào biến `GERMAN_API_MCP_TOKEN`. Không lưu token vào Git, log hoặc chia sẻ cho người khác.

Không lưu các giá trị trên vào Git, log hoặc file cấu hình commit vào repository.

## Đăng ký MCP client

Ví dụ cấu hình client:

```json
{
  "mcpServers": {
    "german_hr": {
      "command": "bun",
      "args": ["run", "tools/german-mcp/src/server.ts"],
      "cwd": "D:/Code/german"
    }
  }
}
```

Các tool chính:

- `german_find_employees`: tìm nhân viên theo mã hoặc họ tên.
- `german_find_production_orders`: tìm mã sản xuất.
- `german_get_attendance_hours`: lấy giờ HC, giờ TC và ca chấm công của một ngày.
- `german_list_production_entries`: tra cứu sản lượng nội bộ theo bộ lọc.
- `german_preview_production_batch`: preview nhiều công đoạn sản lượng nội bộ trước khi ghi.
- `german_create_production_batch`: ghi nhiều công đoạn sản lượng nội bộ trong một ngày.
- `german_preview_production_update`: preview sửa một entry theo `entryId` và `version`.
- `german_update_production_entry`: sửa một entry sản lượng nội bộ.
- `german_delete_production_entry`: xóa mềm một entry sản lượng nội bộ.
- `german_list_external_sources`: xem nguồn gia công đang dùng hoặc toàn bộ.
- `german_list_external_quantities`: kiểm tra dữ liệu gia công ngoài theo mã và ngày.
- `german_preview_external_quantity`: kiểm tra mã, công đoạn, nguồn và số lượng trước khi ghi.
- `german_create_external_quantity`: ghi dữ liệu; bắt buộc truyền `confirm: true`.

Quy trình ghi khuyến nghị là gọi `preview` trước, kiểm tra kết quả, sau đó mới gọi `create` với đúng dữ liệu đã xác nhận. MCP không cho ghi khi thiếu `confirm: true`, không cho dùng nguồn đã tắt, và không tự suy đoán mã/công đoạn nếu không tìm thấy khớp duy nhất.

### Nhập sản lượng nội bộ

Tool `german_create_production_batch` nhận mã nhân viên hoặc họ tên chính xác, mã sản xuất và danh sách công đoạn. Mỗi công đoạn có thể dùng một trong hai cách:

```json
{
  "workDate": "2026-09-11",
  "employeeCode": "0417-BHD",
  "orderCode": "4004 đen",
  "items": [
    { "operationNumber": 1, "totalQuantity": 2500 },
    { "operationNumber": 2, "totalQuantity": 2500 }
  ],
  "confirm": true
}
```

`totalQuantity` được MCP tự chia thành HC/TC theo giờ chấm công thực tế của ngày đó. Nếu cần nhập số đã tách sẵn, dùng `directHcQuantity` và/hoặc `directTcQuantity`. Tool tự lấy chấm công để gửi cùng batch; ngày chưa có giờ chấm công sẽ bị từ chối khi yêu cầu chia theo tổng giờ.

Nên gọi `german_preview_production_batch` với cùng dữ liệu nhưng không cần `confirm`, kiểm tra `request`, rồi mới gọi `german_create_production_batch` với `confirm: true`. API tiếp tục kiểm tra quyền Manager/Admin, mã, công đoạn, xung đột ô và ghi audit log nghiệp vụ.

## Audit log

Mỗi lần gọi tool được ghi dạng JSONL vào `.mcp-logs/audit-YYYY-MM-DD.jsonl` hoặc thư mục từ `GERMAN_MCP_LOG_DIR`. Log gồm thời gian, tên tool, tham số nghiệp vụ đã lọc, trạng thái, lỗi và thời gian xử lý.

Password, token, cookie, credential và `Authorization` luôn được redaction thành `[REDACTED]`; response API không được ghi nguyên văn vào log.
