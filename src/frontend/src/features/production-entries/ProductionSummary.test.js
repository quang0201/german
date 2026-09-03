import React from "react";
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ProductionSummary } from "./ProductionSummary.jsx";

const summary = {
  employeeCount: 5842,
  entryCount: 1106,
  hcQuantity: 345.5,
  tcQuantity: 22.25,
  totalQuantity: 367.75,
};

describe("ProductionSummary", () => {
  test("renders the five summary values and operation-specific final label", () => {
    const html = renderToStaticMarkup(React.createElement(ProductionSummary, {
      summary,
      operationSelected: true,
    }));

    expect(html).toContain("Nhân viên");
    expect(html).toContain("Bản ghi");
    expect(html).toContain("HC");
    expect(html).toContain("TC");
    expect(html).toContain("Tổng sản lượng");
    expect(html).toContain(">5.842<");
    expect(html).toContain(">1.106<");
    expect(html).toContain(">345,5<");
    expect(html).toContain(">22,25<");
    expect(html).toContain(">367,75<");
  });

  test("uses total operation count when no operation is selected", () => {
    const html = renderToStaticMarkup(React.createElement(ProductionSummary, {
      summary,
      operationSelected: false,
    }));

    expect(html).toContain("Tổng lượt công đoạn");
    expect(html).not.toContain("Tổng sản lượng");
  });

  test("renders five zero values when summary fields are absent", () => {
    const html = renderToStaticMarkup(React.createElement(ProductionSummary, {
      summary: {},
      operationSelected: false,
    }));

    expect((html.match(/<strong>0<\/strong>/g) || []).length).toBe(5);
  });
});
