import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildAttendanceMonthPayload, buildBatchDirectPayload, buildBatchExistingEmployeesPath, buildBatchExistingEntriesPath, buildBatchExistingEntryUpdatePayload, buildExistingOperationDraft, buildPaidLeaveHourDraft, collectExistingEmployeeIds, isCurrentAttendanceRequest, mergeAttendanceHourDraft, mergeExistingOperationDrafts, parseAttendanceShiftValue, resolveBatchEntryQuantities } from "./productionMatrixBatch.js";

describe("batch production preload", () => {
  test("builds the day employee order lookup path", () => {
    expect(buildBatchExistingEntriesPath({
      date: "2026-09-16",
      employeeId: "employee-1",
      orderId: "order-1",
    })).toBe("/api/production-entries?date=2026-09-16&employeeId=employee-1&orderId=order-1&page=1&pageSize=100");
  });

  test("builds the day order lookup path for employee status marks", () => {
    expect(buildBatchExistingEmployeesPath({
      date: "2026-09-19",
      orderId: "order-1",
    })).toBe("/api/production-entries?date=2026-09-19&orderId=order-1&page=1&pageSize=100");
  });

  test("collects employees with production entered for the day and order", () => {
    expect(collectExistingEmployeeIds([
      { employeeId: "employee-1" },
      { employeeId: "employee-1" },
      { employeeId: "employee-2" },
      { employeeId: null },
    ])).toEqual(["employee-1", "employee-2"]);
  });

  test("marks existing operations and loads their quantities", () => {
    const result = mergeExistingOperationDrafts(
      [{ id: "operation-1" }, { id: "operation-2" }],
      [{ id: "entry-1", version: 3, productionOperationId: "operation-1", directHcQuantity: 120, directTcQuantity: 30, note: "Đã nhập" }],
    );

    expect(result.existingOperationIds).toEqual(["operation-1"]);
    expect(result.drafts).toEqual({
      "operation-1": { hc: "120", tc: "30", total: "150", note: "Đã nhập" },
    });
    expect(result.existingEntries["operation-1"].id).toBe("entry-1");
  });

  test("builds an update payload for an existing entry", () => {
    expect(buildBatchExistingEntryUpdatePayload(
      { id: "entry-1", version: 4, workStart: "08:00:00", workEnd: "17:00:00" },
      {
        workDate: "2026-09-16",
        employeeId: "employee-1",
        productionOrderId: "order-1",
        productionOperationId: "operation-1",
        directHcQuantity: 120,
        directTcQuantity: 30,
        note: "Đã sửa",
      },
    )).toMatchObject({
      version: 4,
      workDate: "2026-09-16",
      employeeId: "employee-1",
      productionOrderId: "order-1",
      productionOperationId: "operation-1",
      entryMode: "Direct",
      directHcQuantity: 120,
      directTcQuantity: 30,
      note: "Đã sửa",
    });
  });

  test("restores the saved quantities when an existing operation is selected again", () => {
    expect(buildExistingOperationDraft({
      hcQuantity: 1364,
      tcQuantity: 511,
      totalQuantity: 1875,
      note: "Đã nhập",
    })).toEqual({ hc: "1364", tc: "511", total: "1875", note: "Đã nhập" });
  });

  test("marks every configured shift as paid leave", () => {
    expect(buildPaidLeaveHourDraft({
      hcHours: "8",
      tcHours: "2",
      shifts: [
        { slotNumber: 1, kind: "Hours", valueKind: "Hours", workedHours: "8" },
        { slotNumber: 2, kind: "Hours", valueKind: "Hours", workedHours: "4" },
      ],
    })).toEqual({
      hcHours: "0",
      tcHours: "0",
      shifts: [
        { slotNumber: 1, kind: "PaidLeave", valueKind: "PaidLeave", workedHours: "P" },
        { slotNumber: 2, kind: "PaidLeave", valueKind: "PaidLeave", workedHours: "P" },
      ],
    });
  });
});

describe("production matrix batch attendance", () => {
  test("ignores attendance responses for an obsolete employee or day", () => {
    expect(isCurrentAttendanceRequest(false, "employee-a", "2026-08-01", "employee-a", "2026-08-01")).toBe(false);
    expect(isCurrentAttendanceRequest(true, "employee-a", "2026-08-01", "employee-b", "2026-08-01")).toBe(false);
    expect(isCurrentAttendanceRequest(true, "employee-a", "2026-08-01", "employee-a", "2026-08-02")).toBe(false);
    expect(isCurrentAttendanceRequest(true, "employee-a", "2026-08-01", "employee-a", "2026-08-01")).toBe(true);
  });

  test("wires dynamic attendance shifts into the batch dialog", () => {
    const source = readFileSync(resolve(import.meta.dir, "ProductionMatrixBatchEntryDialog.jsx"), "utf8");

    expect(source).toContain("/api/lookups/attendance-hours");
    expect(source).toContain("Theo ca chấm công");
    expect(source).toContain('useState("attendance-shifts")');
    expect(source).toContain("resolveBatchEntryQuantities");
    expect(source).toContain("/api/production-entries/batch-direct");
    expect(source).toContain("buildBatchExistingEntriesPath");
    expect(source).toContain("buildBatchExistingEmployeesPath");
    expect(source).toContain("erp-matrix-employee-existing");
    expect(source).toContain("buildBatchExistingEntryUpdatePayload");
    expect(source).toContain("buildExistingOperationDraft");
    expect(source).toContain("mergeExistingOperationDrafts");
    expect(source).toContain("existingOperationIds");
    expect(source).toContain("erp-matrix-operation-existing");
    expect(source).toContain("existingOperationIdSet.has(operationId)");
    expect(source).not.toContain("đã nhập: HC");
    expect(source).toContain("attendance");
    expect(source).toContain('tcHours: "0"');
    expect(source).toContain('hcHours: "0"');
    expect(source).toContain('hc: "0", tc: "0", total: "0"');
    expect(source).toContain("Chỉ chấm công");
    expect(source).toContain("/api/attendance/monthly");
    expect(source).toContain('type="text"');
    expect(source).toContain("P/Ô");
  });

  test("builds a single-day attendance payload without requiring production", () => {
    expect(buildAttendanceMonthPayload({
      workDate: "2026-08-22",
      employeeId: "employee-1",
      hourDraft: {
        tcHours: "2",
        shifts: [
          { slotNumber: 1, workedHours: "4" },
          { slotNumber: 2, workedHours: "4" },
        ],
      },
    })).toEqual({
      year: 2026,
      month: 8,
      days: [{
        employeeId: "employee-1",
        workDate: "2026-08-22",
        overtimeHours: 2,
        shifts: [
          { slotNumber: 1, kind: "Hours", workedHours: 4 },
          { slotNumber: 2, kind: "Hours", workedHours: 4 },
        ],
      }],
    });
  });

  test("maps P to paid leave instead of treating it as an hour value", () => {
    expect(parseAttendanceShiftValue("P", "Ca 1")).toEqual({ kind: "PaidLeave", workedHours: null });

    expect(buildAttendanceMonthPayload({
      workDate: "2026-08-22",
      employeeId: "employee-1",
      hourDraft: {
        tcHours: "0",
        shifts: [
          { slotNumber: 1, workedHours: "P" },
          { slotNumber: 2, workedHours: "4" },
        ],
      },
    }).days[0].shifts).toEqual([
      { slotNumber: 1, kind: "PaidLeave", workedHours: null },
      { slotNumber: 2, kind: "Hours", workedHours: 4 },
    ]);
  });

  test("excludes a paid-leave shift from production hour allocation", () => {
    expect(resolveBatchEntryQuantities({
      mode: "attendance-shifts",
      draft: { total: "1000" },
      hourDraft: {
        tcHours: "0",
        shifts: [
          { slotNumber: 1, shiftName: "Ca 1", workedHours: "P" },
          { slotNumber: 2, shiftName: "Ca 2", workedHours: "4" },
        ],
      },
    })).toMatchObject({
      hc: 1000,
      tc: 0,
      preview: {
        shifts: [
          { slotNumber: 1, quantity: 0 },
          { slotNumber: 2, quantity: 1000 },
        ],
      },
    });
  });

  test("maps total HC hours back to the configured shifts when saving production by hours", () => {
    const payload = buildAttendanceMonthPayload({
      workDate: "2026-08-22",
      employeeId: "employee-1",
      hourDraft: {
        hcHours: "6",
        tcHours: "2",
        shifts: [
          { slotNumber: 1, scheduledHours: 4, workedHours: "4" },
          { slotNumber: 2, scheduledHours: 4, workedHours: "4" },
        ],
      },
      useTotalRegularHours: true,
    });

    expect(payload.days[0].shifts.map((shift) => shift.workedHours)).toEqual([3, 3]);
  });

  test("builds Direct quantities from total-hours and attendance-shift modes", () => {
    const hourDraft = {
      hcHours: "8",
      tcHours: "2",
      shifts: [
        { slotNumber: 1, shiftName: "Ca 1", workedHours: "4" },
        { slotNumber: 2, shiftName: "Ca 2", workedHours: "4" },
      ],
    };

    expect(resolveBatchEntryQuantities({ mode: "total-hours", draft: { total: "1000" }, hourDraft }))
      .toMatchObject({ hc: 800, tc: 200 });
    expect(resolveBatchEntryQuantities({ mode: "attendance-shifts", draft: { total: "1000" }, hourDraft }))
      .toMatchObject({ hc: 800, tc: 200 });
  });

  test("builds attendance hours together with the production payload", () => {
    const payload = buildBatchDirectPayload({
      workDate: "2026-08-22",
      employeeId: "employee-1",
      productionOrderId: "order-1",
      hourDraft: {
        tcHours: "1",
        shifts: [
          { slotNumber: 1, workedHours: "4" },
          { slotNumber: 2, workedHours: "4" },
        ],
      },
      items: [{ productionOperationId: "operation-1", directHcQuantity: 800, directTcQuantity: 100, note: null }],
    });

    expect(payload.attendance).toEqual({
      employeeId: "employee-1",
      workDate: "2026-08-22",
      overtimeHours: 1,
      shifts: [
        { slotNumber: 1, kind: "Hours", workedHours: 4 },
        { slotNumber: 2, kind: "Hours", workedHours: 4 },
      ],
    });
  });

  test("does not create an attendance payload for direct production mode", () => {
    const payload = buildBatchDirectPayload({
      workDate: "2026-08-22",
      employeeId: "employee-1",
      productionOrderId: "order-1",
      hourDraft: null,
      items: [],
    });

    expect(payload.attendance).toBeUndefined();
  });

  test("keeps edited attendance fields while applying returned shift structure", () => {
    const merged = mergeAttendanceHourDraft(
      {
        hcHours: "",
        tcHours: "2",
        shifts: [],
      },
      {
        hasAttendance: true,
        regularHours: 8,
        overtimeHours: 1,
        shifts: [
          { slotNumber: 1, shiftName: "Ca 1", workedHours: 4 },
          { slotNumber: 2, shiftName: "Ca 2", workedHours: 4 },
        ],
      },
      { hcHours: false, tcHours: true, shifts: {} },
    );

    expect(merged.hcHours).toBe("8");
    expect(merged.tcHours).toBe("2");
    expect(merged.shifts).toHaveLength(2);
    expect(merged.shifts.map((shift) => shift.workedHours)).toEqual(["4", "4"]);
  });

  test("defaults overtime to zero when attendance has not been saved", () => {
    const merged = mergeAttendanceHourDraft(
      { hcHours: "", tcHours: "0", shifts: [] },
      { hasAttendance: false, regularHours: 0, overtimeHours: 0, shifts: [] },
      { hcHours: false, tcHours: false, shifts: {} },
    );

    expect(merged.tcHours).toBe("0");
  });

  test("defaults each unsaved regular shift to four hours", () => {
    const merged = mergeAttendanceHourDraft(
      { hcHours: "", tcHours: "0", shifts: [] },
      {
        hasAttendance: false,
        regularHours: 0,
        overtimeHours: 0,
        shifts: [
          { slotNumber: 1, shiftName: "Ca 1", workedHours: 0 },
          { slotNumber: 2, shiftName: "Ca 2", workedHours: 0 },
        ],
      },
      { hcHours: false, tcHours: false, shifts: {} },
    );

    expect(merged.shifts.map((shift) => shift.workedHours)).toEqual(["4", "4"]);
  });

  test("keeps saved attendance shift hours instead of applying the four-hour default", () => {
    const merged = mergeAttendanceHourDraft(
      { hcHours: "", tcHours: "0", shifts: [] },
      {
        hasAttendance: true,
        regularHours: 7,
        overtimeHours: 0,
        shifts: [{ slotNumber: 1, shiftName: "Ca 1", workedHours: 7 }],
      },
      { hcHours: false, tcHours: false, shifts: {} },
    );

    expect(merged.shifts[0].workedHours).toBe("7");
  });

  test("restores paid leave and its locked state from attendance lookup", () => {
    const merged = mergeAttendanceHourDraft(
      { hcHours: "", tcHours: "0", shifts: [] },
      {
        hasAttendance: true,
        regularHours: 4,
        overtimeHours: 0,
        shifts: [
          { slotNumber: 1, shiftName: "Ca 1", workedHours: 0, valueKind: "PaidLeave" },
          { slotNumber: 2, shiftName: "Ca 2", workedHours: 4, valueKind: "Hours" },
        ],
      },
      { hcHours: false, tcHours: false, shifts: {} },
    );

    expect(merged.shifts.map((shift) => shift.workedHours)).toEqual(["P", "4"]);
    expect(merged.shifts[0].valueKind).toBe("PaidLeave");
  });

  test("keeps an edited shift value while loading untouched shifts", () => {
    const merged = mergeAttendanceHourDraft(
      {
        hcHours: "8",
        tcHours: "1",
        shifts: [{ slotNumber: 1, workedHours: "6" }],
      },
      {
        hasAttendance: true,
        regularHours: 8,
        overtimeHours: 1,
        shifts: [
          { slotNumber: 1, shiftName: "Ca 1", workedHours: 4 },
          { slotNumber: 2, shiftName: "Ca 2", workedHours: 4 },
        ],
      },
      { hcHours: false, tcHours: false, shifts: { "1": true } },
    );

    expect(merged.shifts.map((shift) => shift.workedHours)).toEqual(["6", "4"]);
  });
});
