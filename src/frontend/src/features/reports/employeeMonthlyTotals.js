// Gom dữ liệu ma trận sản lượng tháng (theo Mã SX -> nhân viên -> công đoạn -> ngày)
// thành một danh sách theo từng người: tổng tháng, tổng theo Mã SX, theo công đoạn và theo ngày.

const number = (value) => Number(value) || 0;

export function formatQuantity(value) {
  const rounded = Math.round(number(value) * 100) / 100;
  const [integer, fraction] = String(Math.abs(rounded)).split(".");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${rounded < 0 ? "-" : ""}${grouped}${fraction ? `,${fraction}` : ""}`;
}

export function normalizeSearch(text) {
  return String(text ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

function compareByTotalThenName(a, b, nameOf) {
  if (b.total !== a.total) return b.total - a.total;
  return nameOf(a).localeCompare(nameOf(b), "vi");
}

export function buildEmployeeMonthlyTotals(matrix) {
  const people = new Map();

  for (const order of matrix?.orders ?? []) {
    for (const employee of order.employees ?? []) {
      const operations = employee.operations ?? [];
      if (operations.length === 0) continue;

      let person = people.get(employee.employeeId);
      if (!person) {
        person = {
          employeeId: employee.employeeId,
          code: employee.employeeCode,
          name: employee.employeeName,
          isActive: employee.isActive !== false,
          hc: 0,
          tc: 0,
          total: 0,
          ordersById: new Map(),
        };
        people.set(employee.employeeId, person);
      }

      let block = person.ordersById.get(order.orderId);
      if (!block) {
        block = { orderId: order.orderId, orderCode: order.orderCode, productName: order.productName, hc: 0, tc: 0, total: 0, operationsById: new Map() };
        person.ordersById.set(order.orderId, block);
      }

      for (const operation of operations) {
        let row = block.operationsById.get(operation.operationId);
        if (!row) {
          row = {
            operationId: operation.operationId,
            number: operation.operationNumber,
            name: operation.operationName,
            unit: operation.unit || "",
            hc: 0, tc: 0, total: 0,
            daysByDate: new Map(),
          };
          block.operationsById.set(operation.operationId, row);
        }

        for (const cell of operation.cells ?? []) {
          const date = String(cell.workDate).slice(0, 10);
          const day = row.daysByDate.get(date) ?? { date, hc: 0, tc: 0, total: 0, entryCount: 0 };
          day.hc += number(cell.hcQuantity);
          day.tc += number(cell.tcQuantity);
          day.total += number(cell.totalQuantity);
          day.entryCount += number(cell.entryCount);
          row.daysByDate.set(date, day);
        }
      }
    }
  }

  const employees = [];
  for (const person of people.values()) {
    const orders = [];
    for (const block of person.ordersById.values()) {
      const operations = [];
      for (const row of block.operationsById.values()) {
        const days = [...row.daysByDate.values()].sort((a, b) => a.date.localeCompare(b.date));
        const hc = days.reduce((sum, day) => sum + day.hc, 0);
        const tc = days.reduce((sum, day) => sum + day.tc, 0);
        const total = days.reduce((sum, day) => sum + day.total, 0);
        if (days.length === 0 || total === 0) continue;
        operations.push({ operationId: row.operationId, number: row.number, name: row.name, unit: row.unit, hc, tc, total, days });
      }
      if (operations.length === 0) continue;
      operations.sort((a, b) => a.number - b.number);
      orders.push({
        orderId: block.orderId,
        orderCode: block.orderCode,
        productName: block.productName,
        hc: operations.reduce((sum, row) => sum + row.hc, 0),
        tc: operations.reduce((sum, row) => sum + row.tc, 0),
        total: operations.reduce((sum, row) => sum + row.total, 0),
        operations,
      });
    }
    if (orders.length === 0) continue;
    orders.sort((a, b) => compareByTotalThenName(a, b, (item) => item.orderCode));
    employees.push({
      employeeId: person.employeeId,
      code: person.code,
      name: person.name,
      isActive: person.isActive,
      hc: orders.reduce((sum, order) => sum + order.hc, 0),
      tc: orders.reduce((sum, order) => sum + order.tc, 0),
      total: orders.reduce((sum, order) => sum + order.total, 0),
      orders,
    });
  }

  employees.sort((a, b) => compareByTotalThenName(a, b, (item) => item.name));
  return {
    employees,
    summary: {
      employeeCount: employees.length,
      hc: employees.reduce((sum, item) => sum + item.hc, 0),
      tc: employees.reduce((sum, item) => sum + item.tc, 0),
      total: employees.reduce((sum, item) => sum + item.total, 0),
    },
  };
}

export function filterEmployeeTotals(employees, search) {
  const keyword = normalizeSearch(search);
  if (!keyword) return employees;
  return employees.filter((item) => normalizeSearch(`${item.name} ${item.code}`).includes(keyword));
}

export function dayLabel(isoDate) {
  const [year, month, day] = String(isoDate).split("-").map(Number);
  const weekday = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"][new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  return { weekday, display: `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}`, isSunday: weekday === "CN" };
}
