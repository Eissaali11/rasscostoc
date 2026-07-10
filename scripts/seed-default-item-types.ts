import 'dotenv/config';
import { ItemTypesService } from '../apps/api/src/modules/inventory/infrastructure/services/item-types.service';

async function main() {
  const service = new ItemTypesService();
  console.log("Seeding default item types...");
  await service.seedDefaultItemTypes();
  console.log("Seeding complete.");
  process.exit(0);
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
