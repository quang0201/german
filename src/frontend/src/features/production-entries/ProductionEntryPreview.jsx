import React from "react";

export function ProductionEntryPreview({ preview, serverResult }) {
  const value = serverResult
    ? {
        hc: serverResult.hcQuantity,
        tc: serverResult.tcQuantity,
        total: serverResult.totalQuantity,
      }
    : preview;

  if (!value) {
    return null;
  }

  return (
    <section className={`rounded-2xl border p-4 ${serverResult ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-700">
          {serverResult ? "Đã ghi nhận" : "Dự tính"}
        </h2>
        {serverResult && <span className="text-xs font-semibold text-emerald-700">Đã nộp</span>}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Metric label="HC" value={value.hc} />
        <Metric label="TC" value={value.tc} />
        <Metric label="Tổng" value={value.total} />
      </div>
      {!serverResult && (
        <p className="mt-3 text-xs leading-5 text-slate-500">Kết quả backend sau khi nộp là dữ liệu chính thức.</p>
      )}
    </section>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-xl bg-white px-2 py-3 shadow-sm">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-1 text-lg font-bold tabular-nums text-slate-950">{value}</div>
    </div>
  );
}
