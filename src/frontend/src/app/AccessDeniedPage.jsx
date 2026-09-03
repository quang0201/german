import React from "react";
import { Alert } from "../components/erp/Alert.jsx";

export function AccessDeniedPage() {
  return <Alert variant="warning" title="Không có quyền truy cập">Tài khoản của bạn không được phép mở màn hình này.</Alert>;
}
