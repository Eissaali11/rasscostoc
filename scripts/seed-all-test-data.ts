import { db } from "../apps/api/src/core/config/db";
import { items, itemTypes, users, warehouses, courierRequests, courierRequestItems } from "@shared/schema";
import { eq } from "drizzle-orm";

async function run() {
  console.log("Starting consolidated seeding...");

  // Find a technician user
  const allUsers = await db.select().from(users);
  const techUser = allUsers.find(u => u.role === "technician") || allUsers.find(u => u.username === "tech1") || allUsers[0];
  if (!techUser) {
    console.error("No users found in database!");
    process.exit(1);
  }
  console.log(`Using technician user: ${techUser.username} (ID: ${techUser.id})`);

  // Find item types
  const types = await db.select().from(itemTypes);
  const posType = types.find(t => t.category?.toLowerCase() === "devices" || t.id.toLowerCase().includes("pos")) || types[0];
  const simType = types.find(t => t.category?.toLowerCase() === "sim" || t.id.toLowerCase().includes("sim")) || types[1] || types[0];
  console.log(`Using item types - POS: ${posType.id}, SIM: ${simType.id}`);

  // Find warehouse
  const whs = await db.select().from(warehouses).limit(1);
  const warehouseId = whs[0]?.id || null;
  console.log(`Using warehouse ID: ${warehouseId}`);

  // Seed Inventory items with status "IN_TRANSIT" and owner = techUser
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
    const [existing] = await db.select().from(items).where(eq(items.serialNumber, s.sn)).limit(1);
    
    if (existing) {
      await db.update(items)
        .set({
          status: "IN_TRANSIT",
          currentOwnerId: techUser.id,
          warehouseId: warehouseId,
          updatedAt: new Date()
        })
        .where(eq(items.serialNumber, s.sn));
      console.log(`Updated inventory item: ${s.sn}`);
    } else {
      await db.insert(items).values({
        itemTypeId: typeId,
        serialNumber: s.sn,
        barcode: s.sn,
        status: "IN_TRANSIT",
        currentOwnerId: techUser.id,
        warehouseId: warehouseId,
        carrierName: s.type === "sim" ? "STC" : null,
      });
      console.log(`Inserted inventory item: ${s.sn}`);
    }
  }

  // Seed Request 144 (1 Device)
  const [existing144] = await db.select().from(courierRequests).where(eq(courierRequests.id, 144)).limit(1);
  if (existing144) {
    await db.update(courierRequests)
      .set({
        tid: "15806680",
        customerName: "Rassco Merchant 1",
        tecName: techUser.username,
        createdBy: techUser.id,
      })
      .where(eq(courierRequests.id, 144));
    console.log("Updated request 144");
  } else {
    await db.insert(courierRequests).values({
      id: 144,
      tid: "15806680",
      customerName: "Rassco Merchant 1",
      tecName: techUser.username,
      createdBy: techUser.id,
    });
    console.log("Inserted request 144");
  }
  await db.delete(courierRequestItems).where(eq(courierRequestItems.requestId, 144));
  await db.insert(courierRequestItems).values({
    requestId: 144,
    serialNumber: "NCD100257784",
    simSerial: "8996000000001234567",
    itemType: posType.id,
    status: "IN_TRANSIT_CUSTODY",
  });

  // Seed Request 145 (2 Devices)
  const [existing145] = await db.select().from(courierRequests).where(eq(courierRequests.id, 145)).limit(1);
  if (existing145) {
    await db.update(courierRequests)
      .set({
        tid: "15806681",
        customerName: "Rassco Merchant 2",
        tecName: techUser.username,
        createdBy: techUser.id,
      })
      .where(eq(courierRequests.id, 145));
    console.log("Updated request 145");
  } else {
    await db.insert(courierRequests).values({
      id: 145,
      tid: "15806681",
      customerName: "Rassco Merchant 2",
      tecName: techUser.username,
      createdBy: techUser.id,
    });
    console.log("Inserted request 145");
  }
  await db.delete(courierRequestItems).where(eq(courierRequestItems.requestId, 145));
  await db.insert(courierRequestItems).values([
    {
      requestId: 145,
      serialNumber: "NCD100257784",
      simSerial: "8996000000001234567",
      itemType: posType.id,
      status: "IN_TRANSIT_CUSTODY",
    },
    {
      requestId: 145,
      serialNumber: "NCD100257785",
      simSerial: "8996000000001234568",
      itemType: posType.id,
      status: "IN_TRANSIT_CUSTODY",
    }
  ]);

  // Seed Request 146 (3 Devices)
  const [existing146] = await db.select().from(courierRequests).where(eq(courierRequests.id, 146)).limit(1);
  if (existing146) {
    await db.update(courierRequests)
      .set({
        tid: "15806682",
        customerName: "Rassco Merchant 3",
        tecName: techUser.username,
        createdBy: techUser.id,
      })
      .where(eq(courierRequests.id, 146));
    console.log("Updated request 146");
  } else {
    await db.insert(courierRequests).values({
      id: 146,
      tid: "15806682",
      customerName: "Rassco Merchant 3",
      tecName: techUser.username,
      createdBy: techUser.id,
    });
    console.log("Inserted request 146");
  }
  await db.delete(courierRequestItems).where(eq(courierRequestItems.requestId, 146));
  await db.insert(courierRequestItems).values([
    {
      requestId: 146,
      serialNumber: "NCD100257784",
      simSerial: "8996000000001234567",
      itemType: posType.id,
      status: "IN_TRANSIT_CUSTODY",
    },
    {
      requestId: 146,
      serialNumber: "NCD100257785",
      simSerial: "8996000000001234568",
      itemType: posType.id,
      status: "IN_TRANSIT_CUSTODY",
    },
    {
      requestId: 146,
      serialNumber: "NCD100257786",
      simSerial: "8996000000001234569",
      itemType: posType.id,
      status: "IN_TRANSIT_CUSTODY",
    }
  ]);

  console.log("All test data seeded successfully and perfectly aligned!");
}

run().catch(console.error);
