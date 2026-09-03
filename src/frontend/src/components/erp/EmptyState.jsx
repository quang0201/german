import React from "react";

export function EmptyState({ title = "Không có dữ liệu", message = "Chưa có bản ghi phù hợp.", action }) {
  return (
    <div className="erp-empty-state">
      <strong>{title}</strong>
      <span>{message}</span>
      {action}
    </div>
  );
}
