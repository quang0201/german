import React from "react";
import { navigate } from "../../app/navigation.js";
import { ProductionEntryDialog } from "./ProductionEntryDialog.jsx";

export function ProductionEntryCreatePage({ session }) {
  return (
    <div className="erp-feature-page">
      <ProductionEntryDialog open session={session} onClose={() => navigate("/production")} onSaved={() => navigate("/production")} />
    </div>
  );
}
