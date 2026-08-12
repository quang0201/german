# Architecture Contract

Tài liệu này là ràng buộc kiến trúc của dự án. Thay đổi kiến trúc phải được thực hiện có chủ đích, cập nhật tài liệu và architecture tests trong cùng một thay đổi; không phá ranh giới lớp chỉ để triển khai nhanh một tính năng.

## 1. Luồng phụ thuộc backend

```text
German.Domain
    ↑
German.Application
    ↑              ↑
German.Infrastructure   German.Api
          ↑             ↑
          └──── composition root ────┘
```

Quy tắc project reference hiện tại:

- `German.Domain`: không reference project nào khác. Chứa entity, enum và business calculation thuần.
- `German.Application`: chỉ reference `German.Domain`. Chứa use case, authorization rule, validation, query/application service và `IGermanDbContext`.
- `German.Infrastructure`: reference `German.Application` + `German.Domain`. Chứa EF Core/PostgreSQL, hashing, bootstrap và implementation kỹ thuật.
- `German.Api`: reference `German.Application` + `German.Infrastructure`. Chỉ là HTTP/auth/composition root/static host.

`German.Application` hiện sử dụng EF Core abstractions thông qua `IGermanDbContext`. Đây là quyết định kiến trúc hiện tại. Không được để Application reference ngược `German.Infrastructure` hoặc `German.Api`.

### Endpoint rule

File trong `German.Api/Endpoints` phải mỏng:

1. đọc route/query/body/claims;
2. chuyển sang command/query của Application;
3. gọi Application service;
4. map kết quả sang HTTP response.

Endpoint không được dùng `IGermanDbContext`, `DbContext` hoặc LINQ/EF Core để truy vấn persistence trực tiếp. Ngoại lệ duy nhất cho truy cập infrastructure trong API là composition/startup code như `Program.cs` để đăng ký dependency và thực thi process lifecycle đã định nghĩa.

### Process start modes

`German.Api` có ba process mode tách biệt:

```text
migrations  -> chỉ Database.MigrateAsync() rồi exit
seed        -> chỉ chạy bootstrap seed rồi exit
app         -> chỉ chạy ASP.NET Core/Minimal API + React static host
```

Các ràng buộc bắt buộc:

- `app` không tự chạy migration và không tự seed.
- `migrations` không seed và không start HTTP server.
- `seed` không migrate và không start HTTP server; schema phải tồn tại trước.
- Docker image mặc định chạy `app`.
- Deployment dùng cùng một image theo thứ tự `migrations` -> `seed` khi cần -> `app`.
- Parsing/start-mode orchestration nằm ở `German.Api` vì đây là process/composition concern; business logic không được chuyển vào startup layer.

## 2. Persistence

- Entity mapping và migration nằm trong `German.Infrastructure/Persistence`.
- PostgreSQL là source of truth cho production.
- Foreign key quan trọng phải tồn tại ở database, không chỉ kiểm tra ở application code.
- `ProductionEntry` dùng soft delete; query mặc định không trả bản ghi đã xóa.
- Sửa/xóa sản lượng của Manager/Admin phải ghi audit log.
- Không đặt raw SQL hoặc persistence logic trong endpoint/frontend.
- Migration phải được tạo và commit cùng feature thay đổi schema; không sửa production schema thủ công rồi mới đồng bộ code sau.

## 3. Business calculation

`German.Domain.Production.ProductionCalculator` là source of truth. Frontend chỉ tính preview và phải mirror bằng test; backend luôn tính lại trước khi lưu.

### ByShift

`total = ca1 + ca2`.

- Không tăng ca: `HC = total`, `TC = 0`.
- Có số lượng TC thực tế: `TC = actualTc`, `HC = total - TC`; `TC` không được lớn hơn `total`.
- Chỉ có giờ TC: `HC = round(total * hcHours / (hcHours + overtimeHours))`; `TC = total - HC`.

### Direct

`HC` và `TC` lấy trực tiếp từ dữ liệu nhập; `total = HC + TC`.

### TotalWithOvertime

- Không tăng ca: toàn bộ là HC.
- Có giờ TC: dùng cùng công thức phân bổ theo `hcHours / (hcHours + overtimeHours)`.

`hcHours` phải lấy từ bộ ca có hiệu lực của nhân viên theo ngày, không hard-code 8 hoặc 9 giờ.

## 4. Frontend boundaries

```text
src/app          composition/session shell
src/features/*   UI + logic theo feature
src/lib          shared technical utilities (API/time/...)
```

- `src/lib` không phụ thuộc vào feature.
- Logic thuộc production entry phải nằm trong `features/production-entries`, không đặt trong `features/manager` rồi import ngược trở lại.
- `ManagerApp` được phép compose các feature màn hình, nhưng feature con không được phụ thuộc vào internals của `manager`.
- HTTP đi qua `src/lib/api.js`; không rải wrapper fetch khác nhau trong từng feature nếu không có lý do kiến trúc rõ ràng.
- Preview calculation phải có test tương ứng với calculator backend.

## 5. Branch flow

```text
main  <- release/stable
  ↑
dev   <- integration branch
  ↑
feat/*, fix/*, review/*
```

- Tính năng mới bắt đầu từ `dev`.
- Review/fix trước khi tích hợp vào `dev`.
- `main` chỉ nhận thay đổi đã qua `dev` và CI.
- Không phát triển trực tiếp trên `main`.
- CI chạy trên `main`, `dev`, `feat/**`, `review/**` và PR vào `main`/`dev`.

## 6. Architecture guardrails

`src/frontend/src/architecture.test.js` được chạy bởi `bun test` trong CI và kiểm tra tối thiểu:

- project reference backend không đi ngược tầng;
- endpoint không query EF/DbContext trực tiếp;
- OpenXML không rò khỏi Infrastructure;
- process lifecycle giữ tách biệt `migrations` / `seed` / `app`;
- production-entry feature không phụ thuộc ngược vào manager internals.

Khi thêm một layer/module mới, cập nhật guardrails thay vì bỏ hoặc nới test để đi vòng kiến trúc.

## 7. Review checklist cho mọi feature

Trước khi merge vào `dev`:

- business rule mới có test ở layer sở hữu rule;
- frontend preview không tự trở thành source of truth;
- authorization được kiểm tra ở backend, không chỉ ẩn nút ở UI;
- endpoint chỉ map HTTP → Application;
- persistence mapping/FK/migration phù hợp;
- không có dependency ngược giữa layers/features;
- process start mode không trộn migration/seed vào app runtime;
- build + backend tests + frontend tests + architecture tests xanh;
- nếu thay đổi architecture contract, phải nêu rõ lý do trong review và cập nhật tài liệu này.
