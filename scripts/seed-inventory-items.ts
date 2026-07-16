import { db } from "../apps/api/src/core/config/db";
import { items, itemTypes, users, warehouses } from "@shared/schema";
import { eq } from "drizzle-orm";

async function run() {
  console.log("Fetching item types from catalog...");
  const types = await db.select().from(itemTypes);

  const posType = types.find(t => t.category?.toLowerCase() === "devices" || t.id.toLowerCase().includes("pos")) || types[0];
  const simType = types.find(t => t.category?.toLowerCase() === "sim" || t.id.toLowerCase().includes("sim")) || types[1] || types[0];

  console.log("Using POS Type:", posType.id, "and SIM Type:", simType.id);

  console.log("Fetching warehouse...");
  const whs = await db.select().from(warehouses).limit(1);
  const warehouseId = whs[0]?.id || null;
  console.log("Warehouse ID:", warehouseId);

  console.log("Fetching all users...");
  const allUsers = await db.select().from(users);
  console.log("Users available:", allUsers.map(u => ({ id: u.id, username: u.username, role: u.role })));

  const tech = allUsers.find(u => u.role === "technician" || u.username === "tech1") || allUsers[0];
  if (!tech) {
    console.error("No users found at all in the database!");
    process.exit(1);
  }
  console.log("Selected User for Custody:", tech.username, "ID:", tech.id);

  const serials = [
    { sn: "NCD100257784", type: "pos" },
    { sn: "NCD100257785", type: "pos" },
    { sn: "NCD100257786", type: "pos" },
    { sn: "8996000000001234567", type: "sim" },
    { sn: "8996000000001234568", type: "sim" },
    { sn: "8996000000001234569", type: "sim" }
  ];

  for (const s of serials) {
    const typeId = s.type === "pos" ? posType.id : simType.id;
    // Check if item exists
    const [existing] = await db.select().from(items).where(eq(items.serialNumber, s.sn)).limit(1);
    
    if (existing) {
      await db.update(items)
        .set({
          status: "IN_TRANSIT", // In transit to technician or active custody
          currentOwnerId: tech.id,
          warehouseId: warehouseId,
          updatedAt: new Date()
        })
        .where(eq(items.serialNumber, s.sn));
      console.log(`Updated item: ${s.sn}`);
    } else {
      await db.insert(items).values({
        itemTypeId: typeId,
        serialNumber: s.sn,
        barcode: s.sn,
        status: "IN_TRANSIT",
        currentOwnerId: tech.id,
        warehouseId: warehouseId,
        carrierName: s.type === "sim" ? "STC" : null,
      });
      console.log(`Inserted item: ${s.sn}`);
    }
  }

  console.log("Inventory items seeded successfully!");
}

run().catch(console.error);
