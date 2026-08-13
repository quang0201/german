import React from "react";
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { PeriodSelector } from "./PeriodSelector.jsx";
import { localIsoDate, shiftPeriod } from "./productionPeriod.js";

const baseProps = {
  periodMode: "week",
  anchorDate: localIsoDate(),
  customFromDate: "",
  customUntilDate: "",
  onPreset: () => {},
  onShift: () => {},
  onCustomChange: () => {},
};

describe("PeriodSelector", () => {
  test("renders five Vietnamese presets with the active preset pressed", () => {
    const html = renderToStaticMarkup(React.createElement(PeriodSelector, baseProps));

    expect((html.match(/data-period-preset=/g) || []).length).toBe(5);
    expect(html).toContain("Hôm nay");
    expect(html).toContain("Hôm qua");
    expect(html).toContain("Tuần này");
    expect(html).toContain("Tháng này");
    expect(html).toContain("Tùy chọn");
    expect(html).toContain('data-period-preset="week" aria-pressed="true"');
    expect(html).toContain('data-period-preset="today" aria-pressed="false"');
  });

  test("uses contextual previous and next labels", () => {
    const html = renderToStaticMarkup(React.createElement(PeriodSelector, baseProps));

    expect(html).toContain('aria-label="Tuần trước"');
    expect(html).toContain('aria-label="Tuần sau"');
  });

  test("presses current week and month presets", () => {
    for (const periodMode of ["week", "month"]) {
      const html = renderToStaticMarkup(React.createElement(PeriodSelector, {
        ...baseProps,
        periodMode,
        anchorDate: localIsoDate(),
      }));

      expect(html).toContain(`data-period-preset="${periodMode}" aria-pressed="true"`);
    }
  });

  test("does not press current presets for shifted weeks and months", () => {
    const today = localIsoDate();

    for (const periodMode of ["week", "month"]) {
      for (const direction of [-1, 1]) {
        const html = renderToStaticMarkup(React.createElement(PeriodSelector, {
          ...baseProps,
          periodMode,
          anchorDate: shiftPeriod(periodMode, today, direction),
        }));

        expect(html).toContain(`data-period-preset="${periodMode}" aria-pressed="false"`);
        expect(html).not.toContain('aria-pressed="true"');
      }
    }
  });

  test("renders custom inputs only in custom mode", () => {
    const normalHtml = renderToStaticMarkup(React.createElement(PeriodSelector, baseProps));
    const customHtml = renderToStaticMarkup(React.createElement(PeriodSelector, {
      ...baseProps,
      periodMode: "custom",
      customFromDate: "2024-01-01",
      customUntilDate: "2024-01-15",
    }));

    expect((normalHtml.match(/type="date"/g) || []).length).toBe(0);
    expect((customHtml.match(/type="date"/g) || []).length).toBe(2);
    expect(customHtml).toContain('value="2024-01-01"');
    expect(customHtml).toContain('value="2024-01-15"');
    expect(customHtml).toContain("Từ ngày");
    expect(customHtml).toContain("Đến ngày");
  });

  test("shows a custom draft editor without changing the applied preset or period label", () => {
    const html = renderToStaticMarkup(React.createElement(PeriodSelector, {
      ...baseProps,
      periodMode: "day",
      anchorDate: "2024-01-03",
      customFromDate: "2024-01-01",
      customUntilDate: "2024-01-15",
      isCustomEditing: true,
    }));

    expect(html).toContain('data-period-preset="custom" aria-pressed="false"');
    expect(html).toContain('data-period-preset="today" aria-pressed="false"');
    expect(html).toContain("03/01/2024");
    expect((html.match(/type="date"/g) || []).length).toBe(2);
    expect(html).toContain('value="2024-01-01"');
    expect(html).toContain('value="2024-01-15"');
  });

  test("keeps an applied custom label stable while editing a new custom draft", () => {
    const html = renderToStaticMarkup(React.createElement(PeriodSelector, {
      ...baseProps,
      periodMode: "custom",
      customFromDate: "2024-02-01",
      customUntilDate: "2024-02-15",
      appliedCustomFromDate: "2024-01-01",
      appliedCustomUntilDate: "2024-01-15",
    }));

    expect(html).toContain("01/01/2024 – 15/01/2024");
    expect(html).toContain('value="2024-02-01"');
    expect(html).toContain('value="2024-02-15"');
  });
});
