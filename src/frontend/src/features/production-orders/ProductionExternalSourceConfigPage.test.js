import React from "react";
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ProductionExternalSourceConfigPage } from "./ProductionExternalSourceConfigPage.jsx";

describe("ProductionExternalSourceConfigPage", () => {
  test("renders source configuration controls", () => {
    const html = renderToStaticMarkup(<ProductionExternalSourceConfigPage />);

    expect(html).toContain("Danh sách gia công ngoài");
    expect(html).toContain("Thêm nguồn gia công");
    expect(html).toContain("Tên nguồn");
    expect(html).toContain("Tắt");
  });
});
