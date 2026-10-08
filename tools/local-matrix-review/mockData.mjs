const orderId = "00000000-0000-4000-8000-000000004012";
const employees = [
  { id: "00000000-0000-4000-8000-000000000101", employeeCode: "DEMO-01", fullName: "Nguyễn Minh An", compensationType: "PieceRate", joinedDate: null },
  { id: "00000000-0000-4000-8000-000000000102", employeeCode: "DEMO-02", fullName: "Trần Quốc Bảo", compensationType: "PieceRate", joinedDate: null },
  { id: "00000000-0000-4000-8000-000000000103", employeeCode: "DEMO-03", fullName: "Lê Thu Hà", compensationType: "PieceRate", joinedDate: null },
  { id: "00000000-0000-4000-8000-000000000104", employeeCode: "DEMO-04", fullName: "Phạm Ngọc Hương", compensationType: "PieceRate", joinedDate: null },
  { id: "00000000-0000-4000-8000-000000000105", employeeCode: "DEMO-05", fullName: "Đặng Thị Thanh Thảo", compensationType: "PieceRate", joinedDate: null },
  { id: "00000000-0000-4000-8000-000000000106", employeeCode: "DEMO-GIỜ", fullName: "Nhân viên tính giờ (demo)", compensationType: "Hourly", joinedDate: null },
].map((employee) => ({ ...employee, isActive: true, dateOfBirth: null }));

const operations = [
  { id: "00000000-0000-4000-8000-000000000201", operationNumber: 1, name: "Cắt dây khóa", unit: "cái", sortOrder: 1, isActive: true, fixedPrice: 20 },
  { id: "00000000-0000-4000-8000-000000000202", operationNumber: 2, name: "Cắt nhám", unit: "cái", sortOrder: 2, isActive: true, fixedPrice: 12 },
  { id: "00000000-0000-4000-8000-000000000203", operationNumber: 3, name: "May thân túi", unit: "cái", sortOrder: 3, isActive: true, fixedPrice: 78 },
];

const order = {
  id: orderId,
  code: "DEMO-4012",
  productName: "Túi 4012 · dữ liệu giả lập",
  createdAt: "2026-09-01T00:00:00Z",
};

function rangeDates(fromDate, untilDate) {
  const dates = [];
  const cursor = new Date(`${fromDate}T00:00:00Z`);
  const end = new Date(`${untilDate}T00:00:00Z`);
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function sum(items, key) {
  return items.reduce((total, item) => total + Number(item[key] ?? 0), 0);
}

export function buildDemoWeeklyMatrix({ fromDate, untilDate, employeeId = "", operationId = "", search = "" }) {
  const dates = rangeDates(fromDate, untilDate);
  const workDates = dates.filter((date) => new Date(`${date}T00:00:00Z`).getUTCDay() !== 0);
  const productionEmployees = employees.slice(0, 5);
  const allRecords = [];

  const employeeGroups = productionEmployees.map((employee, employeeIndex) => {
    const employeeWorkDates = workDates.filter((date, dayIndex) => !(employeeIndex === 1 && dayIndex === workDates.length - 1)
      && !(employeeIndex === 2 && dayIndex === Math.max(0, workDates.length - 2)));
    const productionDates = new Set();
    const operationRows = operations.map((operation, operationIndex) => {
      const cells = [];
      const firstIndex = (employeeIndex + operationIndex) % employeeWorkDates.length;
      const secondIndex = (firstIndex + Math.max(1, Math.floor(employeeWorkDates.length / 2))) % employeeWorkDates.length;
      const selectedDates = [...new Set([employeeWorkDates[firstIndex], employeeWorkDates[secondIndex]])].filter(Boolean);

      for (const [dateIndex, workDate] of selectedDates.entries()) {
        productionDates.add(workDate);
        const hcQuantity = 420 + employeeIndex * 135 + operationIndex * 210 + dateIndex * 75;
        const tcQuantity = (employeeIndex + operationIndex + dateIndex) % 3 === 0 ? 0 : 18 + employeeIndex * 7 + operationIndex * 11;
        const record = {
          id: `demo-${employeeIndex + 1}-${operationIndex + 1}-${workDate}`,
          version: 1,
          entryMode: "Direct",
          hcQuantity,
          tcQuantity,
          totalQuantity: hcQuantity + tcQuantity,
          note: "Bản ghi giả lập để xem giao diện; không phải dữ liệu sản xuất.",
        };
        allRecords.push({ employee, operation, workDate, ...record });
        cells.push({
          workDate,
          hcQuantity,
          tcQuantity,
          totalQuantity: hcQuantity + tcQuantity,
          entryCount: 1,
          records: [record],
        });
      }

      return {
        operationId: operation.id,
        operationNumber: operation.operationNumber,
        operationName: operation.name,
        hcQuantity: sum(cells, "hcQuantity"),
        tcQuantity: sum(cells, "tcQuantity"),
        totalQuantity: sum(cells, "totalQuantity"),
        cells,
      };
    });

    return {
      employeeId: employee.id,
      employeeCode: employee.employeeCode,
      employeeName: employee.fullName,
      isActive: true,
      compensationType: employee.compensationType,
      joinedDate: employeeIndex === 4 ? fromDate : null,
      productionDates: [...productionDates],
      workedDates: employeeWorkDates,
      attendanceDates: employeeWorkDates,
      paidLeaveDates: employeeIndex === 2 ? [workDates[Math.max(0, workDates.length - 2)]].filter(Boolean) : [],
      operations: operationRows,
    };
  });

  const matchingRecords = allRecords.filter((record) => (!employeeId || record.employee.id === employeeId)
    && (!operationId || record.operation.id === operationId)
    && (!search || `${record.employee.employeeCode} ${record.employee.fullName} ${order.code} ${record.operation.name}`.toLowerCase().includes(search.toLowerCase())));
  const visibleEmployeeIds = new Set(matchingRecords.map((record) => record.employee.id));
  const visibleOrders = employeeId && employeeId === employees[5].id ? [] : [{
    orderId,
    orderCode: order.code,
    productName: order.productName,
    employees: employeeGroups
      .filter((employee) => !employeeId || employee.employeeId === employeeId)
      .filter((employee) => !search || visibleEmployeeIds.has(employee.employeeId))
      .map((employee) => ({
        ...employee,
        operations: employee.operations.filter((operation) => !operationId || operation.operationId === operationId),
      })),
  }];
  const summary = {
    employeeCount: visibleEmployeeIds.size,
    entryCount: matchingRecords.length,
    hcQuantity: sum(matchingRecords, "hcQuantity"),
    tcQuantity: sum(matchingRecords, "tcQuantity"),
    totalQuantity: sum(matchingRecords, "totalQuantity"),
  };

  return {
    fromDate,
    untilDate,
    excludeSundays: false,
    summary,
    availableOrders: [order],
    orders: visibleOrders,
    hourlyEmployees: employeeId && employeeId !== employees[5].id ? [] : [{
      employeeId: employees[5].id,
      employeeCode: employees[5].employeeCode,
      employeeName: employees[5].fullName,
      isActive: true,
      compensationType: "Hourly",
      joinedDate: null,
      workedDates: workDates.slice(0, Math.min(4, workDates.length)),
      attendanceDates: workDates.slice(0, Math.min(4, workDates.length)),
      paidLeaveDates: workDates.length > 4 ? [workDates[4]] : [],
    }],
  };
}

export const demoEmployees = employees;
export const demoOrder = order;
export const demoOperations = operations;
