import { db } from "@server/core/config/db";
import { drizzleCourierRepository } from "../infrastructure/repositories/drizzle-courier.repository";
import {
  courierRequests,
  courierExecutions,
  courierPdfReports,
  courierCities,
  courierSimTypes,
  courierVendorTypes,
  courierFailureReasons,
  courierAuditLogs,
  users,
  items,
  courierRequestItems,
  inventoryTransactions,
  itemHistoryLogs,
  type CourierRequest,
  type CourierExecution,
  type CourierPdfReport,
  type CourierRequestItem,
  courierExecutionAttempts,
  type CourierExecutionAttempt
} from "@shared/schema";
import { eq, and, or, sql, desc, count, inArray } from "drizzle-orm";
import { devicesContainer } from "@server/composition/devices.container";
import { extractFromPdf } from "./ocr.helper";
import { parseRawDataWorkbook, buildExportWorkbook } from "./excel.helper";
import { CompletionGuard, isCompletedStatus } from "./guards/CompletionGuard";
import { CourierWorkflow } from "./workflow/courier.workflow";
import { EventBus } from "@core/events/event-bus";
import { ExecutionSavedEvent, ExecutionCompletedEvent } from "@core/events/events";
import { AppError, OptimisticLockException, NotFoundError } from "@core/errors/AppError";
import { SerialRecognitionService } from "@core/serial/serial-recognition.service";


export interface ListFilters {
  q?: string;
  city?: string;
  technician?: string;
  status?: string;
  reason?: string;
  simType?: string;
  vendor?: string;
  priority?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export class CourierService {
  async listRequests(filters: ListFilters): Promise<{ rows: any[]; total: number }> {
    return drizzleCourierRepository.listRequests(filters);
  }

  async getRequestById(id: number): Promise<any | null> {
    return drizzleCourierRepository.findRequestWithDetails(id);
  }

  async createRequest(data: any, createdBy: string): Promise<any> {
    const newReq = await drizzleCourierRepository.insertRequest({
      ...data,
      createdBy
    });

    await drizzleCourierRepository.insertAuditLog({
      tableName: "requests",
      recordId: newReq.id,
      action: "create",
      changedBy: createdBy
    });

    return this.getRequestById(newReq.id);
  }

  async updateRequest(id: number, data: any, updatedBy: string): Promise<any> {
    const { version, ...updateFields } = data;

    const updatedReq = await drizzleCourierRepository.updateRequest(id, updateFields, version);

    if (!updatedReq) {
      const exists = await drizzleCourierRepository.findRequestById(id);
      if (exists) {
        throw new OptimisticLockException("courier_requests", id, version, exists.version);
      }
      return null;
    }

    await drizzleCourierRepository.insertAuditLog({
      tableName: "requests",
      recordId: id,
      action: "update",
      changedBy: updatedBy
    });

    return this.getRequestById(id);
  }

  async deleteRequest(id: number, deletedBy: string): Promise<boolean> {
    const success = await drizzleCourierRepository.deleteRequest(id);
    if (!success) return false;

    await drizzleCourierRepository.insertAuditLog({
      tableName: "requests",
      recordId: id,
      action: "delete",
      changedBy: deletedBy
    });

    return true;
  }

  async getRequestItems(requestId: number): Promise<CourierRequestItem[]> {
    return drizzleCourierRepository.findRequestItems(requestId);
  }

  async assignRequestItems(
    requestId: number,
    itemsData: { itemType: string; serialNumber?: string; simSerial?: string; quantity?: number }[],
    actorId: string
  ): Promise<CourierRequestItem[]> {
    const request = await drizzleCourierRepository.findRequestById(requestId);
    if (!request) {
      throw new Error("الطلب غير موجود");
    }

    const newItems = itemsData.map(item => ({
      requestId,
      itemType: item.itemType,
      serialNumber: item.serialNumber || null,
      simSerial: item.simSerial || null,
      quantity: item.quantity ?? 1,
      status: "PENDING_RECEIPT",
    }));

    let result: CourierRequestItem[];
    await db.transaction(async (tx) => {
      // 1. Delete existing items for this request to override/assign fresh
      await tx
        .delete(courierRequestItems)
        .where(eq(courierRequestItems.requestId, requestId));

      // 2. Insert new request items
      result = await drizzleCourierRepository.insertRequestItems(newItems, tx);

      // 3. Create or update execution status to ASSIGNED
      const existingExecution = await drizzleCourierRepository.findExecutionByRequestId(requestId, tx);
      if (existingExecution) {
        await drizzleCourierRepository.updateExecution(
          requestId,
          { installationStatus: "ASSIGNED", enteredBy: actorId },
          existingExecution.version,
          tx
        );
      } else {
        await drizzleCourierRepository.insertExecution({
          requestId,
          installationStatus: "ASSIGNED",
          enteredBy: actorId,
        }, tx);
      }

      // Log Audit
      await drizzleCourierRepository.insertAuditLog({
        tableName: "courier_request_items",
        recordId: requestId,
        action: "assign",
        changedBy: actorId,
      }, tx);
    });

    return result!;
  }

  async acceptRequest(requestId: number, actorId: string): Promise<any> {
    const existingExecution = await drizzleCourierRepository.findExecutionByRequestId(requestId);
    await db.transaction(async (tx) => {
      if (existingExecution) {
        await drizzleCourierRepository.updateExecution(
          requestId,
          { installationStatus: "ACCEPTED", enteredBy: actorId },
          existingExecution.version,
          tx
        );
      } else {
        await drizzleCourierRepository.insertExecution({
          requestId,
          installationStatus: "ACCEPTED",
          enteredBy: actorId,
        }, tx);
      }

      // Auto-create request items if none exist yet (V14 Quantity-only flow)
      const existingItems = await drizzleCourierRepository.findRequestItems(requestId, tx);
      if (existingItems.length === 0) {
        const request = await drizzleCourierRepository.findRequestById(requestId, tx);
        if (request) {
          const itemsToCreate: any[] = [];

          // Infer POS count from installationType (e.g. "POS x2" or default 1)
          const posMatch = String(request.installationType || '').match(/(\d+)/);
          const posCount = posMatch ? parseInt(posMatch[1]) : 1;
          for (let i = 0; i < posCount; i++) {
            itemsToCreate.push({
              requestId,
              itemType: 'POS',
              quantity: 1,
              status: 'PENDING_RECEIPT',
            });
          }

          // Infer SIM count from sim field
          if (request.sim && String(request.sim).trim().length > 0) {
            const simMatch = String(request.sim).match(/(\d+)/);
            const simCount = simMatch ? Math.min(parseInt(simMatch[1]), 10) : 1;
            for (let i = 0; i < simCount; i++) {
              itemsToCreate.push({
                requestId,
                itemType: 'SIM',
                quantity: 1,
                status: 'PENDING_RECEIPT',
              });
            }
          } else {
            // Default: 1 SIM per POS
            for (let i = 0; i < posCount; i++) {
              itemsToCreate.push({
                requestId,
                itemType: 'SIM',
                quantity: 1,
                status: 'PENDING_RECEIPT',
              });
            }
          }

          if (itemsToCreate.length > 0) {
            await drizzleCourierRepository.insertRequestItems(itemsToCreate, tx);
            console.log(`[AcceptRequest] Auto-created ${itemsToCreate.length} request items for request ${requestId}`);
          }
        }
      }

      await drizzleCourierRepository.insertAuditLog({
        tableName: "requests",
        recordId: requestId,
        action: "accept",
        changedBy: actorId,
      }, tx);
    });

    return this.getRequestById(requestId);

  }

  async scanRequestItem(
    requestId: number,
    serial: string,
    actorId: string
  ): Promise<{ success: boolean; message: string; item?: CourierRequestItem }> {
    const candidates = await SerialRecognitionService.buildStoredSerialCandidates(serial);
    if (candidates.length === 0) {
      return { success: false, message: "الرقم التسلسلي فارغ بعد التنظيف" };
    }
    const matchesSerial = (item: CourierRequestItem) => {
      const sn = (item.serialNumber || "").toUpperCase();
      const sim = (item.simSerial || "").toUpperCase();
      return (
        candidates.includes(sn) ||
        candidates.includes(sim) ||
        item.serialNumber === serial ||
        item.simSerial === serial
      );
    };

    // 1. Search inside request items for PENDING_RECEIPT item
    const requestItems = await drizzleCourierRepository.findRequestItems(requestId);
    
    // Find matching item (by serialNumber or simSerial — any equivalent form)
    const matchingItem = requestItems.find(
      item => item.status === "PENDING_RECEIPT" && matchesSerial(item)
    );

    if (matchingItem) {
      // Update item to RECEIVED
      const updated = await drizzleCourierRepository.updateRequestItem(matchingItem.id, {
        status: "RECEIVED",
        scannedAt: new Date(),
        receivedAt: new Date(),
        technicianId: actorId,
      });

      // Update execution status to RECEIVING if not already there
      const execution = await drizzleCourierRepository.findExecutionByRequestId(requestId);
      if (execution && execution.installationStatus !== "RECEIVING") {
        await drizzleCourierRepository.updateExecution(
          requestId,
          { installationStatus: "RECEIVING" },
          execution.version
        );
      }

      return {
        success: true,
        message: "تم استلام ومطابقة الجهاز بنجاح",
        item: updated || undefined,
      };
    }

    // 2. Check if already scanned in this request
    const alreadyScanned = requestItems.find(
      item => item.status === "RECEIVED" && matchesSerial(item)
    );
    if (alreadyScanned) {
      return {
        success: true,
        message: "تم استلام هذا الجهاز مسبقاً",
        item: alreadyScanned,
      };
    }

    // 3. Check if assigned to another active request
    const otherRequestItems = await db
      .select()
      .from(courierRequestItems)
      .where(
        and(
          or(
            inArray(courierRequestItems.serialNumber, candidates),
            inArray(courierRequestItems.simSerial, candidates)
          ),
          eq(courierRequestItems.status, "PENDING_RECEIPT")
        )
      );

    if (otherRequestItems.length > 0) {
      return {
        success: false,
        message: `الجهاز مرتبط بطلب آخر (Request #${otherRequestItems[0].requestId})`,
      };
    }

    return {
      success: false,
      message: "هذا الجهاز غير مخصص لهذا الطلب",
    };
  }

  async confirmReceiving(
    requestId: number,
    actorId: string,
    itemStatuses?: { itemId: number; status: string; serialNumber?: string; simSerial?: string }[],
    sessionMetadata?: any
  ): Promise<any> {
    const requestItems = await drizzleCourierRepository.findRequestItems(requestId);
    if (requestItems.length === 0) {
      throw new Error("لا توجد عناصر مخصصة لهذا الطلب");
    }

    await db.transaction(async (tx) => {
      // 1. Update items in itemStatuses if provided (for progressive receiving)
      if (itemStatuses && itemStatuses.length > 0) {
        // Validate uniqueness of serial numbers in the input list
        const serialsList = itemStatuses
          .map(i => (i.serialNumber || i.simSerial || "").trim())
          .filter(s => s.length > 0);
        const uniqueSerials = new Set(serialsList);
        if (uniqueSerials.size !== serialsList.length) {
          throw new AppError("توجد أرقام تسلسلية مكررة في قائمة التوريد", 400);
        }

        // Also check if any of these serials are already used in this request or another request
        for (const itemStat of itemStatuses) {
          const serial = (itemStat.serialNumber || itemStat.simSerial || "").trim();
          if (serial.length > 0) {
            const [alreadyAssigned] = await tx
              .select()
              .from(courierRequestItems)
              .where(
                and(
                  or(
                    eq(courierRequestItems.serialNumber, serial),
                    eq(courierRequestItems.simSerial, serial)
                  ),
                  eq(courierRequestItems.status, "RECEIVED"),
                  sql`${courierRequestItems.id} != ${itemStat.itemId}`
                )
              )
              .limit(1);

            if (alreadyAssigned) {
              throw new AppError(`الرقم التسلسلي ${serial} مستخدم بالفعل ومستلم في الطلب رقم ${alreadyAssigned.requestId}`, 400);
            }
          }
        }

        for (const itemStat of itemStatuses) {
          const updateFields: any = { status: itemStat.status, updatedAt: new Date() };
          if (itemStat.serialNumber) updateFields.serialNumber = itemStat.serialNumber;
          if (itemStat.simSerial) updateFields.simSerial = itemStat.simSerial;

          await tx
            .update(courierRequestItems)
            .set(updateFields)
            .where(eq(courierRequestItems.id, itemStat.itemId));
        }
      }

      // Re-fetch items inside transaction to get latest statuses
      const latestItems = await tx
        .select()
        .from(courierRequestItems)
        .where(eq(courierRequestItems.requestId, requestId));

      const receivedCount = latestItems.filter(item => item.status === "RECEIVED").length;
      const totalCount = latestItems.length;

      // Determine new execution status
      let newStatus = "RECEIVED";
      if (receivedCount === 0) {
        newStatus = "ACCEPTED";
      } else if (receivedCount < totalCount) {
        newStatus = "PARTIALLY_RECEIVED";
      }

      // Update execution status & store sessionMetadata in extraField1
      const stringifiedMetadata = sessionMetadata ? JSON.stringify(sessionMetadata) : null;
      const existingExecution = await drizzleCourierRepository.findExecutionByRequestId(requestId, tx);
      if (existingExecution) {
        await drizzleCourierRepository.updateExecution(
          requestId,
          { 
            installationStatus: newStatus, 
            enteredBy: actorId, 
            extraField1: stringifiedMetadata 
          },
          existingExecution.version,
          tx
        );
      } else {
        await drizzleCourierRepository.insertExecution({
          requestId,
          installationStatus: newStatus,
          enteredBy: actorId,
          extraField1: stringifiedMetadata,
        }, tx);
      }

      // Fetch request once to resolve device/SIM types if minting is needed
      const [reqData] = await tx
        .select()
        .from(courierRequests)
        .where(eq(courierRequests.id, requestId))
        .limit(1);

      // 2. Transfer Custody / Mint items in Inventory Engine
      for (const item of latestItems) {
        if (item.status === "RECEIVED") {
          const serial = item.serialNumber || item.simSerial;
          if (serial) {
            // Central Serial Engine: resolve existing row by any equivalent serial form
            const invItem = await SerialRecognitionService.findItemBySerial(serial, tx);

            if (invItem) {
              const oldStatus = invItem.status;

              // Update item status & current owner
              await tx
                .update(items)
                .set({
                  status: "RECEIVED_BY_TECHNICIAN",
                  currentOwnerId: actorId,
                  updatedAt: new Date(),
                })
                .where(eq(items.id, invItem.id));

              // Record inventory transaction
              await tx.insert(inventoryTransactions).values({
                itemId: invItem.id,
                transactionType: "TRANSFER",
                destinationOwnerId: actorId,
                orderNumber: requestId.toString(),
                notes: `استلام عهدة بالطلب رقم ${requestId}`,
              });

              // Record item history log
              await tx.insert(itemHistoryLogs).values({
                itemId: invItem.id,
                fromStatus: oldStatus,
                toStatus: "RECEIVED_BY_TECHNICIAN",
                changedById: actorId,
                notes: `تحويل عهدة للفني بالمسح الضوئي - طلب رقم ${requestId}`,
              });
            } else {
              // MINTING: first scan in quantity-only flow — normalize before storage
              let hintItemTypeId = "n950";
              if (item.itemType === "POS") {
                const typeStr = String(reqData?.installationType || "").toLowerCase();
                if (typeStr.includes("9000")) hintItemTypeId = "i9000s";
                else if (typeStr.includes("9100")) hintItemTypeId = "i9100";
                else hintItemTypeId = "n950";
              } else if (item.itemType === "SIM") {
                const simStr = String(reqData?.sim || "").toLowerCase();
                if (simStr.includes("mobily")) hintItemTypeId = "mobilySim";
                else if (simStr.includes("zain")) hintItemTypeId = "zainSim";
                else if (simStr.includes("lebara")) hintItemTypeId = "lebaraSim";
                else hintItemTypeId = "stcSim";
              }

              const stored = await SerialRecognitionService.normalizeForStorage(
                serial,
                hintItemTypeId,
                tx
              );

              // Persist normalized form on request item for downstream deduction/guards
              if (item.serialNumber) {
                await tx
                  .update(courierRequestItems)
                  .set({ serialNumber: stored.normalizedSerial })
                  .where(eq(courierRequestItems.id, item.id));
              } else if (item.simSerial) {
                await tx
                  .update(courierRequestItems)
                  .set({ simSerial: stored.normalizedSerial })
                  .where(eq(courierRequestItems.id, item.id));
              }

              const [newItem] = await tx
                .insert(items)
                .values({
                  itemTypeId: stored.itemTypeId,
                  serialNumber: stored.normalizedSerial,
                  barcode: stored.normalizedSerial,
                  status: "RECEIVED_BY_TECHNICIAN",
                  currentOwnerId: actorId,
                  warehouseId: null,
                  carrierName: stored.carrierName,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                })
                .returning();

              if (newItem) {
                // Record inventory transaction
                await tx.insert(inventoryTransactions).values({
                  itemId: newItem.id,
                  transactionType: "INTAKE",
                  destinationOwnerId: actorId,
                  orderNumber: requestId.toString(),
                  notes: `تسجيل أصل جديد بالمسح الضوئي - طلب رقم ${requestId}`,
                });

                // Record item history log
                await tx.insert(itemHistoryLogs).values({
                  itemId: newItem.id,
                  fromStatus: "NONE",
                  toStatus: "RECEIVED_BY_TECHNICIAN",
                  changedById: actorId,
                  notes: `إنشاء أصل جديد عهدة للفني لأول مرة - طلب رقم ${requestId}`,
                });
              }
            }
          }
        }
      }

      // Log Audit
      await drizzleCourierRepository.insertAuditLog({
        tableName: "requests",
        recordId: requestId,
        action: `confirm_receiving_${newStatus.toLowerCase()}`,
        changedBy: actorId,
      }, tx);
    });

    return this.getRequestById(requestId);
  }

  async startTask(requestId: number, actorId: string): Promise<any> {
    const requestItems = await drizzleCourierRepository.findRequestItems(requestId);
    const execution = await drizzleCourierRepository.findExecutionByRequestId(requestId);

    if (!execution) {
      throw new Error("الطلب غير مستلم بعد أو لا توجد جلسة استلام");
    }

    await db.transaction(async (tx) => {
      // 1. Update execution status to IN_TRANSIT
      await drizzleCourierRepository.updateExecution(
        requestId,
        { installationStatus: "IN_TRANSIT", enteredBy: actorId },
        execution.version,
        tx
      );

      // 2. Transition items from RECEIVED_BY_TECHNICIAN to IN_TRANSIT
      for (const item of requestItems) {
        if (item.status === "RECEIVED") {
          const serial = item.serialNumber || item.simSerial;
          if (serial) {
            const invItem = await SerialRecognitionService.findItemBySerial(serial, tx);

            if (invItem && invItem.status === "RECEIVED_BY_TECHNICIAN") {
              await tx
                .update(items)
                .set({
                  status: "IN_TRANSIT",
                  updatedAt: new Date(),
                })
                .where(eq(items.id, invItem.id));

              await tx.insert(inventoryTransactions).values({
                itemId: invItem.id,
                transactionType: "TRANSFER",
                destinationOwnerId: actorId,
                orderNumber: requestId.toString(),
                notes: `بدء مهمة التوصيل بالطلب رقم ${requestId}`,
              });

              await tx.insert(itemHistoryLogs).values({
                itemId: invItem.id,
                fromStatus: "RECEIVED_BY_TECHNICIAN",
                toStatus: "IN_TRANSIT",
                changedById: actorId,
                notes: `مغادرة المستودع والبدء بالتوصيل - طلب رقم ${requestId}`,
              });
            }
          }
        }
      }

      // Log Audit
      await drizzleCourierRepository.insertAuditLog({
        tableName: "requests",
        recordId: requestId,
        action: "start_task",
        changedBy: actorId,
      }, tx);
    });

    return this.getRequestById(requestId);
  }

  async saveExecution(requestId: number, data: any, enteredBy: string): Promise<any> {
    // Check if execution exists
    const existing = await drizzleCourierRepository.findExecutionByRequestId(requestId);
    const request = await drizzleCourierRepository.findRequestById(requestId);

    if (!request) {
      throw new Error("الطلب غير موجود");
    }

    // ─── Guard Validation Layer ───────────────────────────────────────────────
    // All validation happens here before any DB write.
    // If guards throw GuardValidationError, no execution data is written.
    const techUser = await CompletionGuard.run({
      requestId,
      enteredBy,
      executionData: data,
      request,
      existingExecution: existing ?? null,
    });
    // ─────────────────────────────────────────────────────────────────────────

    const isCompleted = isCompletedStatus(data.installationStatus);

    // Authoritative technician = serial custody owner (never assignment tecName)
    if (techUser && isCompleted) {
      data.technicianCode = techUser.username;
      data.salesTechnician = techUser.fullName;
    }

    let result: any;
    await db.transaction(async (tx) => {
      if (existing) {
        const { version, ...updateFields } = data;
        result = await drizzleCourierRepository.updateExecution(requestId, {
          ...updateFields,
          enteredBy
        }, version, tx);

        if (!result) {
          throw new OptimisticLockException("courier_executions", existing.id, version, existing.version);
        }
      } else {
        result = await drizzleCourierRepository.insertExecution({
          ...data,
          requestId,
          enteredBy
        }, tx);
      }

      // Log audit
      await drizzleCourierRepository.insertAuditLog({
        tableName: "executions",
        recordId: requestId,
        action: existing ? "update" : "create",
        changedBy: enteredBy
      }, tx);

      // Publish ExecutionSavedEvent (inside tx so it is saved to outbox atomically)
      const eventBus = EventBus.getInstance();
      await eventBus.publish(
        new ExecutionSavedEvent({
          requestId,
          actorId: enteredBy,
          execution: result,
          request,
        }),
        tx
      );
    });

    if (!result) {
      throw new Error("Failed to save execution: database returned no rows.");
    }

    // ─── Workflow Engine ──────────────────────────────────────────────────────
    // Called AFTER guards pass and execution is written to DB.
    // The engine decides the action and delegates side effects.
    if (isCompleted) {
      const workflowResult = await CourierWorkflow.execute({
        requestId,
        actorId: enteredBy,
        execution: result,
        request,
      });

      if (workflowResult.sideEffectErrors.length > 0) {
        console.warn(
          `[Workflow] Request ${requestId} completed with side-effect warnings:`,
          workflowResult.sideEffectErrors
        );
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    return this.getRequestById(requestId);
  }

  async getLookups(): Promise<any> {
    return drizzleCourierRepository.getLookups();
  }

  async getDashboardStats(): Promise<any> {
    // Total Requests
    const [totalRes] = await db.select({ count: count() }).from(courierRequests);
    
    // Status distribution
    const statusCounts = await db
      .select({
        status: courierExecutions.installationStatus,
        count: count()
      })
      .from(courierExecutions)
      .groupBy(courierExecutions.installationStatus);

    // Failures reasons distribution
    const failureCounts = await db
      .select({
        reason: courierExecutions.responseReasonCode,
        count: count()
      })
      .from(courierExecutions)
      .where(sql`${courierExecutions.responseReasonCode} IS NOT NULL`)
      .groupBy(courierExecutions.responseReasonCode);

    return {
      totalRequests: totalRes?.count || 0,
      statuses: statusCounts.reduce((acc: any, curr) => {
        if (curr.status) acc[curr.status] = curr.count;
        return acc;
      }, {}),
      failures: failureCounts.reduce((acc: any, curr) => {
        if (curr.reason) acc[curr.reason] = curr.count;
        return acc;
      }, {})
    };
  }

  async getAiMonitorStats(): Promise<any> {
    const [totalReports] = await db.select({ count: count() }).from(courierPdfReports);
    const [appliedReports] = await db.select({ count: count() }).from(courierPdfReports).where(eq(courierPdfReports.status, "applied"));
    
    const [avgConf] = await db
      .select({
        avg: sql<number>`AVG(overall_confidence)`
      })
      .from(courierPdfReports)
      .where(sql`overall_confidence IS NOT NULL`);

    return {
      totalProcessed: totalReports?.count || 0,
      totalApplied: appliedReports?.count || 0,
      averageConfidence: avgConf?.avg ? Math.round(Number(avgConf.avg)) : 0
    };
  }

  async listAuditLogs(): Promise<any[]> {
    return db
      .select({
        id: courierAuditLogs.id,
        tableName: courierAuditLogs.tableName,
        recordId: courierAuditLogs.recordId,
        action: courierAuditLogs.action,
        fieldName: courierAuditLogs.fieldName,
        oldValue: courierAuditLogs.oldValue,
        newValue: courierAuditLogs.newValue,
        changedBy: users.fullName,
        changedAt: courierAuditLogs.changedAt
      })
      .from(courierAuditLogs)
      .leftJoin(users, eq(users.id, courierAuditLogs.changedBy))
      .orderBy(desc(courierAuditLogs.changedAt))
      .limit(100);
  }

  async uploadPdfReport(fileName: string, storedName: string, buffer: Buffer, uploadedBy: string, requestId?: number): Promise<any> {
    let extraction;
    let status = "pending";
    try {
      extraction = await extractFromPdf(buffer);
    } catch (err) {
      status = "failed";
      extraction = { fields: {}, overallConfidence: 0, rawText: (err as Error).message };
    }

    const [newReport] = await db
      .insert(courierPdfReports)
      .values({
        requestId: requestId || null,
        fileName,
        filePath: storedName,
        uploadedBy,
        ocrText: extraction.rawText,
        extractedJson: JSON.stringify(extraction.fields),
        overallConfidence: extraction.overallConfidence,
        status
      })
      .returning();

    return {
      id: newReport.id,
      fields: extraction.fields,
      overallConfidence: extraction.overallConfidence,
      status
    };
  }

  async applyPdfReport(pdfId: number, requestId: number, fields: any, confidence: any, uploadedBy: string): Promise<any> {
    // 1. Get existing execution
    const [existing] = await db
      .select()
      .from(courierExecutions)
      .where(eq(courierExecutions.requestId, requestId))
      .limit(1);

    const merged: Record<string, any> = { ...existing };
    
    // Fields list to copy from PDF
    const execFields = [
      "requestPriorityLevel", "pushBack", "installationStatus", "paperRoll",
      "time", "deliveryDate", "responseDate", "sn", "simSerial", "simType",
      "customerNotes", "extraField1", "extraField2", "responseReasonCode",
      "salesTechnician", "technicianCode"
    ];

    for (const f of execFields) {
      if (f in fields) merged[f] = fields[f];
    }

    let result: any;
    let pdfRequest: any;
    await db.transaction(async (tx) => {
      if (existing) {
        const version = fields.version;
        let whereClause = eq(courierExecutions.requestId, requestId);
        if (version !== undefined) {
          whereClause = and(whereClause, eq(courierExecutions.version, version)) as any;
        }

        [result] = await tx
          .update(courierExecutions)
          .set({
            ...merged,
            extractionConfidence: JSON.stringify(confidence),
            enteredBy: uploadedBy,
            updatedAt: new Date(),
            version: sql`version + 1`
          })
          .where(whereClause)
          .returning();

        if (!result) {
          throw new OptimisticLockException("courier_executions", existing.id, version, existing.version);
        }
      } else {
        [result] = await tx
          .insert(courierExecutions)
          .values({
            requestId,
            ...merged,
            extractionConfidence: JSON.stringify(confidence),
            enteredBy: uploadedBy,
            enteredAt: new Date(),
            updatedAt: new Date()
          })
          .returning();
      }

      // Update PDF status
      await tx
        .update(courierPdfReports)
        .set({
          status: "applied",
          requestId
        })
        .where(eq(courierPdfReports.id, pdfId));

      // Audit log
      await tx.insert(courierAuditLogs).values({
        tableName: "executions",
        recordId: requestId,
        action: existing ? "update" : "create",
        changedBy: uploadedBy,
        changedAt: new Date()
      });

      [pdfRequest] = await tx
        .select()
        .from(courierRequests)
        .where(eq(courierRequests.id, requestId))
        .limit(1);



      // Publish ExecutionSavedEvent (inside tx so it is saved to outbox atomically)
      if (pdfRequest) {
        const eventBus = EventBus.getInstance();
        await eventBus.publish(
          new ExecutionSavedEvent({
            requestId,
            actorId: uploadedBy,
            execution: result,
            request: pdfRequest,
          }),
          tx
        );
      }
    });

    if (!result) {
      throw new Error("Failed to save execution from PDF report: database returned no rows.");
    }

    // ─── Workflow Engine ──────────────────────────────────────────────────────
    const isCompleted = isCompletedStatus(merged.installationStatus);
    if (isCompleted && pdfRequest) {
        const workflowResult = await CourierWorkflow.execute({
          requestId,
          actorId: uploadedBy,
          execution: result,
          request: pdfRequest,
        });

        if (workflowResult.sideEffectErrors.length > 0) {
          console.warn(
            `[Workflow] PDF apply for request ${requestId} completed with warnings:`,
            workflowResult.sideEffectErrors
          );
        }
      }

    return this.getRequestById(requestId);
  }

  async getPdfReports(): Promise<any[]> {
    return db
      .select({
        id: courierPdfReports.id,
        requestId: courierPdfReports.requestId,
        fileName: courierPdfReports.fileName,
        filePath: courierPdfReports.filePath,
        uploadedByName: users.fullName,
        uploadedAt: courierPdfReports.uploadedAt,
        status: courierPdfReports.status,
        overallConfidence: courierPdfReports.overallConfidence
      })
      .from(courierPdfReports)
      .leftJoin(users, eq(users.id, courierPdfReports.uploadedBy))
      .orderBy(desc(courierPdfReports.id))
      .limit(100);
  }

  async getPdfReportById(id: number): Promise<any | null> {
    const [report] = await db
      .select({
        id: courierPdfReports.id,
        requestId: courierPdfReports.requestId,
        fileName: courierPdfReports.fileName,
        filePath: courierPdfReports.filePath,
        uploadedBy: courierPdfReports.uploadedBy,
        uploadedAt: courierPdfReports.uploadedAt,
        status: courierPdfReports.status,
        extractedJson: courierPdfReports.extractedJson,
        overallConfidence: courierPdfReports.overallConfidence
      })
      .from(courierPdfReports)
      .where(eq(courierPdfReports.id, id))
      .limit(1);
    return report || null;
  }

  async importRawRequests(buffer: Buffer, createdBy: string): Promise<any> {
    const summary = parseRawDataWorkbook(buffer);
    const importedList = [];
    const skippedList = [];

    for (const item of summary.imported) {
      const data = item.data;
      // Prevent duplicate TID/Terminal ID
      if (data.tid) {
        const [existing] = await db
          .select()
          .from(courierRequests)
          .where(eq(courierRequests.tid, data.tid))
          .limit(1);
        if (existing) {
          skippedList.push({
            rowNumber: item.rowNumber,
            data,
            error: `TID ${data.tid} already exists.`
          });
          continue;
        }
      }

      const [newRequest] = await db
        .insert(courierRequests)
        .values({
          date: data.date,
          installationType: data.installationType,
          sim: data.sim,
          tid: data.tid,
          otp: data.otp,
          ticketingHolouly: data.ticketingHolouly,
          incidentNumber: data.incidentNumber,
          pinCode: data.pinCode,
          trsm: data.trsm,
          terminalId: data.terminalId,
          simSn: data.simSn,
          idData: data.idData,
          vendorType: data.vendorType,
          city: data.city,
          cityTec: data.cityTec,
          customerName: data.customerName,
          retailerName: data.retailerName,
          addressAr: data.addressAr,
          addressEn: data.addressEn,
          mobile: data.mobile,
          mobile2: data.mobile2,
          tecName: data.tecName,
          createdBy,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();

      importedList.push({ rowNumber: item.rowNumber, id: newRequest.id, tid: newRequest.tid });
    }

    return {
      totalRows: summary.totalRows,
      importedCount: importedList.length,
      rejectedCount: summary.rejected.length,
      skippedCount: skippedList.length,
      rejected: summary.rejected,
      skipped: skippedList,
      imported: importedList
    };
  }

  async exportRequests(filters: ListFilters): Promise<Buffer> {
    const conditions = [];

    if (filters.q) {
      const qLike = `%${filters.q}%`;
      conditions.push(
        or(
          sql`${courierRequests.tid} LIKE ${qLike}`,
          sql`${courierRequests.terminalId} LIKE ${qLike}`,
          sql`${courierRequests.customerName} LIKE ${qLike}`,
          sql`${courierRequests.incidentNumber} LIKE ${qLike}`,
          sql`${courierRequests.mobile} LIKE ${qLike}`,
          sql`${courierExecutions.sn} LIKE ${qLike}`,
          sql`${courierExecutions.simSerial} LIKE ${qLike}`
        )
      );
    }
    if (filters.city) {
      conditions.push(eq(courierRequests.city, filters.city));
    }
    if (filters.technician) {
      conditions.push(eq(courierExecutions.salesTechnician, filters.technician));
    }
    if (filters.status) {
      conditions.push(eq(courierExecutions.installationStatus, filters.status));
    }
    if (filters.reason) {
      conditions.push(eq(courierExecutions.responseReasonCode, filters.reason));
    }
    if (filters.simType) {
      conditions.push(eq(courierExecutions.simType, filters.simType));
    }
    if (filters.vendor) {
      conditions.push(eq(courierRequests.vendorType, filters.vendor));
    }
    if (filters.priority) {
      conditions.push(eq(courierExecutions.requestPriorityLevel, filters.priority));
    }
    if (filters.dateFrom) {
      conditions.push(sql`${courierRequests.date} >= ${filters.dateFrom}`);
    }
    if (filters.dateTo) {
      conditions.push(sql`${courierRequests.date} <= ${filters.dateTo}`);
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select({
        request: courierRequests,
        execution: courierExecutions
      })
      .from(courierRequests)
      .leftJoin(courierExecutions, eq(courierExecutions.requestId, courierRequests.id))
      .where(whereClause)
      .orderBy(desc(courierRequests.id));

    const mappedRows = rows.map((r) => ({
      ...r.request,
      execution: r.execution
    }));

    return buildExportWorkbook(mappedRows);
  }

  async startRoute(requestId: number, actorId: string): Promise<any> {
    return db.transaction(async (tx) => {
      const request = await drizzleCourierRepository.findRequestById(requestId, tx);
      if (!request) throw new NotFoundError("Request not found");

      const execution = await drizzleCourierRepository.findExecutionByRequestId(requestId, tx);
      if (!execution) throw new NotFoundError("Execution not found");

      const updatedExecution = await drizzleCourierRepository.updateExecution(
        requestId,
        {
          installationStatus: "ON_ROUTE",
          updatedAt: new Date()
        },
        execution.version,
        tx
      );

      if (!updatedExecution) {
        throw new OptimisticLockException("courier_executions", execution.id, execution.version);
      }

      await drizzleCourierRepository.insertAuditLog({
        tableName: "courier_executions",
        recordId: execution.id,
        fieldName: "installation_status",
        oldValue: execution.installationStatus,
        newValue: "ON_ROUTE",
        action: "START_ROUTE",
        changedBy: actorId
      }, tx);

      return { success: true, status: "ON_ROUTE" };
    });
  }

  async arriveCustomer(requestId: number, actorId: string): Promise<any> {
    return db.transaction(async (tx) => {
      const request = await drizzleCourierRepository.findRequestById(requestId, tx);
      if (!request) throw new NotFoundError("Request not found");

      const execution = await drizzleCourierRepository.findExecutionByRequestId(requestId, tx);
      if (!execution) throw new NotFoundError("Execution not found");

      const updatedExecution = await drizzleCourierRepository.updateExecution(
        requestId,
        {
          installationStatus: "ARRIVED",
          updatedAt: new Date()
        },
        execution.version,
        tx
      );

      if (!updatedExecution) {
        throw new OptimisticLockException("courier_executions", execution.id, execution.version);
      }

      await drizzleCourierRepository.insertAuditLog({
        tableName: "courier_executions",
        recordId: execution.id,
        fieldName: "installation_status",
        oldValue: execution.installationStatus,
        newValue: "ARRIVED",
        action: "ARRIVE_CUSTOMER",
        changedBy: actorId
      }, tx);

      return { success: true, status: "ARRIVED" };
    });
  }

  async startInstallation(requestId: number, actorId: string): Promise<any> {
    return db.transaction(async (tx) => {
      const request = await drizzleCourierRepository.findRequestById(requestId, tx);
      if (!request) throw new NotFoundError("Request not found");

      const execution = await drizzleCourierRepository.findExecutionByRequestId(requestId, tx);
      if (!execution) throw new NotFoundError("Execution not found");

      const updatedExecution = await drizzleCourierRepository.updateExecution(
        requestId,
        {
          installationStatus: "INSTALLING",
          updatedAt: new Date()
        },
        execution.version,
        tx
      );

      if (!updatedExecution) {
        throw new OptimisticLockException("courier_executions", execution.id, execution.version);
      }

      await drizzleCourierRepository.insertAuditLog({
        tableName: "courier_executions",
        recordId: execution.id,
        fieldName: "installation_status",
        oldValue: execution.installationStatus,
        newValue: "INSTALLING",
        action: "START_INSTALLATION",
        changedBy: actorId
      }, tx);

      return { success: true, status: "INSTALLING" };
    });
  }

  async getExecutionAttempts(requestId: number): Promise<CourierExecutionAttempt[]> {
    return drizzleCourierRepository.findExecutionAttempts(requestId);
  }

  async createExecutionAttempt(
    requestId: number,
    actorId: string,
    data: {
      status: "SUCCESS" | "FAILED";
      failureReasonCode?: string;
      notes?: string;
      snInstalled?: string;
      simInstalled?: string;
      gpsLatitude?: number;
      gpsLongitude?: number;
      batteryLevel?: number;
      networkOperator?: string;
      startTime?: string;
      arrivalTime?: string;
      endTime?: string;
      evidencePhotos?: string[];
      customerSignature?: string;
    }
  ): Promise<any> {
    return db.transaction(async (tx) => {
      const request = await drizzleCourierRepository.findRequestById(requestId, tx);
      if (!request) throw new NotFoundError("Request not found");

      const execution = await drizzleCourierRepository.findExecutionByRequestId(requestId, tx);
      if (!execution) throw new NotFoundError("Execution not found");

      // 1. Determine attempt number
      const existingAttempts = await drizzleCourierRepository.findExecutionAttempts(requestId, tx);
      const attemptNumber = existingAttempts.length + 1;

      // 2. Insert Execution Attempt row
      const attempt = await drizzleCourierRepository.insertExecutionAttempt({
        requestId,
        attemptNumber,
        status: data.status,
        failureReasonCode: data.failureReasonCode || null,
        notes: data.notes || null,
        snInstalled: data.snInstalled || null,
        simInstalled: data.simInstalled || null,
        gpsLatitude: data.gpsLatitude || null,
        gpsLongitude: data.gpsLongitude || null,
        batteryLevel: data.batteryLevel || null,
        networkOperator: data.networkOperator || null,
        startTime: data.startTime ? new Date(data.startTime) : null,
        arrivalTime: data.arrivalTime ? new Date(data.arrivalTime) : null,
        endTime: data.endTime ? new Date(data.endTime) : null,
        evidencePhotos: data.evidencePhotos || null,
        customerSignature: data.customerSignature || null,
        enteredBy: actorId,
      }, tx);

      // 3. Handle attempt status transitions
      if (data.status === "SUCCESS") {
        const finalStatus = "Installation Completed";

        // Update execution with details
        const updatedExecution = await drizzleCourierRepository.updateExecution(
          requestId,
          {
            installationStatus: finalStatus,
            sn: data.snInstalled || execution.sn,
            simSerial: data.simInstalled || execution.simSerial,
            responseReasonCode: null,
            customerNotes: data.notes || execution.customerNotes,
            extraField1: data.evidencePhotos ? JSON.stringify(data.evidencePhotos) : execution.extraField1,
            extraField2: data.customerSignature || execution.extraField2,
            updatedAt: new Date()
          },
          execution.version,
          tx
        );

        if (!updatedExecution) {
          throw new OptimisticLockException("courier_executions", execution.id, execution.version);
        }

        // Update request items status to INSTALLED
        const items = await drizzleCourierRepository.findRequestItems(requestId, tx);
        for (const item of items) {
          if (item.status === "RECEIVED") {
            await drizzleCourierRepository.updateRequestItem(item.id, {
              status: "INSTALLED",
              installedAt: new Date(),
              deliveredAt: new Date(),
            }, tx);
          }
        }

        await drizzleCourierRepository.insertAuditLog({
          tableName: "courier_executions",
          recordId: execution.id,
          fieldName: "installation_status",
          oldValue: execution.installationStatus,
          newValue: finalStatus,
          action: "SUBMIT_EXECUTION_SUCCESS",
          changedBy: actorId
        }, tx);

        // Publish ExecutionCompletedEvent to trigger InventoryEngine auto-deduction
        const eventBus = EventBus.getInstance();
        await eventBus.publish(
          new ExecutionCompletedEvent({
            requestId,
            actorId,
            execution: updatedExecution,
            request,
          })
        );
      } else {
        const finalStatus = data.failureReasonCode || "FAILED_ATTEMPT";

        const updatedExecution = await drizzleCourierRepository.updateExecution(
          requestId,
          {
            installationStatus: finalStatus,
            responseReasonCode: data.failureReasonCode || null,
            customerNotes: data.notes || execution.customerNotes,
            updatedAt: new Date()
          },
          execution.version,
          tx
        );

        if (!updatedExecution) {
          throw new OptimisticLockException("courier_executions", execution.id, execution.version);
        }

        await drizzleCourierRepository.insertAuditLog({
          tableName: "courier_executions",
          recordId: execution.id,
          fieldName: "installation_status",
          oldValue: execution.installationStatus,
          newValue: finalStatus,
          action: "SUBMIT_EXECUTION_FAILURE",
          changedBy: actorId
        }, tx);
      }

      return attempt;
    });
  }
}

