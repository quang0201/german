import React from "react";

export function Pagination({ page, pageSize, totalCount, totalPages, loading = false, onPageChange, onPageSizeChange }) {
  const from = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalCount);
  return (
    <nav className="erp-pagination" aria-label="Phân trang">
      <span className="erp-pagination-summary">{from}–{to} / {totalCount}</span>
      <div className="erp-pagination-size">
        <label htmlFor="erp-page-size">Dòng/trang</label>
        <select id="erp-page-size" className="erp-control" value={pageSize} onChange={(event) => onPageSizeChange?.(Number(event.target.value))} disabled={loading}>
          <option value="25">25</option><option value="50">50</option><option value="100">100</option>
        </select>
      </div>
      <div className="erp-pagination-nav">
        <button className="erp-button erp-button-secondary" type="button" aria-label="Trang trước" disabled={page <= 1 || loading} onClick={() => onPageChange?.(page - 1)}>‹</button>
        <span>Trang {page} / {totalPages || 0}</span>
        <button className="erp-button erp-button-secondary" type="button" aria-label="Trang sau" disabled={page >= totalPages || loading} onClick={() => onPageChange?.(page + 1)}>›</button>
      </div>
    </nav>
  );
}
