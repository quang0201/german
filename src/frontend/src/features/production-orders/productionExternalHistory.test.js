import { describe, expect, test } from "bun:test";
import { groupProductionExternalHistory } from "./productionExternalHistory.js";

describe("groupProductionExternalHistory", () => {
  test("groups records by the persisted external source identity", () => {
    const groups = groupProductionExternalHistory([
      { id: "1", externalSourceId: "source-a", sourceName: "Quách Thị Xuân", productionOperationId: "op-5" },
      { id: "2", externalSourceId: "source-a", sourceName: "QUÁCH THỊ XUÂN", productionOperationId: "op-6" },
      { id: "3", externalSourceId: "source-b", sourceName: "Nguyễn Thu Hà", productionOperationId: "op-5" },
    ], [
      { id: "op-5", operationNumber: 5 },
      { id: "op-6", operationNumber: 6 },
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0].sourceName).toBe("Quách Thị Xuân");
    expect(groups[0].entries.map((entry) => entry.operation.operationNumber)).toEqual([5, 6]);
    expect(groups[1].entries).toHaveLength(1);
  });

  test("falls back to a normalized source name for legacy records", () => {
    const groups = groupProductionExternalHistory([
      { id: "1", sourceName: " Nguyễn Thu Hà " },
      { id: "2", sourceName: "NGUYỄN THU HÀ" },
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].entries).toHaveLength(2);
  });
});
