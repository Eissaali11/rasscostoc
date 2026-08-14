import { describe, expect, it, beforeEach } from "vitest";
import { db } from "../config/db";
import { outboxEvents } from "@shared/schema";
import { outboxRepository } from "./outbox.repository";
import { EventBus } from "../events/event-bus";
import { ExecutionSavedEvent } from "../events/events";

/**
 * ERP-008 Phase 4 — proves getPendingEvents() cannot double-claim the same
 * event under concurrent callers (simulating two OutboxWorker instances in
 * different processes, e.g. under PM2 cluster). Before this phase, the
 * SELECT and UPDATE were two separate unlocked statements; a forced
 * interleaving reliably produced both callers seeing the same row as
 * eligible. Real DB, real transaction, no mocks.
 */
describe("ERP-008 Phase 4 — OutboxRepository.getPendingEvents concurrency safety", () => {
  beforeEach(async () => {
    process.env.NODE_ENV = "production";
    process.env.BYPASS_OUTBOX = "false";
    await db.delete(outboxEvents);
  });

  it("two concurrent claimants never receive the same event", async () => {
    const eventBus = EventBus.getInstance();
    for (let i = 0; i < 5; i++) {
      await eventBus.publish(
        new ExecutionSavedEvent({
          requestId: 500000 + i,
          actorId: "race-fix-actor",
          execution: { status: "completed" },
          request: { id: 500000 + i },
        })
      );
    }

    const [batchA, batchB] = await Promise.all([
      outboxRepository.getPendingEvents(5, "worker-A"),
      outboxRepository.getPendingEvents(5, "worker-B"),
    ]);

    const idsA = batchA.map((e: any) => e.id);
    const idsB = batchB.map((e: any) => e.id);
    const overlap = idsA.filter((id: string) => idsB.includes(id));

    expect(overlap).toEqual([]);
    expect(idsA.length + idsB.length).toBe(5); // all 5 claimed exactly once, across both
  });

  // OPS-REMED-E4-P2-I.R4: 20 real-PostgreSQL rounds x 2 concurrent
  // getPendingEvents() transactions each (40 total round-tripped
  // transactions) measured at 4.3s-4.7s across 10 clean consecutive runs
  // on a fresh disposable container — comfortably under vitest's default
  // 5000ms in isolation, but with too little margin under any real
  // system-load variance (observed 2/5 failures under load in an earlier
  // diagnostic session, always exactly at the 5000ms boundary, never a
  // correctness failure — no overlap, no duplicate/missing claim was ever
  // observed in any run). This explicit timeout adds real margin (max
  // observed duration is ~31% of this bound) while remaining a genuine
  // deadlock/hang detector: a real lock-order regression or a leaked
  // connection would still fail this bound, not silently pass.
  it("repeated concurrent claim attempts (20 rounds) never produce an overlap", async () => {
    const eventBus = EventBus.getInstance();
    for (let i = 0; i < 20; i++) {
      await eventBus.publish(
        new ExecutionSavedEvent({
          requestId: 600000 + i,
          actorId: "race-fix-actor-2",
          execution: { status: "completed" },
          request: { id: 600000 + i },
        })
      );
    }

    const claimedIds = new Set<string>();
    let anyOverlap = false;

    for (let round = 0; round < 20; round++) {
      const [batchA, batchB] = await Promise.all([
        outboxRepository.getPendingEvents(1, `worker-A-r${round}`),
        outboxRepository.getPendingEvents(1, `worker-B-r${round}`),
      ]);
      const idsA = batchA.map((e: any) => e.id);
      const idsB = batchB.map((e: any) => e.id);
      if (idsA.some((id: string) => idsB.includes(id))) anyOverlap = true;
      [...idsA, ...idsB].forEach((id) => claimedIds.add(id));
    }

    expect(anyOverlap).toBe(false);
  }, 15000);
});
