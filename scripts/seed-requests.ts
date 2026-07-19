import { db } from "../apps/api/src/core/config/db";
import { courierRequests, courierRequestItems, users } from "@shared/schema";
import { eq } from "drizzle-orm";

async function run() {
  console.log("Seeding test data...");

  // Find tech1
  const allUsers = await db.select().from(users).limit(5);
  if (allUsers.length === 0) {
    console.error("No users found in database! Please run seed/bootstrap first.");
    process.exit(1);
  }
  
  const tech = allUsers.find(u => u.username === "tech1") || allUsers[0];
  const techId = tech.id;
  console.log(`Using user ID: ${techId} (${tech.username}) for requests`);

  // 1. Seed Request 144 (1 Device)
  const [existing144] = await db.select().from(courierRequests).where(eq(courierRequests.id, 144)).limit(1);
  if (existing144) {
    await db.update(courierRequests)
      .set({
        tid: "15806680",
        customerName: "Rassco Merchant 1",
        tecName: tech.username,
        createdBy: techId,
      })
      .where(eq(courierRequests.id, 144));
    console.log("Updated request 144");
  } else {
    await db.insert(courierRequests).values({
      id: 144,
      tid: "15806680",
      customerName: "Rassco Merchant 1",
      tecName: tech.username,
      createdBy: techId,
    });
    console.log("Inserted request 144");
  }

  // Clear existing items for these requests to avoid duplicates
  await db.delete(courierRequestItems).where(eq(courierRequestItems.requestId, 144));
  await db.insert(courierRequestItems).values({
    requestId: 144,
    serialNumber: "NCD100257784",
    simSerial: "8996000000001234567",
    itemType: "POS",
    status: "IN_TRANSIT_CUSTODY",
  });
  console.log("Seeded items for 144");

  // 2. Seed Request 145 (2 Devices)
  const [existing145] = await db.select().from(courierRequests).where(eq(courierRequests.id, 145)).limit(1);
  if (existing145) {
    await db.update(courierRequests)
      .set({
        tid: "15806681",
        customerName: "Rassco Merchant 2",
        tecName: tech.username,
        createdBy: techId,
      })
      .where(eq(courierRequests.id, 145));
    console.log("Updated request 145");
  } else {
    await db.insert(courierRequests).values({
      id: 145,
      tid: "15806681",
      customerName: "Rassco Merchant 2",
      tecName: tech.username,
      createdBy: techId,
    });
    console.log("Inserted request 145");
  }

  await db.delete(courierRequestItems).where(eq(courierRequestItems.requestId, 145));
  await db.insert(courierRequestItems).values([
    {
      requestId: 145,
      serialNumber: "NCD100257784",
      simSerial: "8996000000001234567",
      itemType: "POS",
      status: "IN_TRANSIT_CUSTODY",
    },
    {
      requestId: 145,
      serialNumber: "NCD100257785",
      simSerial: "8996000000001234568",
      itemType: "POS",
      status: "IN_TRANSIT_CUSTODY",
    }
  ]);
  console.log("Seeded items for 145");

  // 3. Seed Request 146 (3 Devices)
  const [existing146] = await db.select().from(courierRequests).where(eq(courierRequests.id, 146)).limit(1);
  if (existing146) {
    await db.update(courierRequests)
      .set({
        tid: "15806682",
        customerName: "Rassco Merchant 3",
        tecName: tech.username,
        createdBy: techId,
      })
      .where(eq(courierRequests.id, 146));
    console.log("Updated request 146");
  } else {
    await db.insert(courierRequests).values({
      id: 146,
      tid: "15806682",
      customerName: "Rassco Merchant 3",
      tecName: tech.username,
      createdBy: techId,
    });
    console.log("Inserted request 146");
  }

  await db.delete(courierRequestItems).where(eq(courierRequestItems.requestId, 146));
  await db.insert(courierRequestItems).values([
    {
      requestId: 146,
      serialNumber: "NCD100257784",
      simSerial: "8996000000001234567",
      itemType: "POS",
      status: "IN_TRANSIT_CUSTODY",
    },
    {
      requestId: 146,
      serialNumber: "NCD100257785",
      simSerial: "8996000000001234568",
      itemType: "POS",
      status: "IN_TRANSIT_CUSTODY",
    },
    {
      requestId: 146,
      serialNumber: "NCD100257786",
      simSerial: "8996000000001234569",
      itemType: "POS",
      status: "IN_TRANSIT_CUSTODY",
    }
  ]);
  console.log("Seeded items for 146");

  console.log("Database seeded successfully!");
}

run().catch(console.error);
