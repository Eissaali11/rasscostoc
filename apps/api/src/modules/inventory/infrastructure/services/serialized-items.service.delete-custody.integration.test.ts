import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { pool } from "@core/config/db";
import { serializedItemsService } from "./serialized-items.service";

/**
 * TEMPORARY FEATURE — remove or disable after final customer handover.
 *
 * Real-database integration test (no mocks) for deleteFromTechnicianCustody.
 * All fixtures are created with obviously-fake, test-only identifiers and are
 * fully removed in afterAll. This test never reads, modifies, or deletes any
 * pre-existing row — it only touches rows it creates itself in beforeAll.
 */
describe("SerializedItemsService.deleteFromTechnicianCustody — real database integration", () => {
  let techAId: string;
  let techBId: string;
  let itemTypeId: string;
  let itemAId: string;
  let itemBId: string;

  const SERIAL_A = "TESTCUSTODYDELA0001";
  const SERIAL_B = "TESTCUSTODYDELB0002";

  beforeAll(async () => {
    const itemTypeRes = await pool.query(
      `SELECT id FROM item_types WHERE category = 'devices' LIMIT 1`
    );
    if (itemTypeRes.rows.length === 0) {
      throw new Error("Test setup requires at least one existing item_type with category='devices'");
    }
    itemTypeId = itemTypeRes.rows[0].id;

    const techA = await pool.query(
      `INSERT INTO users (username, email, password, full_name, role)
       VALUES ($1, $2, $3, $4, 'technician') RETURNING id`,
      ["custody_delete_test_tech_a", "custody-delete-test-tech-a@example.invalid", "test-fixture-hash", "Custody Delete Test A"]
    );
    techAId = techA.rows[0].id;

    const techB = await pool.query(
      `INSERT INTO users (username, email, password, full_name, role)
       VALUES ($1, $2, $3, $4, 'technician') RETURNING id`,
      ["custody_delete_test_tech_b", "custody-delete-test-tech-b@example.invalid", "test-fixture-hash", "Custody Delete Test B"]
    );
    techBId = techB.rows[0].id;

    const itemA = await pool.query(
      `INSERT INTO items (item_type_id, serial_number, barcode, status, current_owner_id)
       VALUES ($1, $2, $2, 'RECEIVED_BY_TECHNICIAN', $3) RETURNING id`,
      [itemTypeId, SERIAL_A, techAId]
    );
    itemAId = itemA.rows[0].id;

    const itemB = await pool.query(
      `INSERT INTO items (item_type_id, serial_number, barcode, status, current_owner_id)
       VALUES ($1, $2, $2, 'RECEIVED_BY_TECHNICIAN', $3) RETURNING id`,
      [itemTypeId, SERIAL_B, techBId]
    );
    itemBId = itemB.rows[0].id;

    // Seed one history log row for item A so we can prove the cascade genuinely
    // fires on real delete (not just assumed from the schema).
    await pool.query(
      `INSERT INTO item_history_logs (item_id, from_status, to_status, changed_by_id, notes)
       VALUES ($1, 'NONE', 'RECEIVED_BY_TECHNICIAN', $2, 'custody-delete integration test fixture')`,
      [itemAId, techAId]
    );

    // Seed a moving-inventory balance for technician A so we can prove the
    // real decrement (1 -> 0) rather than trusting the mocked unit tests alone.
    await pool.query(
      `INSERT INTO technician_moving_inventory_entries (technician_id, item_type_id, units, boxes)
       VALUES ($1, $2, 1, 0)`,
      [techAId, itemTypeId]
    );
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM system_logs WHERE entity_id IN ($1, $2)`, [itemAId, itemBId]);
    await pool.query(`DELETE FROM technician_moving_inventory_entries WHERE technician_id IN ($1, $2)`, [techAId, techBId]);
    await pool.query(`DELETE FROM custody_movements WHERE item_id IN ($1, $2)`, [itemAId, itemBId]);
    await pool.query(`DELETE FROM item_history_logs WHERE item_id IN ($1, $2)`, [itemAId, itemBId]);
    await pool.query(`DELETE FROM inventory_transactions WHERE item_id IN ($1, $2)`, [itemAId, itemBId]);
    await pool.query(`DELETE FROM items WHERE id IN ($1, $2)`, [itemAId, itemBId]);
    await pool.query(`DELETE FROM users WHERE id IN ($1, $2)`, [techAId, techBId]);
  });

  it("blocks technician A from deleting technician B's real item — 403, item still exists afterward", async () => {
    await expect(
      serializedItemsService.deleteFromTechnicianCustody(
        techAId,
        "custody_delete_test_tech_a",
        "technician",
        "DEVICE",
        SERIAL_B,
        SERIAL_B
      )
    ).rejects.toMatchObject({ statusCode: 403, code: "ITEM_NOT_IN_YOUR_CUSTODY" });

    const stillThere = await pool.query(`SELECT id FROM items WHERE id = $1`, [itemBId]);
    expect(stillThere.rows.length).toBe(1);
  });

  it("genuinely deletes technician A's own item, cascades real history, decrements the real balance, and writes a real audit row", async () => {
    const result = await serializedItemsService.deleteFromTechnicianCustody(
      techAId,
      "custody_delete_test_tech_a",
      "technician",
      "DEVICE",
      SERIAL_A,
      SERIAL_A
    );
    expect(result).toMatchObject({ itemType: "DEVICE", deleted: true, alreadyDeleted: false });

    const itemRow = await pool.query(`SELECT id FROM items WHERE id = $1`, [itemAId]);
    expect(itemRow.rows.length).toBe(0);

    const historyRow = await pool.query(`SELECT id FROM item_history_logs WHERE item_id = $1`, [itemAId]);
    expect(historyRow.rows.length).toBe(0);

    const balanceRow = await pool.query(
      `SELECT units FROM technician_moving_inventory_entries WHERE technician_id = $1 AND item_type_id = $2`,
      [techAId, itemTypeId]
    );
    expect(balanceRow.rows[0].units).toBe(0);

    const auditRow = await pool.query(
      `SELECT details FROM system_logs WHERE entity_id = $1 AND action = 'delete_custody_serial'`,
      [itemAId]
    );
    expect(auditRow.rows.length).toBe(1);
    const details = typeof auditRow.rows[0].details === 'string' ? JSON.parse(auditRow.rows[0].details) : auditRow.rows[0].details;
    expect(details.itemType).toBe("DEVICE");
    expect(details.serialNumber).toBe(SERIAL_A);
    expect(details.deletedRelationCounts?.itemHistoryLogs ?? 1).toBe(1);
  });

  it("is idempotent against the real database: retrying after success reports alreadyDeleted, no duplicate audit row", async () => {
    const result = await serializedItemsService.deleteFromTechnicianCustody(
      techAId,
      "custody_delete_test_tech_a",
      "technician",
      "DEVICE",
      SERIAL_A,
      SERIAL_A
    );
    expect(result).toEqual({
      itemType: "DEVICE",
      serialNumber: SERIAL_A,
      deleted: true,
      alreadyDeleted: true,
    });

    const auditRows = await pool.query(
      `SELECT id FROM system_logs WHERE entity_id = $1 AND action = 'delete_custody_serial'`,
      [itemAId]
    );
    expect(auditRows.rows.length).toBe(1); // still exactly one — no duplicate
  });
});
