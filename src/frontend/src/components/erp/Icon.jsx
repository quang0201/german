import React from "react";

const paths = {
  overview: <><path d="m3 10 9-7 9 7" /><path d="M5 9.5V21h14V9.5M9 21v-6h6v6" /></>,
  production: <><path d="M4 5h16v14H4z" /><path d="M8 9h8M8 13h8M8 17h5" /></>,
  employees: <><circle cx="12" cy="8" r="3" /><path d="M5 21a7 7 0 0 1 14 0" /></>,
  orders: <><path d="M4 5h16v14H4z" /><path d="M8 9h8M8 13h5" /></>,
  shifts: <><circle cx="12" cy="12" r="8" /><path d="M12 7v5l3 2" /></>,
  reports: <><path d="M5 19V9M12 19V5M19 19v-7" /><path d="M3 19h18" /></>,
  accounts: <><circle cx="12" cy="8" r="3" /><path d="M5 21a7 7 0 0 1 14 0M19 8h3M20.5 6.5v3" /></>,
  audit: <><path d="M5 5h14M5 12h14M5 19h14" /><circle cx="3" cy="5" r=".8" fill="currentColor" /><circle cx="3" cy="12" r=".8" fill="currentColor" /><circle cx="3" cy="19" r=".8" fill="currentColor" /></>,
  chevronLeft: <path d="m15 18-6-6 6-6" />,
  chevronRight: <path d="m9 18 6-6-6-6" />,
};

export function Icon({ name, label, size = 20, className = "" }) {
  return (
    <svg
      className={`erp-icon ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : "true"}
    >
      {paths[name] || paths.production}
    </svg>
  );
}
