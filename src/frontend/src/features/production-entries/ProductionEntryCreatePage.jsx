import React from "react";
import { navigate } from "../../app/navigation.js";
import { PageHeader } from "../../components/erp/PageHeader.jsx";
import { ProductionEntryDialog } from "./ProductionEntryDialog.jsx";

export function ProductionEntryCreatePage({ session }) {
  return (
    <div className="erp-feature-page">
      <PageHeader title="Nhập sản lượng" description="Nhập sản lượng trong popup." actions={<button type="button" className="erp-button erp-button-secondary" onClick={() => navigate("/production")}>Quay lại</button>} />
      <ProductionEntryDialog open session={session} onClose={() => navigate("/production")} onSaved={() => navigate("/production")} />
    </div>
  );
}
