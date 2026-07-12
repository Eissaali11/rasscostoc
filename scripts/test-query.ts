import 'dotenv/config';
import { db, pool } from "../apps/api/src/core/config/db";
import { items, itemTypes } from "../packages/shared-types/schema";
import { eq, and, inArray } from "drizzle-orm";

async function testQuery() {
  try {
    const technicianId = '3a3a93f7-cf9a-4f90-8124-424a117e1957';
    const matched = await db
      .select({
        id: items.id,
        serialNumber: items.serialNumber,
        barcode: items.barcode,
        status: items.status,
        itemTypeId: items.itemTypeId,
        carrierName: items.carrierName,
        createdAt: items.createdAt,
        itemTypeName: itemTypes.nameAr,
        itemTypeCategory: itemTypes.category,
      })
      .from(items)
      .leftJoin(itemTypes, eq(items.itemTypeId, itemTypes.id))
      .where(
        and(
          eq(items.currentOwnerId, technicianId),
          inArray(items.status, ['RECEIVED_BY_TECHNICIAN', 'IN_TRANSIT_CUSTODY']),
        )
      )
      .orderBy(items.createdAt);

    console.log("Query Results:");
    console.log(JSON.stringify(matched, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}
testQuery();
