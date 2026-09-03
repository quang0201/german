import React from "react";
import { Alert } from "../components/erp/Alert.jsx";

export function SessionExpiredPage() {
  return <Alert variant="warning" title="Phiên đăng nhập đã hết hạn">Vui lòng đăng nhập lại để tiếp tục.</Alert>;
}
