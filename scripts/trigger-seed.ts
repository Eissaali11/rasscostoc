import 'dotenv/config';
import { db, pool } from "../apps/api/src/core/config/db";
import { ItemTypesService } from "../apps/api/src/modules/inventory/infrastructure/services/item-types.service";

async function main() {
  console.log("Seeding default item types...");
  try {
    const service = new ItemTypesService();
    await service.seedDefaultItemTypes();
    console.log("Seeding completed successfully!");
  } catch (err) {
    console.error("Seeding failed:", err);
  } finally {
    await pool.end();
  }
}

main();
