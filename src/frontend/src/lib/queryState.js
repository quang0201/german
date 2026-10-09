import { useEffect } from "react";

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const monthPattern = /^\d{4}-\d{2}$/;

function currentSearch() {
  return typeof window === "undefined" ? "" : window.location.search;
}

export function readQuery(keys, search = currentSearch()) {
  const params = new URLSearchParams(search);
  return Object.fromEntries(keys.map((key) => [key, params.get(key) ?? ""]));
}

export function queryDate(value, fallback = "") {
  return isoDatePattern.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) ? value : fallback;
}

export function queryMonth(value, fallback = "") {
  return monthPattern.test(value) && Number(value.slice(5)) >= 1 && Number(value.slice(5)) <= 12 ? value : fallback;
}

export function queryChoice(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

export function queryInteger(value, { min = -Infinity, max = Infinity, fallback } = {}) {
  const number = Number(value);
  return value !== "" && Number.isInteger(number) && number >= min && number <= max ? number : fallback;
}

// Rewrites only the managed keys: empty values and values equal to their default are removed to keep URLs short.
export function buildSearch(search, values, defaults = {}) {
  const params = new URLSearchParams(search);
  for (const [key, value] of Object.entries(values)) {
    const text = value === null || value === undefined ? "" : String(value);
    if (text === "" || text === String(defaults[key] ?? "")) params.delete(key);
    else params.set(key, text);
  }
  return params.toString();
}

export function useQuerySync(values, defaults = {}) {
  const signature = JSON.stringify(values);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const next = buildSearch(window.location.search, values, defaults);
    if (next === window.location.search.replace(/^\?/, "")) return;
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${next ? `?${next}` : ""}${window.location.hash}`);
  }, [signature]);
}
