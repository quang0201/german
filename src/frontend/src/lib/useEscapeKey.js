import { useEffect, useRef } from "react";

const openStack = [];

// Only the most recently opened dialog reacts to Escape, so closing a nested dialog never closes its parent.
export function useEscapeKey(active, onClose, disabled = false) {
  const latest = useRef({ onClose, disabled });
  latest.current = { onClose, disabled };

  useEffect(() => {
    if (!active) return undefined;
    const token = {};
    openStack.push(token);
    function handleKeyDown(event) {
      if (event.key !== "Escape" || openStack[openStack.length - 1] !== token) return;
      if (!latest.current.disabled) latest.current.onClose?.();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      const index = openStack.indexOf(token);
      if (index >= 0) openStack.splice(index, 1);
    };
  }, [active]);
}
