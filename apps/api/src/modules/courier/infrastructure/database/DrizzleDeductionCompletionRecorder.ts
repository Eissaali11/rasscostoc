/**
 * DrizzleDeductionCompletionRecorder
 *
 * OPS-REMED-E4-P2 — infrastructure adapter for IDeductionCompletionRecorder.
 * Same isolation discipline as DrizzleInventoryTransactionRunner: this is
 * the only file in the completion-recording path permitted to know about
 * the concrete Drizzle transaction type and the inventoryDeductionCompletions
 * table, via unwrapInventoryTransactionContext (infrastructure-only helper).
 */
import { inventoryDeductionCompletions } from "@shared/schema";
import type {
  IDeductionCompletionRecorder,
  InventoryTransactionContext,
} from "../../application/inventory/inventory.engine.types";
import { unwrapInventoryTransactionContext } from "./DrizzleInventoryTransactionRunner";

export class DrizzleDeductionCompletionRecorder implements IDeductionCompletionRecorder {
  async recordCompletion(
    ctx: InventoryTransactionContext,
    record: {
      requestId: number;
      sourceEventId: string;
      generalInventoryDeducted: boolean;
      serializedItemCount: number;
    }
  ): Promise<void> {
    const tx = unwrapInventoryTransactionContext(ctx);
    await tx.insert(inventoryDeductionCompletions).values({
      requestId: record.requestId,
      sourceEventId: record.sourceEventId,
      generalInventoryDeducted: record.generalInventoryDeducted,
      serializedItemCount: record.serializedItemCount,
    });
  }
}
