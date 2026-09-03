export function createNavigationState(options = {}) {
  if (options.presentation !== "panel" || !options.backgroundRoute) return null;
  return {
    presentation: "panel",
    backgroundRoute: options.backgroundRoute,
  };
}

export function resolvePresentation(pathname, state) {
  if (state?.presentation === "panel" && state.backgroundRoute && pathname.split("/").length > 2) {
    return "panel";
  }
  return "page";
}

export function navigate(pathname, options = {}) {
  const state = createNavigationState(options);
  window.history.pushState(state, "", pathname);
  window.dispatchEvent(new PopStateEvent("popstate", { state }));
}

export function subscribeToNavigation(listener) {
  function handlePopState(event) {
    listener({ pathname: window.location.pathname, state: event.state });
  }
  window.addEventListener("popstate", handlePopState);
  return () => window.removeEventListener("popstate", handlePopState);
}
