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

import { db } from "@server/core/config/db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import type { IGeneralInventoryRepository } from "./IGeneralInventoryRepository";
import type { ISerializedInventoryRepository } from "./ISerializedInventoryRepository";
import type { DeductionContext, DeductionResult } from "./inventory.engine.types";

export class InventoryEngine {
  constructor(
    private readonly generalInventory: IGeneralInventoryRepository,
    private readonly serializedInventory: ISerializedInventoryRepository
  ) {}

  /**
   * Execute a full inventory deduction for a completed courier execution.
   *
   * Performs two independent operations:
   *  1. General inventory deduction (device units from technician's general stock).
   *  2. Serialized custody ScanOut (individual items in IN_TRANSIT_CUSTODY).
   *
   * @returns DeductionResult with per-operation outcomes and errors.
   */
  async deduct(ctx: DeductionContext): Promise<DeductionResult> {
    const result: DeductionResult = {
      requestId: ctx.requestId,
      generalInventoryDeducted: false,
      custodyItemsDeducted: [],
      errors: [],
    };

    await this.deductGeneralInventory(ctx, result);
    await this.deductSerializedCustody(ctx, result);

    return result;
  }

  // ─── Private Handlers ──────────────────────────────────────────────────────

  private async deductGeneralInventory(
    ctx: DeductionContext,
    result: DeductionResult
  ): Promise<void> {
    if (ctx.devices.length === 0) return;

    try {
      const [actor] = await db
        .select({ id: users.id, username: users.username, role: users.role, regionId: users.regionId })
        .from(users)
        .where(eq(users.id, ctx.actorId))
        .limit(1);

      await this.generalInventory.deductTechnicianInventory({
        technicianCode: ctx.technicianCode,
        devices: ctx.devices,
        notes: ctx.notes ?? `خصم تلقائي — طلب رقم: ${ctx.requestId}`,
        actor: {
          id: ctx.actorId,
          username: actor?.username ?? "system",
          role: actor?.role ?? "admin",
          regionId: actor?.regionId ?? null,
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

    // Resolve technician ID for custody operations
    const [techUser] = await db
      .select({ id: users.id, username: users.username })
      .from(users)
      .where(eq(users.username, ctx.technicianCode))
      .limit(1);

    if (!techUser) {
      result.errors.push(
        `[InventoryEngine] Technician "${ctx.technicianCode}" not found for custody ScanOut.`
      );
      return;
    }

    for (const serial of ctx.serialsForCustody) {
      try {
        const deducted = await this.serializedInventory.scanOut(
          techUser.id,
          serial,
          ctx.customerName,
          ctx.referenceNumber
        );

        if (deducted) {
          result.custodyItemsDeducted.push(serial);
        }
      } catch (err: any) {
        result.errors.push(`[InventoryEngine] ScanOut failed for "${serial}": ${err.message}`);
      }
    }
  }

  // ─── Static Factory ────────────────────────────────────────────────────────

  /**
   * Create the default InventoryEngine wired with production adapters.
   * Call this from CourierWorkflow or any other consumer.
   */
  static createDefault(): InventoryEngine {
    const { DevicesServiceAdapter } = require("../../infrastructure/adapters/DevicesServiceAdapter");
    const { SerializedItemsAdapter } = require("../../infrastructure/adapters/SerializedItemsAdapter");
    return new InventoryEngine(
      new DevicesServiceAdapter(),
      new SerializedItemsAdapter()
    );
  }
}
