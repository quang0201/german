import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ShiftTemplateDialog } from "./ShiftTemplateDialog.jsx";
import { buildShiftUpdatePayload, shiftTemplateForm } from "./shiftTemplateDialog.js";

describe("ShiftTemplateDialog", () => {
  const shift = {
    id: "shift-1",
    name: "Ca hành chính",
    isActive: true,
    periods: [
      { id: "period-1", name: "Ca 1", startTime: "07:00:00", endTime: "11:30:00", sortOrder: 1 },
      { id: "period-2", name: "Ca 2", startTime: "12:30:00", endTime: "17:00:00", sortOrder: 2 },
    ],
  };

  test("does not render when closed", () => {
    expect(renderToStaticMarkup(<ShiftTemplateDialog open={false} />)).toBe("");
  });

  test("renders editable shift name and hours", () => {
    const html = renderToStaticMarkup(<ShiftTemplateDialog open shift={shift} onClose={() => {}} onSubmit={() => {}} />);

    expect(html).toContain("Sửa bộ ca");
    expect(html).toContain('value="Ca hành chính"');
    expect(html).toContain('value="07:00"');
    expect(html).toContain('value="11:30"');
    expect(html).toContain("+ Thêm khung giờ");
    expect(html).toContain("Lưu thay đổi");
  });

  test("builds a PUT payload with normalized times and sort order", () => {
    const form = shiftTemplateForm(shift);
    form.name = "Ca mới";
    form.periods[0].startTime = "08:00";
    form.periods[0].endTime = "12:00";
    form.periods.reverse();

    expect(buildShiftUpdatePayload(form)).toEqual({
      name: "Ca mới",
      isActive: true,
      periods: [
        { name: "Ca 2", startTime: "12:30:00", endTime: "17:00:00", sortOrder: 1 },
        { name: "Ca 1", startTime: "08:00:00", endTime: "12:00:00", sortOrder: 2 },
      ],
    });
  });
});
