import React from "react";

export function FilterBar({ children, loading = false, onSubmit, onReset }) {
  function submit(event) {
    event.preventDefault();
    onSubmit?.(event);
  }

  return (
    <form className="erp-filter-bar" onSubmit={submit}>
      <div className="erp-filter-fields">{children}</div>
      <div className="erp-filter-actions">
        <button className="erp-button erp-button-primary" type="submit" disabled={loading}>
          {loading ? "Đang lọc..." : "Lọc"}
        </button>
        <button className="erp-button erp-button-secondary" type="button" onClick={onReset} disabled={loading}>
          Xóa lọc
        </button>
      </div>
    </form>
  );
}
