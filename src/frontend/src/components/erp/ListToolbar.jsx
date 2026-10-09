import React from "react";
import { Icon } from "./Icon.jsx";

export function ListToolbar({ query, onQueryChange, shown, total, noun, placeholder = "Tìm kiếm..." }) {
  return (
    <div className="erp-list-toolbar">
      <label className="erp-list-search">
        <Icon name="search" size={16} />
        <input className="erp-control" type="search" value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder={placeholder} aria-label={placeholder} />
      </label>
      <span className="erp-list-count"><strong>{shown}</strong>{shown === total ? "" : ` / ${total}`} {noun}</span>
    </div>
  );
}
