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
import { users, items } from "@shared/schema";
import { eq, or, inArray } from "drizzle-orm";
import type { IGeneralInventoryRepository } from "./IGeneralInventoryRepository";
import type { ISerializedInventoryRepository } from "./ISerializedInventoryRepository";
import type { DeductionContext, DeductionResult } from "./inventory.engine.types";
import { SerialRecognitionService } from "@core/serial/serial-recognition.service";

export class InventoryEngine {
  constructor(
    private readonly generalInventory: IGeneralInventoryRepository,
    private readonly serializedInventory: ISerializedInventoryRepository
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
    const resolved = await InventoryEngine.resolveTechnician(ctx);
    if (resolved) {
      ctx.technicianCode = resolved.username;
      (ctx as any).technicianId = resolved.id;
    }

    await this.deductGeneralInventory(ctx, result);
    await this.deductSerializedCustody(ctx, result);

    return result;
  }

  /**
   * Resolve technician: 1) owner of first serial in custody list, 2) username/fullName/code match.
   */
  static async resolveTechnician(
    ctx: DeductionContext
  ): Promise<{ id: string; username: string; fullName: string } | null> {
    for (const serial of ctx.serialsForCustody) {
      if (!serial?.trim()) continue;
      const candidates = await SerialRecognitionService.buildStoredSerialCandidates(serial);
      if (candidates.length === 0) continue;
      const [item] = await db
        .select({ currentOwnerId: items.currentOwnerId })
        .from(items)
        .where(inArray(items.serialNumber, candidates))
        .limit(1);
      if (item?.currentOwnerId) {
        const [tech] = await db
          .select({ id: users.id, username: users.username, fullName: users.fullName })
          .from(users)
          .where(eq(users.id, item.currentOwnerId))
          .limit(1);
        if (tech) return tech;
      }
    }

    const code = ctx.technicianCode?.trim();
    if (!code) return null;

    const [techUser] = await db
      .select({ id: users.id, username: users.username, fullName: users.fullName })
      .from(users)
      .where(
        or(
          eq(users.username, code),
          eq(users.fullName, code),
          eq(users.technicianCode, code)
        )
      )
      .limit(1);

    return techUser ?? null;
  }

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

    const techId = (ctx as any).technicianId as string | undefined;
    let techUserId = techId;

    if (!techUserId) {
      const resolved = await InventoryEngine.resolveTechnician(ctx);
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
        }
      } catch (err: any) {
        result.errors.push(`[InventoryEngine] ScanOut failed for "${serial}": ${err.message}`);
      }
    }
  }

  static createDefault(): InventoryEngine {
    const { DevicesServiceAdapter } = require("../../infrastructure/adapters/DevicesServiceAdapter");
    const { SerializedItemsAdapter } = require("../../infrastructure/adapters/SerializedItemsAdapter");
    return new InventoryEngine(
      new DevicesServiceAdapter(),
      new SerializedItemsAdapter()
    );
  }
}
