import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";
import { demoEmployees, demoOperations, demoOrder, buildDemoWeeklyMatrix } from "./mockData.mjs";

const port = Number(process.env.PORT ?? 8080);
const publicRoot = resolve("./public");
const demoUsername = "demo";
const demoPassword = "review2026";
const demoSession = {
  userId: "00000000-0000-4000-8000-000000000001",
  username: "local-demo",
  role: "Admin",
  employeeId: null,
  employeeCode: null,
  fullName: "LOCAL DEMO · DỮ LIỆU GIẢ",
};

const json = (value, status = 200, headers = {}) => new Response(JSON.stringify(value), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
});

function hasDemoCookie(request) {
  return request.headers.get("cookie")?.split(";").some((part) => part.trim() === "matrix_demo=read-only") ?? false;
}

function demoAttendance(date) {
  const workDate = date || "";
  const hourlyOnly = demoEmployees.at(-1);
  return {
    hasMoreEmployees: false,
    nextEmployeeCursor: null,
    employees: demoEmployees.map((employee, index) => {
      const onLeave = index === 2 && workDate.endsWith("-03");
      const missing = index === 1 && workDate.endsWith("-04");
      return {
        employeeId: employee.id,
        days: [{
          workDate,
          hasAttendance: employee.id === hourlyOnly.id ? true : !missing,
          overtimeHours: 0,
          shifts: onLeave ? [{ slotNumber: 1, valueKind: "PaidLeave", workedHours: 0 }] : [{ slotNumber: 1, valueKind: "Worked", workedHours: 8 }],
        }],
      };
    }),
  };
}

async function handleApi(request, url) {
  const { pathname, searchParams } = url;
  if (request.method === "POST" && pathname === "/api/auth/login") {
    let input;
    try { input = await request.json(); } catch { return json({ message: "Thông tin đăng nhập không hợp lệ." }, 400); }
    if (input.identifier !== demoUsername || input.password !== demoPassword) {
      return json({ message: "Tài khoản demo: demo / review2026" }, 401);
    }
    return json(demoSession, 200, { "set-cookie": "matrix_demo=read-only; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800" });
  }

  if (request.method === "GET" && pathname === "/api/auth/me") {
    return hasDemoCookie(request) ? json(demoSession) : json({ message: "Vui lòng đăng nhập tài khoản demo." }, 401);
  }

  if (request.method === "POST" && pathname === "/api/auth/logout") {
    return json(null, 200, { "set-cookie": "matrix_demo=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0" });
  }

  if (!hasDemoCookie(request)) return json({ message: "Vui lòng đăng nhập tài khoản demo." }, 401);
  if (request.method !== "GET") return json({ message: "Bản review local chỉ đọc; không thể lưu dữ liệu." }, 403);

  if (pathname === "/api/employees") return json(demoEmployees);
  if (pathname === "/api/production-orders" || pathname === "/api/lookups/production-orders/active") return json([demoOrder]);
  if (pathname === `/api/production-orders/${demoOrder.id}/operations`) return json(demoOperations);
  if (pathname === "/api/production-entries/weekly-matrix") {
    return json(buildDemoWeeklyMatrix({
      fromDate: searchParams.get("fromDate") ?? "2026-09-28",
      untilDate: searchParams.get("untilDate") ?? "2026-10-04",
      employeeId: searchParams.get("employeeId") ?? "",
      operationId: searchParams.get("operationId") ?? "",
      search: searchParams.get("search") ?? "",
    }));
  }
  if (pathname === "/api/attendance/monthly") return json(demoAttendance(`${searchParams.get("year")}-${String(searchParams.get("month")).padStart(2, "0")}-${String(searchParams.get("dayFrom")).padStart(2, "0")}`));
  if (pathname === "/api/lookups/attendance-hours") {
    return json({ hasAttendance: true, overtimeHours: 0, shifts: [{ slotNumber: 1, valueKind: "Worked", workedHours: 8 }] });
  }
  if (pathname === "/api/production-entries") return json({ items: [] });

  return json({ message: "API demo chưa hỗ trợ thao tác này." }, 404);
}

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

async function serveStatic(pathname) {
  const requestedPath = normalize(decodeURIComponent(pathname)).replace(/^([/\\])+/, "");
  let filePath = resolve(join(publicRoot, requestedPath || "index.html"));
  if (filePath !== publicRoot && !filePath.startsWith(`${publicRoot}${sep}`)) return new Response("Not found", { status: 404 });
  try {
    if (!(await stat(filePath)).isFile()) filePath = join(publicRoot, "index.html");
  } catch {
    filePath = join(publicRoot, "index.html");
  }

  let body = await readFile(filePath);
  if (filePath.endsWith("index.html")) {
    const notice = '<style>@media (min-width:1440px) and (max-height:900px){.erp-production-manager-content{height:calc(100dvh - var(--app-header-height) - 8px)}}</style><aside style="position:fixed;z-index:10000;inset:auto 0 0;background:#fff0c2;border-top:1px solid #b87911;padding:7px 12px;color:#664400;text-align:center;font:600 12px/1.3 system-ui">LOCAL DEMO · DỮ LIỆU GIẢ · CHẾ ĐỘ CHỈ ĐỌC</aside>';
    body = Buffer.from(body.toString("utf8").replace("</body>", `${notice}</body>`));
  }
  return new Response(body, { headers: { "content-type": mimeTypes[extname(filePath)] ?? "application/octet-stream", "cache-control": "no-store" } });
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
    const headers = new Headers(Object.entries(request.headers)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, Array.isArray(value) ? value.join(", ") : value]));
    const bodyChunks = [];
    if (request.method !== "GET" && request.method !== "HEAD") {
      for await (const chunk of request) bodyChunks.push(chunk);
    }
    const body = bodyChunks.length ? Buffer.concat(bodyChunks) : undefined;
    const apiRequest = new Request(url, {
      method: request.method,
      headers,
      ...(body ? { body } : {}),
    });
    const result = url.pathname.startsWith("/api/")
      ? await handleApi(apiRequest, url)
      : await serveStatic(url.pathname);
    response.writeHead(result.status, Object.fromEntries(result.headers.entries()));
    response.end(Buffer.from(await result.arrayBuffer()));
  } catch (error) {
    console.error("Local review server error:", error?.message ?? "unknown error");
    response.writeHead(500, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
    response.end(JSON.stringify({ message: "Lỗi máy chủ review local." }));
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Local mock review backend listening on :${port} (read-only; no database connection).`);
});
