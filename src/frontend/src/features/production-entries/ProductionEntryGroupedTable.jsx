import React from "react";
import { Alert } from "../../components/erp/Alert.jsx";
import { EmptyState } from "../../components/erp/EmptyState.jsx";
import { formatDisplayDate } from "./productionPeriod.js";

export function groupProductionEntriesByDate(rows = []) {
  return rows.reduce((groups, row) => {
    const workDate = row.workDate;
    const currentGroup = groups.at(-1);

    if (currentGroup?.workDate === workDate) {
      currentGroup.rows.push(row);
    } else {
      groups.push({ workDate, rows: [row] });
    }

    return groups;
  }, []);
}

export function ProductionEntryGroupedTable({
  columns = [],
  rows = [],
  loading = false,
  error = "",
  emptyMessage = "Không có dữ liệu.",
  density = "normal",
  rowKey = "id",
  onRowClick,
  selectedRowKey,
  className = "",
  multiDay = false,
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

  const groups = multiDay ? groupProductionEntriesByDate(rows) : [{ workDate: null, rows }];

  return (
    <div className={`erp-table-wrap erp-table-${density} ${className}`.trim()}>
      <table className="erp-table">
        <thead>
          <tr>{columns.map((column) => <th key={column.key} scope="col" className={column.className}>{column.label}</th>)}</tr>
        </thead>
        {groups.map((group, groupIndex) => (
          <tbody key={`${group.workDate}-${groupIndex}`} aria-label={multiDay ? `Ngày ${formatDisplayDate(group.workDate)}` : undefined}>
            {multiDay && <tr className="erp-production-date-group"><th colSpan={columns.length} scope="rowgroup">{formatDisplayDate(group.workDate)} <span>{group.rows.length} bản ghi</span></th></tr>}
            {group.rows.map((row) => {
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
                  {columns.map((column) => (
                    <td key={column.key} className={column.className}>
                      {multiDay && column.key === "workDate"
                        ? <span className="sr-only">{formatDisplayDate(row.workDate)}</span>
                        : column.render ? column.render(row) : row[column.key]}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        ))}
      </table>
    </div>
  );
}
