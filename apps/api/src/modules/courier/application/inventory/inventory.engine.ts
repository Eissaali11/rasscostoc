/**
 * InventoryEngine
 *
 * Sole responsibility: execute inventory deduction operations.
 *
 * Rules:
 * - Knows NOTHING about courier requests, workflow decisions, or installation statuses.
 * - Depends on IGeneralInventoryRepository and ISerializedInventoryRepository (interfaces).
 * - Never throws on partial failures — records errors in DeductionResult.
 * - Is the ONLY place where inventory deduction orchestration lives.
 *
 * Dependencies are injected via static factory — concrete adapters live in /infrastructure/adapters/.
 */

import type { IGeneralInventoryRepository } from "./IGeneralInventoryRepository";
import type { ISerializedInventoryRepository } from "./ISerializedInventoryRepository";
import type { DeductionContext, DeductionResult } from "./inventory.engine.types";
import { SerialRecognitionService } from "@core/serial/serial-recognition.service";
import type { ICourierInventoryPort } from "../../domain/repositories/ICourierInventoryPort";

export class InventoryEngine {
  constructor(
    private readonly generalInventory: IGeneralInventoryRepository,
    private readonly serializedInventory: ISerializedInventoryRepository,
    private readonly inventoryPort: ICourierInventoryPort
  ) {}

  /**
   * Execute a full inventory deduction for a completed courier execution.
   */
  async deduct(ctx: DeductionContext): Promise<DeductionResult> {
    const result: DeductionResult = {
      requestId: ctx.requestId,
      generalInventoryDeducted: false,
      custodyItemsDeducted: [],
      errors: [],
    };

    // Prefer serial owner as technician identity (assignment names are unreliable)
    const resolved = await this.resolveTechnician(ctx);
    if (resolved) {
      ctx.technicianCode = resolved.username;
      (ctx as any).technicianId = resolved.id;
    }

    // v3 custody (items + moving sync via scanOut) is authoritative.
    // Run it first so serials leave active custody and counters drop once.
    await this.deductSerializedCustody(ctx, result);

    // Legacy general pool only for device SNs that were NOT deducted via custody scan-out
    // (avoids double-decrement of technician_moving_inventory_entries).
    const deducted = new Set(
      result.custodyItemsDeducted.map((s) => s.trim().toLowerCase())
    );
    const remainingDevices = ctx.devices.filter(
      (d) => !deducted.has(d.serialNumber.trim().toLowerCase())
    );
    if (remainingDevices.length > 0) {
      await this.deductGeneralInventory(
        { ...ctx, devices: remainingDevices },
        result
      );
    }

    return result;
  }

  /**
   * Resolve technician: 1) owner of first serial in custody list, 2) username/fullName/code match.
   */
  async resolveTechnician(
    ctx: DeductionContext
  ): Promise<{ id: string; username: string; fullName: string } | null> {
    for (const serial of ctx.serialsForCustody) {
      if (!serial?.trim()) continue;
      const candidates = await SerialRecognitionService.buildStoredSerialCandidates(serial);
      if (candidates.length === 0) continue;

      let item: any = null;
      for (const candidate of candidates) {
        const found = await this.inventoryPort.findItemBySerial(candidate);
        if (found) {
          item = found;
          break;
        }
      }

      if (item?.currentOwnerId) {
        const tech = await this.inventoryPort.findUserById(item.currentOwnerId);
        if (tech) return tech;
      }
    }

    const code = ctx.technicianCode?.trim();
    if (!code) return null;

    const techUser = await this.inventoryPort.findUserByCodeOrUsername(code);
    return techUser ?? null;
  }

  private async deductGeneralInventory(
    ctx: DeductionContext,
    result: DeductionResult
  ): Promise<void> {
    if (ctx.devices.length === 0) return;

    try {
      const actor = await this.inventoryPort.findUserById(ctx.actorId);

      await this.generalInventory.deductTechnicianInventory({
        technicianCode: ctx.technicianCode,
        devices: ctx.devices,
        notes: ctx.notes ?? `خصم تلقائي — طلب رقم: ${ctx.requestId}`,
        actor: {
          id: ctx.actorId,
          username: actor?.username ?? "system",
          role: actor?.role ?? "admin",
          regionId: actor?.regionId ? String(actor.regionId) : null,
        },
      });

      result.generalInventoryDeducted = true;
    } catch (err: any) {
      result.errors.push(`[InventoryEngine] General deduction failed: ${err.message}`);
    }
  }

  private async deductSerializedCustody(
    ctx: DeductionContext,
    result: DeductionResult
  ): Promise<void> {
    if (ctx.serialsForCustody.length === 0) return;

    const techId = (ctx as any).technicianId as string | undefined;
    let techUserId = techId;

    if (!techUserId) {
      const resolved = await this.resolveTechnician(ctx);
      techUserId = resolved?.id;
      if (resolved) ctx.technicianCode = resolved.username;
    }

    if (!techUserId) {
      result.errors.push(
        `[InventoryEngine] Technician "${ctx.technicianCode}" not found for custody ScanOut.`
      );
      return;
    }

    for (const serial of ctx.serialsForCustody) {
      try {
        const deducted = await this.serializedInventory.scanOut(
          techUserId,
          serial,
          ctx.customerName,
          ctx.referenceNumber
        );

        if (deducted) {
          result.custodyItemsDeducted.push(serial);
        } else {
          result.errors.push(
            `[InventoryEngine] ScanOut skipped for "${serial}" — not found in technician active custody.`
          );
        }
      } catch (err: any) {
        result.errors.push(`[InventoryEngine] ScanOut failed for "${serial}": ${err.message}`);
      }
    }
  }
}
