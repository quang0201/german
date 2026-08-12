import React from "react";
import { navigate } from "./navigation.js";

export function Breadcrumbs({ items = [] }) {
  if (!items.length) return null;
  return (
    <nav className="mb-4 flex items-center gap-2 text-xs text-slate-500" aria-label="Breadcrumb">
      {items.map((item, index) => (
        <React.Fragment key={`${item.label}-${index}`}>
          {index > 0 && <span aria-hidden="true">/</span>}
          {item.href ? (
            <button type="button" className="hover:text-blue-700" onClick={() => navigate(item.href)}>{item.label}</button>
          ) : <span className={index === items.length - 1 ? "font-semibold text-slate-800" : ""}>{item.label}</span>}
        </React.Fragment>
      ))}
    </nav>
  );
}
