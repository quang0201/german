import React from "react";
import { readFileSync } from "node:fs";
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ProductionMonthlyMatrix } from "./ProductionMonthlyMatrix.jsx";
import { mergeHourlyEmployeesIntoOrders } from "./productionMonthlyMatrix.js";

const matrixSource = readFileSync(new URL("./ProductionMonthlyMatrix.jsx", import.meta.url), "utf8");

const operation = (id, number, cells = []) => ({
  operationId: id,
  operationNumber: number,
  operationName: `CĐ${number}`,
  hcQuantity: 100,
  tcQuantity: 20,
  totalQuantity: 120,
  cells,
});

function dataWithOneOrder(joinedDate = "2026-08-15") {
  return {
    availableOrders: [{ id: "o1", code: "0417", productName: "Mã hàng 0417" }],
    orders: [{
      orderId: "o1",
      orderCode: "0417",
      productName: "Mã hàng 0417",
      employees: [{
        employeeId: "e1",
        employeeCode: "E001",
        employeeName: "Bạch Thị Đào",
        joinedDate,
        operations: [operation("op1", 4), operation("op2", 5), operation("op3", 100)],
      }],
    }],
  };
}

function dataWithMissingOperationWarning() {
  const data = dataWithOneOrder();
  data.orders[0].employees[0].operations[0].cells = [{
    workDate: "2026-08-05",
    hcQuantity: 100,
    tcQuantity: 20,
    totalQuantity: 120,
    entryCount: 1,
    records: [],
  }];
  data.orders[0].employees[0].productionDates = ["2026-08-05"];
  data.orders[0].employees[0].workedDates = ["2026-08-05", "2026-08-06", "2026-08-07"];
  data.orders[0].employees[0].attendanceDates = ["2026-08-05", "2026-08-06", "2026-08-07"];
  data.orders[0].employees[0].paidLeaveDates = ["2026-08-06"];
  return data;
}

describe("ProductionMonthlyMatrix render", () => {
  test("adds hourly employees to each order even without production entries", () => {
    const result = mergeHourlyEmployeesIntoOrders(dataWithOneOrder().orders, [{
      employeeId: "e-hourly",
      employeeCode: "5",
      employeeName: "Trần Thị Loan",
      compensationType: "Hourly",
    }]);

    expect(result[0].employees[1].employeeName).toBe("Trần Thị Loan");
    expect(result[0].employees[1].operations).toHaveLength(0);
  });

  test("renders one shared day axis, order block and rowspan employee", () => {
    const html = renderToStaticMarkup(<ProductionMonthlyMatrix data={dataWithOneOrder()} monthKey="2026-08" excludeSundays />);

    expect(html).toContain("Nhân viên");
    expect(html).toContain("CĐ");
    expect(html).toContain("T5");
    expect(html).toContain("27/08");
    expect(html).toContain("Mã SX: 0417");
    expect(html).toContain('rowSpan="3"');
    expect(html).toContain("Tổng HC");
    expect(html).toContain("Tổng TC");
    expect(html).not.toContain(">ĐVT<");
    expect(html).not.toContain(">CN<");
    expect(html).toContain('aria-label="Nhập nhanh ngày T7 01/08: chọn Mã SX và công đoạn"');
    expect(html).toContain("erp-month-day-action");
    expect(html).toContain("Chọn ngày để nhập nhanh nhiều người");
    expect(html).toContain("Bấm ô tổng để nhập hoặc sửa chi tiết HC/TC");
    expect(html).toContain("erp-month-order-filter-select");
  });

  test("shows the daily HC+TC total while keeping both values in the click details", () => {
    const data = dataWithOneOrder();
    data.orders[0].employees[0].workedDates = ["2026-08-05"];
    data.orders[0].employees[0].productionDates = ["2026-08-05"];
    data.orders[0].employees[0].operations[0].cells = [{
      workDate: "2026-08-05",
      hcQuantity: 220,
      tcQuantity: 35,
      totalQuantity: 255,
      entryCount: 1,
      records: [],
    }];
    const html = renderToStaticMarkup(<ProductionMonthlyMatrix
      data={data}
      fromDate="2026-08-05"
      untilDate="2026-08-05"
      excludeSundays={false}
    />);

    expect(html).toContain('aria-label="Bạch Thị Đào CĐ4 05/08 Tổng"');
    expect(html).toContain("HC: 220 · TC: 35");
    expect(html).toContain('aria-description="Nhân viên: Bạch Thị Đào');
    expect(html).toContain(">255</button>");
    expect(html.match(/<td data-date="2026-08-05"/g)).toHaveLength(3);
    expect(html).not.toContain("erp-month-day-sub");
  });

  test("shows useful employee, order, operation, date, quantity and status details on matrix-cell hover", () => {
    const data = dataWithOneOrder();
    data.orders[0].employees[0].operations[0].cells = [{
      workDate: "2026-08-05",
      hcQuantity: 12,
      tcQuantity: 3,
      totalQuantity: 15,
      entryCount: 1,
      records: [],
    }];
    data.orders[0].employees[0].workedDates = ["2026-08-05"];
    data.orders[0].employees[0].productionDates = ["2026-08-05"];
    const html = renderToStaticMarkup(<ProductionMonthlyMatrix data={data} fromDate="2026-08-05" untilDate="2026-08-05" excludeSundays={false} />);

    expect(html).toContain('title="Nhân viên: Bạch Thị Đào');
    expect(html).toContain("Mã SX: 0417");
    expect(html).toContain("Ngày: T4 05/08/2026");
    expect(html).toContain("HC: 12 · TC: 3");
    expect(html).toContain("Đã có sản lượng");
    expect(html).toContain("aria-description=");
  });

  test("caches hover columns and delays tooltip updates to avoid work while quickly scanning cells", () => {
    expect(matrixSource).toContain("const matrixHoverStates = new WeakMap()");
    expect(matrixSource).toContain("state.columns.get(state.date)?.forEach((item) => item.classList.remove");
    expect(matrixSource).toContain("setTimeout(() => showCellTooltip(table, nextCell), 140)");
  });

  test("can hide the order selector and hourly employee note when embedded in the manager controls", () => {
    const html = renderToStaticMarkup(<ProductionMonthlyMatrix data={dataWithOneOrder()} monthKey="2026-08" selectedOrderId="o1" showOrderFilter={false} />);

    expect(html).not.toContain("erp-month-order-filter-select");
    expect(html).not.toContain("Nhân viên theo giờ");
  });

  test("keeps a sole production order selectable so operation filtering can be enabled", () => {
    const html = renderToStaticMarkup(<ProductionMonthlyMatrix data={dataWithOneOrder()} monthKey="2026-08" selectedOrderId="o1" excludeSundays />);

    expect(html).toContain('value="o1" selected="">0417 — Mã hàng 0417</option>');
    expect(html).not.toContain("Tất cả mã SX");
  });

  test("keeps the calendar header visible for an empty month so batch entry remains reachable", () => {
    const html = renderToStaticMarkup(<ProductionMonthlyMatrix data={{ availableOrders: [], orders: [] }} monthKey="2026-08" excludeSundays />);

    expect(html).toContain('data-date="2026-08-01"');
    expect(html).toContain("Bấm vào ngày phía trên để nhập nhanh nhiều công đoạn.");
  });

  test("uses the selected weekly range label when no order is available", () => {
    const html = renderToStaticMarkup(<ProductionMonthlyMatrix
      data={{ availableOrders: [], orders: [] }}
      fromDate="2026-08-31"
      untilDate="2026-09-06"
      excludeSundays={false}
      showSundayToggle={false}
    />);

    expect(html).toContain("31/08/2026 – 06/09/2026");
    expect(html).not.toContain("NaN/NaN");
  });

  test("restores the horizontal matrix position after a data refresh", () => {
    expect(matrixSource).toContain("useLayoutEffect");
    expect(matrixSource).toContain("scrollLeftRef.current");
    expect(matrixSource).toContain("scrollLeft = scrollLeftRef.current");
    expect(matrixSource).toContain("onScroll");
    expect(matrixSource).not.toContain("horizontalScrollRef");
    expect(matrixSource).not.toContain("erp-month-matrix-horizontal-scroll");
  });

  test("marks today and contains logic to jump to its column", () => {
    const html = renderToStaticMarkup(<ProductionMonthlyMatrix
      data={dataWithOneOrder()}
      monthKey="2026-08"
      excludeSundays
      today={new Date("2026-08-20T08:00:00")}
    />);

    expect(html).toContain("erp-month-today");
    expect(matrixSource).toContain("todayIso");
    expect(matrixSource).toContain("offsetLeft");
  });

  test("keeps future dates neutral instead of warning about missing attendance or production", () => {
    const data = dataWithOneOrder();
    const employee = data.orders[0].employees[0];
    employee.workedDates = [];
    employee.paidLeaveDates = [];
    employee.productionDates = [];
    const html = renderToStaticMarkup(<ProductionMonthlyMatrix
      data={data}
      fromDate="2026-08-20"
      untilDate="2026-08-21"
      excludeSundays={false}
      today={new Date("2026-08-20T08:00:00")}
    />);
    const cellsOnDate = (date) => [...html.matchAll(new RegExp(`<td data-date="${date}" class="([^"]*)"`, "g"))].map((match) => match[1]);

    expect(cellsOnDate("2026-08-20").every((className) => className.includes("erp-month-no-attendance"))).toBe(true);
    expect(cellsOnDate("2026-08-21").every((className) => className.includes("erp-month-future") && !className.includes("erp-month-no-attendance") && !className.includes("erp-month-missing"))).toBe(true);
    expect(html).toContain("Chưa tới ngày");
    expect(html).toContain("21/08 Tổng - chưa tới ngày");
  });

  test("does not label future dates as not-yet-arrived when production is already entered", () => {
    const data = dataWithOneOrder();
    const employee = data.orders[0].employees[0];
    employee.workedDates = [];
    employee.paidLeaveDates = [];
    employee.productionDates = ["2026-08-21"];
    employee.operations[0].cells = [{
      workDate: "2026-08-21",
      hcQuantity: 100,
      tcQuantity: 20,
      totalQuantity: 120,
      entryCount: 1,
      records: [{ id: "entry-future", entryMode: "ByShift" }],
    }];
    const html = renderToStaticMarkup(<ProductionMonthlyMatrix
      data={data}
      fromDate="2026-08-21"
      untilDate="2026-08-21"
      excludeSundays={false}
      today={new Date("2026-08-20T08:00:00")}
    />);

    const cellIndex = html.indexOf('aria-label="Bạch Thị Đào CĐ4 21/08 Tổng"');
    const rowStart = html.lastIndexOf("<tr", cellIndex);
    const rowEnd = html.indexOf("</tr>", cellIndex) + "</tr>".length;
    const enteredOperationRow = cellIndex >= 0 ? html.slice(rowStart, rowEnd) : "";
    expect(enteredOperationRow).toContain('aria-label="Bạch Thị Đào CĐ4 21/08 Tổng"');
    expect(enteredOperationRow).toContain("HC: 100 · TC: 20");
    expect(enteredOperationRow).not.toContain("chưa tới ngày");
    expect(enteredOperationRow).not.toContain("erp-month-future");
  });

  test("renders one total cell and one status marker per operation and day", () => {
    const data = dataWithOneOrder();
    const employee = data.orders[0].employees[0];
    employee.workedDates = [];
    employee.paidLeaveDates = [];
    const html = renderToStaticMarkup(<ProductionMonthlyMatrix
      data={data}
      fromDate="2026-08-20"
      untilDate="2026-08-20"
      today={new Date("2026-08-20T08:00:00")}
    />);
    const classes = [...html.matchAll(/<td data-date="2026-08-20" class="([^"]*)"/g)].map((match) => match[1]);

    expect(classes).toHaveLength(3);
    expect(classes.filter((className) => className.includes("erp-month-status-marker"))).toHaveLength(3);
  });

  test("marks Sundays separately while keeping today highlighted", () => {
    const html = renderToStaticMarkup(<ProductionMonthlyMatrix
      data={dataWithOneOrder()}
      monthKey="2026-08"
      excludeSundays={false}
      today={new Date("2026-08-20T08:00:00")}
    />);

    expect(html).toMatch(/class="[^"]*erp-month-sunday[^"]*"[^>]*>[\s\S]*data-date="2026-08-02"/);
    expect(html).toMatch(/class="[^"]*erp-month-today[^"]*"[^>]*>[\s\S]*data-date="2026-08-20"/);
    expect(matrixSource).toContain("day.isSunday");
  });

  test("marks inactive production employees red and disables entry cells", () => {
    const data = dataWithOneOrder();
    data.orders[0].employees[0].isActive = false;
    const html = renderToStaticMarkup(<ProductionMonthlyMatrix data={data} monthKey="2026-08" excludeSundays />);

    expect(html).toContain("erp-month-inactive");
    expect(html).toContain("Đã tắt");
    expect(html).toMatch(/button[^>]*disabled=""[^>]*aria-label="Bạch Thị Đào CĐ4 01\/08 Tổng/);
  });

  test("does not warn when at least one operation is entered on a production day", () => {
    const html = renderToStaticMarkup(<ProductionMonthlyMatrix data={dataWithMissingOperationWarning()} monthKey="2026-08" excludeSundays />);
    const cellsOnDate = (date) => [...html.matchAll(new RegExp(`<td data-date="${date}" class="([^"]*)"`, "g"))].map((match) => match[1]);

    expect(cellsOnDate("2026-08-05").every((className) => !className.includes("erp-month-missing"))).toBe(true);
    expect(cellsOnDate("2026-08-06").every((className) => !className.includes("erp-month-missing"))).toBe(true);
    expect(cellsOnDate("2026-08-07").every((className) => className.includes("erp-month-missing"))).toBe(true);
    expect(cellsOnDate("2026-08-08").every((className) => className.includes("erp-month-no-attendance"))).toBe(true);
    expect(cellsOnDate("2026-08-06").every((className) => className.includes("erp-month-paid-leave"))).toBe(true);
    expect(html).toContain("erp-month-group-start");
    expect(matrixSource).toContain("workedDates");
    expect(matrixSource).toContain("erp-month-no-attendance");
    expect(matrixSource).toContain("paidLeaveDates");
    expect(html).toContain("Nghỉ phép</span>");
    expect(html).toContain("Chưa nhập công đoạn");
    expect(html).toContain("Cuộn ngang để xem các ngày khác");
    expect(html).toContain('aria-label="Ma trận sản lượng; cuộn ngang để xem các ngày, cuộn dọc để xem nhân viên"');
  });

  test("keeps employee groups on one neutral background and preserves full names for truncated labels", () => {
    const data = dataWithOneOrder();
    data.orders[0].employees.push({
      ...structuredClone(data.orders[0].employees[0]),
      employeeId: "e2",
      employeeName: "Nguyễn Thị Hòa",
      operations: [operation("op4", 6)],
    });
    const html = renderToStaticMarkup(<ProductionMonthlyMatrix data={data} monthKey="2026-08" excludeSundays />);

    expect(html).toContain("erp-month-group-start");
    expect(html).not.toContain("erp-month-group-alt");
    expect(html).toContain("erp-month-group-end");
    expect(html).toContain('class="erp-month-employee-name" title="Bạch Thị Đào"');
    expect(html).toContain('class="erp-month-employee-name" title="Nguyễn Thị Hòa"');
    expect(html).toContain("erp-month-value-cell");
  });

  test("does not warn when another operation in the selected order was entered", () => {
    const data = dataWithOneOrder();
    data.orders[0].employees[0].operations = [operation("op2", 5)];
    data.orders[0].employees[0].productionDates = ["2026-08-05"];
    data.orders[0].employees[0].workedDates = ["2026-08-05"];
    data.orders[0].employees[0].attendanceDates = ["2026-08-05"];
    const html = renderToStaticMarkup(<ProductionMonthlyMatrix data={data} monthKey="2026-08" excludeSundays />);
    const cellsOnDate = [...html.matchAll(/<td data-date="2026-08-05" class="([^"]*)"/g)].map((match) => match[1]);

    expect(cellsOnDate.every((className) => !className.includes("erp-month-missing"))).toBe(true);
  });

  test("shows hourly employees without requiring production entries", () => {
    const data = dataWithOneOrder();
    data.hourlyEmployees = [{
      employeeId: "e-hourly",
      employeeCode: "5",
      employeeName: "Trần Thị Loan",
      compensationType: "Hourly",
    }];

    const html = renderToStaticMarkup(<ProductionMonthlyMatrix data={data} monthKey="2026-08" excludeSundays />);

    expect(html).toContain("Trần Thị Loan");
    expect(html).not.toContain("không yêu cầu nhập sản lượng");
    expect(html).toContain("Trần Thị Loan");
    expect(html).toContain('class="erp-month-employee-name" title="Trần Thị Loan">Trần Thị Loan</span></td><td class="erp-month-sticky-operation erp-month-operation"></td>');
  });

  test("does not warn for an hourly employee who has an existing production row", () => {
    const data = dataWithOneOrder();
    data.orders[0].employees[0].compensationType = "Hourly";
    data.orders[0].employees[0].workedDates = ["2026-08-05"];
    data.orders[0].employees[0].attendanceDates = ["2026-08-05"];
    data.orders[0].employees[0].productionDates = [];

    const html = renderToStaticMarkup(<ProductionMonthlyMatrix data={data} monthKey="2026-08" excludeSundays />);
    const cellsOnDate = [...html.matchAll(/<td data-date="2026-08-05" class="([^"]*)"/g)].map((match) => match[1]);

    expect(cellsOnDate.every((className) => !className.includes("erp-month-missing"))).toBe(true);
    expect(cellsOnDate.every((className) => !className.includes("erp-month-no-attendance"))).toBe(true);
  });

  test("warns when an hourly employee has no worked hours", () => {
    const data = dataWithOneOrder();
    data.orders[0].employees[0].compensationType = "Hourly";
    data.orders[0].employees[0].workedDates = [];
    data.orders[0].employees[0].attendanceDates = ["2026-08-05"];
    data.orders[0].employees[0].productionDates = [];

    const html = renderToStaticMarkup(<ProductionMonthlyMatrix data={data} monthKey="2026-08" excludeSundays />);
    const cellsOnDate = [...html.matchAll(/<td data-date="2026-08-05" class="([^"]*)"/g)].map((match) => match[1]);

    expect(cellsOnDate.every((className) => className.includes("erp-month-no-attendance"))).toBe(true);
  });

  test("does not show missing attendance for a worked day on an hourly employee without production", () => {
    const hourlyEmployees = [{
      employeeId: "e-hourly",
      employeeCode: "5",
      employeeName: "Trần Thị Loan",
      compensationType: "Hourly",
      workedDates: ["2026-08-05"],
      attendanceDates: ["2026-08-05"],
    }];
    const emptyOrderData = dataWithOneOrder();
    emptyOrderData.orders[0].employees = [];
    const data = { ...emptyOrderData, orders: mergeHourlyEmployeesIntoOrders(emptyOrderData.orders, hourlyEmployees) };

    const html = renderToStaticMarkup(<ProductionMonthlyMatrix data={data} monthKey="2026-08" excludeSundays />);
    const cellsOnWorkedDate = [...html.matchAll(/<td data-date="2026-08-05" class="([^"]*)"/g)].map((match) => match[1]);
    const cellsOnUnworkedDate = [...html.matchAll(/<td data-date="2026-08-06" class="([^"]*)"/g)].map((match) => match[1]);

    expect(cellsOnWorkedDate.length).toBeGreaterThan(0);
    expect(cellsOnWorkedDate.every((className) => !className.includes("erp-month-no-attendance"))).toBe(true);
    expect(cellsOnUnworkedDate.some((className) => className.includes("erp-month-no-attendance"))).toBe(true);
  });

  test("highlights only employees who joined during the selected month", () => {
    const newEmployeeHtml = renderToStaticMarkup(<ProductionMonthlyMatrix data={dataWithOneOrder("2026-09-05")} monthKey="2026-09" excludeSundays />);
    const previousEmployeeHtml = renderToStaticMarkup(<ProductionMonthlyMatrix data={dataWithOneOrder("2026-08-15")} monthKey="2026-09" excludeSundays />);

    expect(newEmployeeHtml).toContain("erp-month-new-employee");
    expect(previousEmployeeHtml).not.toContain("erp-month-new-employee");
  });
});
