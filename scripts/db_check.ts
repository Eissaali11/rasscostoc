import 'dotenv/config';
import { db, pool } from "../apps/api/src/core/config/db";
import { items, users, itemTypes } from "../packages/shared-types/schema";

async function checkDb() {
  try {
    console.log("=== SIMPLE DB CHECK ===");
    
    // 1. Get all users
    const allUsers = await db.select().from(users);
    console.log("\nUsers:");
    console.log(JSON.stringify(allUsers.map(u => ({ id: u.id, name: u.fullName, role: u.role, username: u.username })), null, 2));

    // 2. Get all item types
    const allItemTypes = await db.select().from(itemTypes);
    console.log("\nItem Types:");
    console.log(JSON.stringify(allItemTypes.map(t => ({ id: t.id, nameAr: t.nameAr, category: t.category, requiresSerial: t.requiresSerial })), null, 2));

    // 3. Get all items
    const allItems = await db.select().from(items);
    console.log(`\nItems (Total: ${allItems.length}):`);
    console.log(JSON.stringify(allItems.map(item => ({
      id: item.id,
      serialNumber: item.serialNumber,
      status: item.status,
      currentOwnerId: item.currentOwnerId,
      itemTypeId: item.itemTypeId,
      carrierName: item.carrierName
    })), null, 2));

  } catch (error) {
    console.error("Error checking db:", error);
  } finally {
    await pool.end();
  }
}

checkDb();
