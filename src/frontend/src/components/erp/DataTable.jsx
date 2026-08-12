import React from "react";
import { Alert } from "./Alert.jsx";
import { EmptyState } from "./EmptyState.jsx";

export function DataTable({
  columns,
  rows,
  loading = false,
  error = "",
  emptyMessage = "Không có dữ liệu.",
  density = "normal",
  rowKey = "id",
  onRowClick,
  selectedRowKey,
}) {
  if (loading) {
    return <div className="erp-table-state" role="status">Đang tải dữ liệu...</div>;
  }

  if (error) {
    return <div className="erp-table-state"><Alert variant="error" title="Không thể tải dữ liệu">{error}</Alert></div>;
  }

  if (!rows.length) {
    return <div className="erp-table-state"><EmptyState message={emptyMessage} /></div>;
  }

  return (
    <div className={`erp-table-wrap erp-table-${density}`}>
      <table className="erp-table">
        <thead>
          <tr>{columns.map((column) => <th key={column.key} scope="col" className={column.className}>{column.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const key = typeof rowKey === "function" ? rowKey(row) : row[rowKey];
            const selected = selectedRowKey !== undefined && String(selectedRowKey) === String(key);
            return (
              <tr
                key={key}
                className={`${selected ? "is-selected" : ""} ${onRowClick ? "is-clickable" : ""}`}
                onClick={() => onRowClick?.(row)}
                tabIndex={onRowClick ? 0 : undefined}
                onKeyDown={(event) => {
                  if (onRowClick && (event.key === "Enter" || event.key === " ")) {
                    event.preventDefault();
                    onRowClick(row);
                  }
                }}
              >
                {columns.map((column) => <td key={column.key} className={column.className}>{column.render ? column.render(row) : row[column.key]}</td>)}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
