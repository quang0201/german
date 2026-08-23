import React from "react";
import { ProductionEntryListPage } from "./ProductionEntryListPage.jsx";
import { ProductionEntryManagerMatrixPage } from "./ProductionEntryManagerMatrixPage.jsx";

export function ProductionEntryRoutePage(props) {
  if (props.session?.role === "Worker") return <ProductionEntryListPage {...props} />;
  return <ProductionEntryManagerMatrixPage {...props} />;
}
