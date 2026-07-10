import 'dotenv/config';
import { db } from "../apps/api/src/core/config/db";
import { courierSimTypes } from "../packages/shared-types/schema";
import { eq, sql } from 'drizzle-orm';

const KSA_SIM_TYPES = [
  "STC",
  "Mobily",
  "Zain",
  "Lebara",
  "Virgin Mobile",
  "Jawwy",
  "Friendi Mobile",
  "Salam Mobile",
  "Red Bull Mobile"
];

async function main() {
  console.log("🔄 Resetting courier_sim_types_id_seq sequence...");
  // Reset the PostgreSQL serial sequence to avoid conflicts with manually inserted IDs
  await db.execute(sql`SELECT setval('courier_sim_types_id_seq', (SELECT COALESCE(MAX(id), 1) FROM courier_sim_types));`);

  console.log("📶 Seeding KSA SIM types...");

  for (const name of KSA_SIM_TYPES) {
    const [existing] = await db
      .select()
      .from(courierSimTypes)
      .where(eq(courierSimTypes.name, name))
      .limit(1);

    if (existing) {
      console.log(`- SIM type "${name}" already exists (ID: ${existing.id})`);
    } else {
      const [inserted] = await db
        .insert(courierSimTypes)
        .values({ name })
        .returning();
      console.log(`- Inserted new SIM type: "${name}" (ID: ${inserted.id})`);
    }
  }

  console.log("✅ KSA SIM types seeding complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
