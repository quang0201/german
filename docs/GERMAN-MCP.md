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

Hoặc dùng session cookie ngắn hạn:

```powershell
$env:GERMAN_API_SESSION_COOKIE = "german.auth=<cookie-value>"
```

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

- `german_find_production_orders`: tìm mã sản xuất.
- `german_list_external_sources`: xem nguồn gia công đang dùng hoặc toàn bộ.
- `german_list_external_quantities`: kiểm tra dữ liệu gia công ngoài theo mã và ngày.
- `german_preview_external_quantity`: kiểm tra mã, công đoạn, nguồn và số lượng trước khi ghi.
- `german_create_external_quantity`: ghi dữ liệu; bắt buộc truyền `confirm: true`.

Quy trình ghi khuyến nghị là gọi `preview` trước, kiểm tra kết quả, sau đó mới gọi `create` với đúng dữ liệu đã xác nhận. MCP không cho ghi khi thiếu `confirm: true`, không cho dùng nguồn đã tắt, và không tự suy đoán mã/công đoạn nếu không tìm thấy khớp duy nhất.

## Audit log

Mỗi lần gọi tool được ghi dạng JSONL vào `.mcp-logs/audit-YYYY-MM-DD.jsonl` hoặc thư mục từ `GERMAN_MCP_LOG_DIR`. Log gồm thời gian, tên tool, tham số nghiệp vụ đã lọc, trạng thái, lỗi và thời gian xử lý.

Password, token, cookie, credential và `Authorization` luôn được redaction thành `[REDACTED]`; response API không được ghi nguyên văn vào log.
