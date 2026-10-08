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
  lock: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  eyeOff: <><path d="M3 3l18 18" /><path d="M10.6 6.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4M6.2 6.9A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 4-.9" /></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
  logout: <><path d="M10 17l5-5-5-5M15 12H3" /><path d="M14 4h5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5" /></>,
  refresh: <><path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 4v5h5" /><path d="M4 13a8.1 8.1 0 0 0 15.5 2M20 20v-5h-5" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  edit: <><path d="m14 6 4 4" /><path d="M4 20l4-.8L19 8a2.8 2.8 0 0 0-4-4L4 15z" /></>,
  download: <><path d="M12 3v12m0 0 4-4m-4 4-4-4" /><path d="M5 17v4h14v-4" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5m0-8h.01" /></>,
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
