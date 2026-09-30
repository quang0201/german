import React from "react";
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { firstActiveEmployeeId, initialBatchEmployeeId, initialBatchInputMode, initialBatchOrderId, ProductionMatrixBatchEntryDialog } from "./ProductionMatrixBatchEntryDialog.jsx";
import { buildBatchAttendanceMonthUrl, classifyBatchAttendanceDay, isCurrentBatchOperationsRequest, isCurrentBatchOrdersRequest, isEmployeeAvailableOnDate } from "./productionMatrixBatch.js";

describe("ProductionMatrixBatchEntryDialog helpers", () => {
  test("defaults to the first active employee instead of an inactive first row", () => {
    expect(firstActiveEmployeeId([
      { id: "inactive-1", isActive: false },
      { id: "active-1", isActive: true },
      { id: "active-2", isActive: true },
    ])).toBe("active-1");
    expect(firstActiveEmployeeId([{ id: "active-default" }])).toBe("active-default");
    expect(firstActiveEmployeeId([{ id: "inactive-only", isActive: false }])).toBe("");
  });

  test("keeps the applied employee filter when opening a day batch entry", () => {
    const employees = [
      { id: "employee-1", isActive: true },
      { id: "employee-2", isActive: true },
    ];

    expect(initialBatchEmployeeId(employees, "employee-2")).toBe("employee-2");
    expect(initialBatchEmployeeId(employees, "missing")).toBe("employee-1");
    expect(initialBatchEmployeeId([{ id: "employee-2", isActive: false }], "employee-2")).toBe("");
  });

  test("keeps a selected inactive employee when that employee was active on the batch date", () => {
    const employees = [
      { id: "employee-1", isActive: true },
      { id: "employee-2", isActive: false, deactivatedAt: "2026-09-28" },
    ];

    expect(initialBatchEmployeeId(employees, "employee-2", "2026-09-24")).toBe("employee-2");
    expect(initialBatchEmployeeId(employees, "employee-2", "2026-09-28")).toBe("employee-1");
  });

  test("shows inactive employees in the batch picker only before their deactivation date", () => {
    const employee = { id: "employee-2", employeeCode: "E002", fullName: "Nguyễn Thị Thanh", isActive: false, deactivatedAt: "2026-09-28" };
    const renderPicker = (isoDate) => renderToStaticMarkup(
      <ProductionMatrixBatchEntryDialog day={{ isoDate, weekdayLabel: "T5", displayDate: isoDate }} employees={[employee]} />,
    );

    expect(renderPicker("2026-09-24")).toContain("Nguyễn Thị Thanh");
    expect(renderPicker("2026-09-28")).not.toContain("Nguyễn Thị Thanh");
  });

  test("offers employees who were still employed on the selected historical date", () => {
    const employee = { id: "inactive-1", isActive: false, deactivatedAt: "2026-09-28" };

    expect(isEmployeeAvailableOnDate(employee, "2026-09-24")).toBe(true);
    expect(isEmployeeAvailableOnDate(employee, "2026-09-28")).toBe(false);
    expect(isEmployeeAvailableOnDate(employee, "2026-09-29")).toBe(false);
    expect(isEmployeeAvailableOnDate({ id: "unknown-inactive", isActive: false }, "2026-09-24")).toBe(false);
    expect(isEmployeeAvailableOnDate({ id: "active", isActive: true }, "2026-09-24")).toBe(true);
  });

  test("opens hourly employees in attendance mode automatically", () => {
    expect(initialBatchInputMode({ compensationType: "Hourly" })).toBe("attendance-only");
    expect(initialBatchInputMode({ compensationType: "PieceRate" })).toBe("attendance-shifts");
    expect(initialBatchInputMode({})).toBe("attendance-shifts");
  });

  test("loads attendance for the selected calendar day and distinguishes worked, all-P and missing days", () => {
    const url = new URL(buildBatchAttendanceMonthUrl({ date: "2026-09-14", employeeCursor: "cursor-1" }), "http://local.test");
    expect(url.pathname).toBe("/api/attendance/monthly");
    expect(url.searchParams.get("year")).toBe("2026");
    expect(url.searchParams.get("month")).toBe("9");
    expect(url.searchParams.get("dayFrom")).toBe("14");
    expect(url.searchParams.get("dayCount")).toBe("1");
    expect(url.searchParams.get("employeeCursor")).toBe("cursor-1");

    expect(classifyBatchAttendanceDay({ hasAttendance: true, overtimeHours: 0, shifts: [
      { valueKind: "PaidLeave" }, { valueKind: "PaidLeave" },
    ] })).toBe("paid-leave");
    expect(classifyBatchAttendanceDay({ hasAttendance: true, overtimeHours: 0, shifts: [
      { valueKind: "Hours" }, { valueKind: "PaidLeave" },
    ] })).toBe("attended");
    expect(classifyBatchAttendanceDay({ hasAttendance: false, shifts: [] })).toBe("missing");
  });

  test("ignores operations from an obsolete order request", () => {
    expect(isCurrentBatchOperationsRequest(false, "order-a", "order-b")).toBe(false);
    expect(isCurrentBatchOperationsRequest(true, "order-a", "order-b")).toBe(false);
    expect(isCurrentBatchOperationsRequest(true, "order-b", "order-b")).toBe(true);
  });

  test("ignores production orders from an obsolete day request", () => {
    const dayA = { isoDate: "2026-08-01", preferredOrderId: "order-a" };
    const dayB = { isoDate: "2026-08-02", preferredOrderId: "order-b" };

    expect(isCurrentBatchOrdersRequest(false, dayA, dayB)).toBe(false);
    expect(isCurrentBatchOrdersRequest(true, dayA, dayB)).toBe(false);
    expect(isCurrentBatchOrdersRequest(true, dayB, dayB)).toBe(true);
  });

  test("prefers the selected matrix order when it is available for batch entry", () => {
    expect(initialBatchOrderId([{ id: "order-1" }, { id: "order-2" }], "order-2")).toBe("order-2");
    expect(initialBatchOrderId([{ id: "order-1" }], "missing-order")).toBe("");
  });

  test("shows the employee and operation selection flow", () => {
    const html = renderToStaticMarkup(<ProductionMatrixBatchEntryDialog day={{ isoDate: "2026-08-01", weekdayLabel: "T7", displayDate: "01/08" }} employees={[]} />);

    expect(html).toContain("Nhân viên *");
    expect(html).not.toContain("Bước 1: Chọn Mã SX");
    expect(html).not.toContain("Ngày");
  });

  test("keeps production quantity editable when one shift is paid leave", () => {
    const source = readFileSync(resolve(import.meta.dir, "ProductionMatrixBatchEntryDialog.jsx"), "utf8");

    expect(source).toContain('type="text"');
    expect(source).toContain("P/Ô");
    expect(source).not.toContain("readOnly={isPaidLeaveShift(shift)}");
    expect(source).not.toContain("readOnly={hasPaidLeave}");
  });
});
