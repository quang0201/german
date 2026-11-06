import { describe, expect, test } from "bun:test";
import { buildEmployeeMonthlyTotals, dayLabel, filterEmployeeTotals, formatQuantity, normalizeSearch } from "./employeeMonthlyTotals.js";

const cell = (workDate, hc, tc = 0) => ({ workDate, hcQuantity: hc, tcQuantity: tc, totalQuantity: hc + tc, entryCount: 1 });
const operation = (id, number, name, cells) => ({ operationId: id, operationNumber: number, operationName: name, unit: "cái", cells });

const matrix = {
  orders: [
    {
      orderId: "o-den", orderCode: "4004 đen - T10", productName: "Túi 4004 đen",
      employees: [
        { employeeId: "e-huong", employeeCode: "4", employeeName: "Quách Thị Hương", isActive: true, operations: [
          operation("op-1", 1, "Cắt quai", [cell("2026-10-19", 1000, 667), cell("2026-10-16", 500)]),
          operation("op-2", 2, "Cắt dây khóa", [cell("2026-10-16", 500)]),
        ] },
        { employeeId: "e-nuong", employeeCode: "12", employeeName: "Bạch Thị Nương", isActive: true, operations: [
          operation("op-14", 14, "Gấp hàng", [cell("2026-10-28", 700)]),
        ] },
        { employeeId: "e-trong", employeeCode: "99", employeeName: "Chỉ chấm công", isActive: true, operations: [] },
      ],
    },
    {
      orderId: "o-do", orderCode: "TÚI 4004 đỏ", productName: "Túi đỏ",
      employees: [
        { employeeId: "e-huong", employeeCode: "4", employeeName: "Quách Thị Hương", isActive: true, operations: [
          operation("op-5", 5, "May dây K25", [cell("2026-10-01", 1067, 133)]),
        ] },
        { employeeId: "e-khong", employeeCode: "98", employeeName: "Toàn số 0", isActive: true, operations: [
          operation("op-5", 5, "May dây K25", [cell("2026-10-02", 0)]),
        ] },
      ],
    },
  ],
};

describe("buildEmployeeMonthlyTotals", () => {
  const result = buildEmployeeMonthlyTotals(matrix);

  test("gộp một người qua nhiều Mã SX và sắp xếp theo tổng giảm dần", () => {
    expect(result.employees.map((item) => item.name)).toEqual(["Quách Thị Hương", "Bạch Thị Nương"]);
    const huong = result.employees[0];
    expect(huong.total).toBe(1000 + 667 + 500 + 500 + 1200);
    expect(huong.hc).toBe(1000 + 500 + 500 + 1067);
    expect(huong.tc).toBe(667 + 133);
    expect(huong.orders.map((order) => order.orderCode)).toEqual(["4004 đen - T10", "TÚI 4004 đỏ"]);
  });

  test("bỏ người chỉ có chấm công hoặc toàn số 0", () => {
    expect(result.employees.some((item) => item.employeeId === "e-trong")).toBe(false);
    expect(result.employees.some((item) => item.employeeId === "e-khong")).toBe(false);
  });

  test("công đoạn theo thứ tự số và ngày theo thứ tự thời gian", () => {
    const den = result.employees[0].orders[0];
    expect(den.operations.map((row) => row.number)).toEqual([1, 2]);
    expect(den.operations[0].days.map((day) => day.date)).toEqual(["2026-10-16", "2026-10-19"]);
    expect(den.operations[0].total).toBe(500 + 1667);
    expect(den.total).toBe(2167 + 500);
  });

  test("tính tổng toàn tháng", () => {
    expect(result.summary).toEqual({ employeeCount: 2, hc: 3067 + 700, tc: 800, total: 3867 + 700 });
  });

  test("dữ liệu rỗng không gây lỗi", () => {
    expect(buildEmployeeMonthlyTotals(undefined)).toEqual({ employees: [], summary: { employeeCount: 0, hc: 0, tc: 0, total: 0 } });
  });
});

describe("helpers", () => {
  test("định dạng số kiểu Việt Nam", () => {
    expect(formatQuantity(0)).toBe("0");
    expect(formatQuantity(1234567)).toBe("1.234.567");
    expect(formatQuantity(1500.5)).toBe("1.500,5");
  });

  test("tìm kiếm không phân biệt dấu và hoa thường", () => {
    expect(normalizeSearch("Đào")).toBe("dao");
    const list = [{ name: "Bạch Thị Đào", code: "0417-BTD" }, { name: "Quách Thị Hương", code: "4" }];
    expect(filterEmployeeTotals(list, "dao").map((item) => item.name)).toEqual(["Bạch Thị Đào"]);
    expect(filterEmployeeTotals(list, "HUONG").map((item) => item.name)).toEqual(["Quách Thị Hương"]);
    expect(filterEmployeeTotals(list, "")).toBe(list);
  });

  test("nhãn ngày có thứ và đánh dấu Chủ nhật", () => {
    expect(dayLabel("2026-10-18")).toEqual({ weekday: "CN", display: "18/10", isSunday: true });
    expect(dayLabel("2026-10-03")).toEqual({ weekday: "T7", display: "03/10", isSunday: false });
  });
});
