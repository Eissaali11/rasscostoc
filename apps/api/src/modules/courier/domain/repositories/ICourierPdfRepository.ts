import type { CourierPdfReport, PdfReportFilters } from "../courier.types";

export interface ICourierPdfRepository {
  findPdfReportById(id: number, tx?: any): Promise<CourierPdfReport | null>;
  listPdfReports(filters?: PdfReportFilters, tx?: any): Promise<CourierPdfReport[]>;
  insertPdfReport(data: any, tx?: any): Promise<CourierPdfReport>;
  updatePdfReport(id: number, data: any, tx?: any): Promise<CourierPdfReport>;
}

