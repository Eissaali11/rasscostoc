import { describe, expect, it, beforeEach } from "vitest";
import { db } from "../config/db";
import { idempotencyRecords } from "@shared/schema";
import { idempotencyService } from "./idempotency.service";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

describe("IdempotencyService Integration Tests", () => {
  beforeEach(async () => {
    // Clear idempotency records before each test
    await db.delete(idempotencyRecords);
  });

  it("should execute callback once and cache the result for duplicate keys", async () => {
    const key = `test-key-${randomUUID()}`;
    const eventId = randomUUID();
    const subscriberName = "TestSubscriber";

    let executionCount = 0;
    const action = async () => {
      executionCount++;
      return { data: "success-response" };
    };

    // 1. First execution
    const firstResult = await idempotencyService.execute(key, eventId, subscriberName, action);
    expect(firstResult).toEqual({ data: "success-response" });
    expect(executionCount).toBe(1);

    // Verify record in database is COMPLETED
    const [record] = await db
      .select()
      .from(idempotencyRecords)
      .where(eq(idempotencyRecords.idempotencyKey, key))
      .limit(1);
    expect(record).toBeDefined();
    expect(record.status).toBe("COMPLETED");

    // 2. Second execution with the same key
    const secondResult = await idempotencyService.execute(key, eventId, subscriberName, action);
    
    // Should return cached result without executing callback again
    expect(secondResult).toEqual({ data: "success-response" });
    expect(executionCount).toBe(1); // Callback remains executed only once!
  });

  it("should prevent concurrent execution of the same key (PROCESSING status)", async () => {
    const key = `test-key-${randomUUID()}`;
    const eventId = randomUUID();
    const subscriberName = "TestSubscriber";

    // Manually insert a PROCESSING record to simulate concurrent run
    await db.insert(idempotencyRecords).values({
      idempotencyKey: key,
      eventId,
      subscriberName,
      status: "PROCESSING",
    });

    const action = async () => {
      return { success: true };
    };

    // Executing with same key should fail with PROCESSING error
    await expect(
      idempotencyService.execute(key, eventId, subscriberName, action)
    ).rejects.toThrow(`Idempotency key ${key} is currently PROCESSING.`);
  });

  it("should allow retry when the previous execution FAILED", async () => {
    const key = `test-key-${randomUUID()}`;
    const eventId = randomUUID();
    const subscriberName = "TestSubscriber";

    let shouldThrow = true;
    let executionCount = 0;

    const action = async () => {
      executionCount++;
      if (shouldThrow) {
        throw new Error("Simulated transient failure");
      }
      return { success: true };
    };

    // 1. First execution fails
    await expect(
      idempotencyService.execute(key, eventId, subscriberName, action)
    ).rejects.toThrow("Simulated transient failure");
    expect(executionCount).toBe(1);

    // Verify database record status is FAILED
    let [record] = await db
      .select()
      .from(idempotencyRecords)
      .where(eq(idempotencyRecords.idempotencyKey, key))
      .limit(1);
    expect(record.status).toBe("FAILED");

    // 2. Second execution (retry) succeeds
    shouldThrow = false;
    const result = await idempotencyService.execute(key, eventId, subscriberName, action);
    expect(result).toEqual({ success: true });
    expect(executionCount).toBe(2);

    // Verify database status is now COMPLETED
    [record] = await db
      .select()
      .from(idempotencyRecords)
      .where(eq(idempotencyRecords.idempotencyKey, key))
      .limit(1);
    expect(record.status).toBe("COMPLETED");
  });
});
