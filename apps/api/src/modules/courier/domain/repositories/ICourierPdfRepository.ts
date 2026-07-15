import type { CourierPdfReport } from "../courier.types";

export interface ICourierPdfRepository {
  findPdfReportById(id: number, tx?: any): Promise<CourierPdfReport | null>;
  listPdfReports(tx?: any): Promise<CourierPdfReport[]>;
  insertPdfReport(data: any, tx?: any): Promise<CourierPdfReport>;
  updatePdfReport(id: number, data: any, tx?: any): Promise<CourierPdfReport>;
}

