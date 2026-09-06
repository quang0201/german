import React from "react";
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { UserAccountDialog } from "./UserAccountDialog.jsx";
import { buildUserAccountCreatePayload, buildUserAccountUpdatePayload, userAccountForm } from "./userAccountDialog.js";

describe("UserAccountDialog", () => {
  const account = { id: "account-1", username: "worker.one", role: "Worker", employeeId: "employee-1", isActive: true };

  test("does not render when closed", () => {
    expect(renderToStaticMarkup(<UserAccountDialog open={false} />)).toBe("");
  });

  test("renders the create form in a popup", () => {
    const html = renderToStaticMarkup(<UserAccountDialog
      open
      mode="create"
      employees={[{ id: "employee-1", employeeCode: "E001", fullName: "Nguyễn Văn An" }]}
      onClose={() => {}}
      onSubmit={() => {}}
    />);

    expect(html).toContain("Tạo tài khoản");
    expect(html).toContain('type="password"');
    expect(html).toContain("Nguyễn Văn An");
    expect(html).toContain("Tạo mới");
  });

  test("renders account fields and optional password in edit mode", () => {
    const html = renderToStaticMarkup(<UserAccountDialog
      open
      mode="edit"
      account={account}
      employees={[{ id: "employee-1", employeeCode: "E001", fullName: "Nguyễn Văn An" }]}
      onClose={() => {}}
      onSubmit={() => {}}
    />);

    expect(html).toContain("Sửa tài khoản");
    expect(html).toContain('value="worker.one"');
    expect(html).toContain("Để trống nếu không đổi mật khẩu");
    expect(html).toContain("Đang hoạt động");
    expect(html).toContain("Lưu thay đổi");
  });

  test("builds create payload with an optional employee link", () => {
    expect(buildUserAccountCreatePayload({ username: " worker ", password: "secret123", role: "Manager", employeeId: "" })).toEqual({
      username: "worker",
      password: "secret123",
      role: "Manager",
      employeeId: null,
    });
  });

  test("builds update payload and treats blank password as unchanged", () => {
    expect(buildUserAccountUpdatePayload({ ...userAccountForm(account), username: " worker.one ", password: "  ", isActive: false })).toEqual({
      username: "worker.one",
      password: null,
      role: "Worker",
      employeeId: "employee-1",
      isActive: false,
    });
  });
});
