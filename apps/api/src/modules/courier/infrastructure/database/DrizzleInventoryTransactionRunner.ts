/**
 * DrizzleInventoryTransactionRunner
 *
 * OPS-REMED-E3 — the ONLY file in the courier/inventory deduction path
 * permitted to know about the concrete Drizzle transaction type. Casts the
 * opaque InventoryTransactionContext to/from the real `tx` object so that
 * every application-layer file (InventoryEngine, ISerializedInventoryRepository,
 * IGeneralInventoryRepository) can remain free of drizzle-orm imports, per
 * .dependency-cruiser.cjs's "application-should-not-depend-on-...-drizzle" rule.
 */
import { db } from "@core/config/db";
import type {
  IInventoryTransactionRunner,
  InventoryTransactionContext,
} from "../../application/inventory/inventory.engine.types";

export class DrizzleInventoryTransactionRunner implements IInventoryTransactionRunner {
  async run<T>(work: (ctx: InventoryTransactionContext) => Promise<T>): Promise<T> {
    return db.transaction(async (tx) => {
      return work(tx as unknown as InventoryTransactionContext);
    });
  }
}

/**
 * Infrastructure-only helper: unwrap the opaque context back to the real
 * Drizzle transaction. Must never be imported outside infrastructure/.
 */
export function unwrapInventoryTransactionContext(
  ctx: InventoryTransactionContext | undefined
): any {
  return ctx as unknown as any;
}
