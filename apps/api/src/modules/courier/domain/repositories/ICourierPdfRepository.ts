import type { CourierPdfReport, PdfReportFilters } from "../courier.types";

export interface ICourierPdfRepository {
  findPdfReportById(id: number, tx?: any): Promise<CourierPdfReport | null>;
  listPdfReports(filters?: PdfReportFilters, tx?: any): Promise<CourierPdfReport[]>;
  insertPdfReport(data: any, tx?: any): Promise<CourierPdfReport>;
  updatePdfReport(id: number, data: any, tx?: any): Promise<CourierPdfReport>;
  /**
   * OPS-REMED-E12 (E1+E2): atomically transitions a pdf_reports row from
   * `expectedStatus` to `newStatus` via `UPDATE ... WHERE status = $expected
   * RETURNING *`. Returns null (never throws) when the row's status was
   * NOT `expectedStatus` at the moment of the update — meaning another
   * concurrent approval/rejection/completion already won the race. No
   * explicit `tx` parameter: when called through a
   * `DrizzleCourierUnitOfWork`-constructed repository instance, the
   * transaction is already bound to the instance via its constructor.
   */
  claimPdfReportForTransition(
    pdfId: number,
    expectedStatus: string,
    newStatus: string
  ): Promise<CourierPdfReport | null>;
}

