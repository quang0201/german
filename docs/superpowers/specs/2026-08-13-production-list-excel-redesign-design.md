# Production List UX + Excel Export Redesign — Technical Design

Ngày chốt: 13/08/2026

Nguồn yêu cầu: tài liệu `Production List UX + Excel Export Redesign` do người dùng cung cấp ngày 12/08/2026. Tài liệu đó là product/design contract; tài liệu này khóa cách tích hợp vào codebase hiện tại.

## 1. Mục tiêu và phạm vi

- `/production` mặc định mở ở `Hôm nay`, có preset Hôm nay, Hôm qua, Tuần này, Tháng này và Tùy chọn.
- Period selector điều hướng ngày/tuần/tháng mà không cần nhập range thủ công.
- Summary phản ánh toàn bộ filtered result, không chỉ page hiện tại.
- Multi-day list group theo ngày; single-day list không có group header dư thừa.
- Excel dùng đúng kỳ và mọi filter hiện tại, gồm `search`, với hai sheet `Tổng quan` và `Chi tiết`.
- Worker được dùng period selector và xem summary cá nhân; Worker không có export hoặc filter quản trị.
- Không thay đổi quyền create/edit/delete, quyền export Manager/Admin, soft-delete semantics hoặc HC/TC calculation.
- Không thêm dependency mới.

## 2. Phương án kỹ thuật

### Chọn: summary trong existing list response

`GET /api/production-entries` và `/mine` trả `items`, pagination và `summary` trong cùng response. Application tạo một filtered query duy nhất, tính aggregate trước pagination, rồi dùng query đó để lấy page.

Ưu điểm:

- list và summary không thể lệch filter;
- không thêm network request;
- không duplicate validation/date/search semantics;
- phù hợp recommendation trong product spec.

### Không chọn: endpoint `/summary` riêng

Endpoint riêng đơn giản hóa response list nhưng lặp contract/filter và tạo hai request có thể lệch thời điểm dữ liệu.

### Không chọn: frontend cộng dữ liệu

Frontend chỉ có một page nên không thể tính aggregate đúng trên toàn bộ result. Fetch toàn bộ rows cũng phá pagination và không phù hợp dữ liệu lớn.

## 3. Backend list contract

Thêm DTO summary:

```text
employeeCount
entryCount
hcQuantity
tcQuantity
totalQuantity
```

Paged response production entry được mở rộng bằng `summary`. Query pipeline giữ nguyên:

- range tối đa list 31 ngày;
- filter employee/order/operation/search;
- query filters loại soft-deleted rows;
- page size 25/50/100;
- Worker bị khóa `EmployeeId` theo actor.

Aggregate được tính trên filtered query trước `Skip/Take`. `employeeCount` là distinct employee ID; các quantity dùng database aggregate và trả 0 khi không có row.

## 4. Frontend state và date helpers

State canonical:

```text
periodMode: day | week | month | custom
anchorDate: YYYY-MM-DD
customFromDate/customUntilDate
employeeId/orderId/operationId/search
page/pageSize
```

`Hôm qua` là shortcut của mode `day` với anchor = local yesterday. Derived range:

- day: anchor → anchor;
- week: Monday → Sunday;
- month: first → last day;
- custom: customFromDate → customUntilDate.

Date helper nội bộ dùng local calendar arithmetic, không dùng UTC string arithmetic cho navigation và không thêm date library. Mọi thay đổi period/filter reset page về 1.

Component boundaries:

- `period.js`: pure date/range/label helpers;
- `PeriodSelector.jsx`: render buttons, custom inputs và previous/next controls;
- `ProductionSummary.jsx`: presentation-only summary;
- `ProductionEntryListPage.jsx`: query state, lookup data, load/export/pagination;
- `productionEntryQuery.js`: serialize list và export query, normalize response;
- grouped-table helper/component: group page rows theo `workDate` chỉ khi derived range có nhiều ngày.

Accessibility:

- preset dùng `<button>` và `aria-pressed`;
- previous/next có aria-label theo current mode;
- UI date dùng `dd/MM/yyyy`, API giữ ISO;
- table vẫn semantic và horizontal-scroll có chủ đích.

## 5. Export contract và Application report

Export endpoint nhận:

```text
fromDate, untilDate, employeeId, orderId, operationId, search
```

Frontend dùng chính applied filters, không dùng draft chưa submit. Export range giữ tối đa 366 ngày độc lập với list max 31 ngày.

`ProductionReportData` được mở rộng để chứa:

- metadata kỳ và filter labels;
- summary toàn kỳ;
- rows chi tiết;
- aggregate theo ngày;
- aggregate theo nhân viên;
- tên metric cuối dựa trên việc có đúng một `operationId`.

Report query áp dụng cùng search fields/entry-mode matching như list. Logic search dùng một Application helper chung hoặc biểu thức dùng chung để tránh semantics bị lệch.

## 6. Workbook

### Sheet `Tổng quan`

- title `BÁO CÁO SẢN LƯỢNG`;
- kỳ báo cáo và labels filter;
- metrics Nhân viên, Bản ghi, HC, TC và metric cuối;
- bảng tổng hợp theo ngày;
- bảng tổng hợp theo nhân viên;
- hàng tổng numeric.

Metric cuối là `Tổng lượt công đoạn` khi không lọc operation; là `Tổng sản lượng` khi có một `operationId`.

### Sheet `Chi tiết`

- cột Ngày, Mã NV, Họ tên, Mã SX, Sản phẩm, Công đoạn, Đơn vị, HC, TC, Tổng, Giờ TC, Kiểu nhập, Ghi chú;
- freeze header;
- AutoFilter toàn data range;
- ngày `dd/MM/yyyy`;
- quantities là numeric và căn phải;
- width hợp lý;
- không merge cell trong vùng data.

## 7. Responsive layout

- >=1280: period một hàng, summary 5 cột, filter một hàng nếu đủ chỗ.
- 1024–1279: sidebar collapsed mặc định nhưng mở được, summary 3+2 hoặc 5 cột, filter wrap.
- 768–1023: drawer, period wrap, summary 2–3 cột, filter 2 cột.
- <640: period segmented wrap/scroll, navigation riêng một hàng, summary 2 cột; table giữ priority columns và horizontal scroll.

Không biến rows thành cards và không thêm surface/shadow trái ERP design contract đã merge ở PR #4.

## 8. Error handling

- Invalid custom range hiển thị inline/Alert và không gọi list/export.
- List range >31 ngày trả validation hiện hữu; preset tháng 31 ngày phải hợp lệ.
- Export range >366 ngày trả validation hiện hữu.
- Lookup/list/export failures dùng Alert/Toast hiện tại, không dùng browser dialog.
- Empty result trả summary zeros và workbook hợp lệ với hai sheet.

## 9. Testing và acceptance evidence

Frontend tests:

- local date arithmetic, Monday–Sunday week, month boundaries/leap year, previous/next;
- period labels, aria state/names, custom-only inputs;
- list/export query serialization including all filters;
- summary normalization/labels;
- grouping single-day vs multi-day;
- responsive CSS contracts.

Backend/Application tests:

- summary is computed before pagination and follows every filter/search;
- Worker summary is scoped to own employee;
- 31-day list boundary and 366-day export boundary;
- report aggregates/metadata/search.

Infrastructure/API tests:

- workbook has `Tổng quan` and `Chi tiết`;
- freeze pane, AutoFilter, date/numeric formats and valid empty export;
- endpoint authorization and full filter forwarding.

Final verification:

- Bun full test/build;
- .NET solution build and all test projects;
- Docker production build and health;
- authenticated browser QA at desktop, compact desktop, tablet and mobile;
- direct-load and SPA navigation regression;
- subagent implementation receives spec review and main-agent code review before commit/push/PR.

## 10. Out of scope

- Domain `ProductionCalculator` or HC/TC formulas;
- authorization policy changes;
- new charting/calendar/date dependencies;
- dashboard/card redesign;
- changing existing max export range;
- merging the resulting pull request.
