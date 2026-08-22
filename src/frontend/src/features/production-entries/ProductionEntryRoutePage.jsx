import React from "react";
import { ProductionEntryListPage } from "./ProductionEntryListPage.jsx";
import { ProductionAttendanceWorkspace } from "./ProductionAttendanceWorkspace.jsx";

export function ProductionEntryRoutePage(props) {
  if (props.session?.role === "Worker") return <ProductionEntryListPage {...props} />;
  return <ProductionAttendanceWorkspace {...props} />;
}
