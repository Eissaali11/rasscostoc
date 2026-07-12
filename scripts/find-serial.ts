import 'dotenv/config';
import { db, pool } from "../apps/api/src/core/config/db";
import { items, itemTypes } from "../packages/shared-types/schema";
import { eq } from "drizzle-orm";

async function findSerial() {
  try {
    const matched = await db
      .select({
        id: items.id,
        serialNumber: items.serialNumber,
        status: items.status,
        currentOwnerId: items.currentOwnerId,
        itemTypeId: items.itemTypeId,
        carrierName: items.carrierName,
        itemTypeNameAr: itemTypes.nameAr,
        itemTypeCategory: itemTypes.category,
      })
      .from(items)
      .leftJoin(itemTypes, eq(items.itemTypeId, itemTypes.id))
      .where(eq(items.serialNumber, '8996606099020521804'));
    console.log(JSON.stringify(matched, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}
findSerial();
