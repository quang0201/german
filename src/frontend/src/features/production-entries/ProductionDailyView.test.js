import React from "react";
import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ProductionDailyView } from "./ProductionDailyView.jsx";

test("daily output keeps full order/operation identity and units, without claiming attendance before it loads", () => {
  const html = renderToStaticMarkup(<ProductionDailyView date="2026-10-22" data={{ orders: [{ orderId: "o", orderCode: "4004 màu gre - T10", productName: "Túi màu xám tháng 10/2026", employees: [{ employeeId: "e", employeeName: "Trang", employeeCode: "BTT", operations: [{ operationId: "p", operationNumber: 11, operationName: "May dài khóa với thân sau", unit: "cái", cells: [{ workDate: "2026-10-22", entryCount: 1, hcQuantity: 114, tcQuantity: 43 }] }] }] }] }} />);
  for (const text of ["4004 màu gre - T10", "May dài khóa với thân sau", "157", "114", "43", "cái", "Chưa đối chiếu công"]) expect(html).toContain(text);
  expect(html).not.toContain('is-success');
  expect(html).toContain('aria-label="Sửa Trang 4004 màu gre - T10 CĐ11"');
});
test("daily data failure is an alert, never an empty success state", () => {
  const html = renderToStaticMarkup(<ProductionDailyView date="2026-10-22" data={{}} error="Không tải được" />);
  expect(html).toContain('role="alert"');
  expect(html).not.toContain("đủ SL/công");
});
