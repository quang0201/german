export function mobileFilterPanelReducer(isOpen, action) {
  switch (action) {
    case "toggle":
      return !isOpen;
    case "close":
    case "apply":
    case "reset":
      return false;
    default:
      return isOpen;
  }
}
