import { toApiTime } from "./time.js";

export class ApiError extends Error {
  constructor(message, code = "request_failed", status = 0) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

function normalizeBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return body;
  }

  if (!("workStart" in body) && !("workEnd" in body)) {
    return body;
  }

  return {
    ...body,
    workStart: toApiTime(body.workStart),
    workEnd: toApiTime(body.workEnd),
  };
}

async function request(path, options = {}) {
  const headers = new Headers(options.headers ?? {});
  if (options.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(path, {
    ...options,
    headers,
    credentials: "include",
  });

  if (response.status === 204) {
    if (!response.ok) {
      throw new ApiError("Yêu cầu không thành công.", "request_failed", response.status);
    }
    return null;
  }

  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message = typeof payload === "object" && payload?.message
      ? payload.message
      : "Không thể hoàn tất yêu cầu.";
    const code = typeof payload === "object" && payload?.code
      ? payload.code
      : "request_failed";
    throw new ApiError(message, code, response.status);
  }

  return payload;
}

async function download(path, filename) {
  const response = await fetch(path, { credentials: "include", cache: "no-store" });
  if (!response.ok) {
    throw new ApiError("Không thể tải file.", "download_failed", response.status);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export const api = {
  get(path) {
    return request(path);
  },
  post(path, body) {
    return request(path, { method: "POST", body: JSON.stringify(normalizeBody(body)) });
  },
  put(path, body) {
    return request(path, { method: "PUT", body: JSON.stringify(normalizeBody(body)) });
  },
  delete(path) {
    return request(path, { method: "DELETE" });
  },
  download,
};
