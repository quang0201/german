# MCP nội bộ

Backend cung cấp MCP Streamable HTTP tại:

```text
https://hr.quangt.com/mcp
```

## Cấp token

Đăng nhập tài khoản Manager/Admin rồi gọi `POST /api/auth/mcp-token`. Token chỉ trả về một lần; hệ thống chỉ lưu hash của token. Không đưa token vào log, source code hoặc chat công khai.

Gửi token cho MCP client bằng header:

```http
Authorization: Bearer <MCP_TOKEN>
```

## Tool chính

- `find_employees`
- `list_production_orders`
- `list_production_operations`
- `get_production_summary`
- `list_external_quantities`
- `preview_production_entry`
- `create_production_entry`
- `create_external_quantity`

Các tool ghi dữ liệu chỉ chạy với tài khoản Manager/Admin, bắt buộc `confirm=true` và `requestId`. Luồng an toàn là gọi `preview_production_entry`, kiểm tra HC/TC/tổng, rồi mới gọi tool ghi dữ liệu.

MCP dùng transport Streamable HTTP stateless; mỗi request phải gửi lại Bearer token. Các thao tác ghi sản lượng được ghi audit trong database và log ứng dụng chỉ ghi mã tool, người thực hiện, mã request và tham chiếu dữ liệu, không ghi token.
