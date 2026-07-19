import { CourierService } from "../application/courier.service";
import { CourierController } from "../presentation/controllers/courier.controller";
import { DrizzleCourierRepository } from "../infrastructure/repositories/drizzle-courier.repository";
import { DrizzleCourierUnitOfWork } from "../infrastructure/repositories/DrizzleCourierUnitOfWork";
import { jobsRegistry } from "@core/jobs/jobs.registry";
import { streamExportWorkbook } from "../application/excel.helper";
import type { ResultMetadata } from "@core/jobs/jobs.types";
import fs from "fs";
import path from "path";
import { InventoryEngine } from "../application/inventory/inventory.engine";
import { DevicesServiceAdapter } from "../infrastructure/adapters/DevicesServiceAdapter";
import { SerializedItemsAdapter } from "../infrastructure/adapters/SerializedItemsAdapter";
import { CourierInventoryPortAdapter } from "@server/composition/courier-inventory.adapter";

let isInitialized = false;
let courierControllerInstance: CourierController | null = null;

export function registerCourierJobHandlers(requestsRepo: DrizzleCourierRepository): void {
  jobsRegistry.register("EXPORT_EXCEL", async (job, updateProgress) => {
    const payload = job.payload ? JSON.parse(job.payload) : {};
    const filters = payload.filters || {};

    await updateProgress(5, {
      processedRows: 0,
      totalRows: 0,
      currentStep: "Reading"
    });

    const total = await requestsRepo.countRequests(filters);

    await updateProgress(10, {
      processedRows: 0,
      totalRows: total,
      currentStep: "Filtering"
    });

    const tempDir = path.join(process.cwd(), "uploads", "exports");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    const filePath = path.join(tempDir, `export-${job.id}.xlsx`);

    let processed = 0;
    const startTime = Date.now();

    const fetchBatch = async (offset: number, limit: number) => {
      const rows = await requestsRepo.listRequestsForExportPaged(filters, offset, limit);
      processed += rows.length;

      let etaSeconds: number | undefined;
      if (processed > 0 && total > 0) {
        const elapsedMs = Date.now() - startTime;
        const rate = processed / elapsedMs;
        const remainingRows = total - processed;
        etaSeconds = Math.round(remainingRows / (rate * 1000));
      }

      if (total > 0) {
        const pct = Math.min(95, 10 + Math.round((processed / total) * 85));
        await updateProgress(pct, {
          processedRows: processed,
          totalRows: total,
          etaSeconds,
          currentStep: "Streaming"
        });
      }
      return rows;
    };

    await streamExportWorkbook(filePath, fetchBatch);

    await updateProgress(98, {
      processedRows: total,
      totalRows: total,
      currentStep: "Compressing"
    });

    const stats = fs.statSync(filePath);
    const resultMeta: ResultMetadata = {
      url: filePath,
      size: stats.size,
      mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    };

    await updateProgress(100, {
      processedRows: total,
      totalRows: total,
      currentStep: "Completed"
    });

    return resultMeta;
  });
}

export function bootstrapCourierModule(): CourierController {
  if (isInitialized && courierControllerInstance) {
    return courierControllerInstance;
  }

  const repository = new DrizzleCourierRepository();
  const inventoryPort = new CourierInventoryPortAdapter(repository);
  const uow = new DrizzleCourierUnitOfWork();
  const service = new CourierService(
    uow,
    repository,
    repository,
    repository,
    repository,
    inventoryPort
  );

  registerCourierJobHandlers(repository);

  courierControllerInstance = new CourierController(service);
  isInitialized = true;

  return courierControllerInstance;
}

export function createInventoryEngine(): InventoryEngine {
  const repository = new DrizzleCourierRepository();
  return new InventoryEngine(
    new DevicesServiceAdapter(),
    new SerializedItemsAdapter(),
    new CourierInventoryPortAdapter(repository)
  );
}
