import { describe, expect, test } from "bun:test";
import { getDefaultRoute, matchRoute, routes } from "./routes.js";

describe("ERP route metadata", () => {
  test("matches parameter routes by segment and keeps /orders/new distinct", () => {
    const newOrder = matchRoute("/orders/new", routes);
    const orderDetail = matchRoute("/orders/abc-123", routes);

    expect(newOrder?.route.path).toBe("/orders/new");
    expect(orderDetail?.route.path).toBe("/orders/:id");
    expect(orderDetail?.params.id).toBe("abc-123");
  });

  test("provides role defaults", () => {
    expect(getDefaultRoute("Worker")).toBe("/production/new");
    expect(getDefaultRoute("Manager")).toBe("/production");
    expect(getDefaultRoute("Admin")).toBe("/production");
  });

  test("contains navigation metadata for the production detail route", () => {
    const route = routes.find((item) => item.path === "/production/:id");
    expect(route?.roles).toContain("Worker");
    expect(route?.breadcrumb({ id: "entry-1" })).toEqual([
      { label: "Sản lượng", href: "/production" },
      { label: "entry-1" },
    ]);
  });

  test("exposes attendance only to Manager and Admin", () => {
    const route = routes.find((item) => item.path === "/attendance");
    expect(route?.roles).toEqual(["Manager", "Admin"]);
    expect(route?.navLabel).toBe("Chấm công");
  });
});
