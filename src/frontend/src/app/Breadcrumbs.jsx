import React from "react";
import { navigate } from "./navigation.js";

export function Breadcrumbs({ items = [] }) {
  if (items.length < 2) return null;
  return (
    <nav className="erp-breadcrumbs" aria-label="Điều hướng phân cấp">
      {items.map((item, index) => (
        <React.Fragment key={`${item.label}-${index}`}>
          {index > 0 && <span className="erp-breadcrumb-separator" aria-hidden="true">/</span>}
          {item.href ? (
            <button type="button" className="erp-breadcrumb-link" onClick={() => navigate(item.href)}>{item.label}</button>
          ) : <span className={index === items.length - 1 ? "erp-breadcrumb-current" : ""}>{item.label}</span>}
        </React.Fragment>
      ))}
    </nav>
  );
}
