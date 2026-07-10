/**
 * Apply hard DB constraints for item_types table.
 * Run with: npx tsx scripts/apply-item-types-constraints.ts
 */

import 'dotenv/config';
import { db } from '../apps/api/src/core/config/db';
import { sql } from 'drizzle-orm';

async function applyItemTypesConstraints() {
  try {
    console.log('🔧 Validating current item_types data...');

    const invalidCategoriesResult = await db.execute(sql`
      SELECT DISTINCT category
      FROM item_types
      WHERE category NOT IN ('devices', 'papers', 'sim', 'accessories')
      LIMIT 10
    `);

    const duplicateArabicNamesResult = await db.execute(sql`
      SELECT LOWER(name_ar) AS normalized_name, COUNT(*)::int AS duplicate_count
      FROM item_types
      GROUP BY LOWER(name_ar)
      HAVING COUNT(*) > 1
      LIMIT 10
    `);

    const duplicateEnglishNamesResult = await db.execute(sql`
      SELECT LOWER(name_en) AS normalized_name, COUNT(*)::int AS duplicate_count
      FROM item_types
      GROUP BY LOWER(name_en)
      HAVING COUNT(*) > 1
      LIMIT 10
    `);

    const invalidUnitsOrSortResult = await db.execute(sql`
      SELECT id, units_per_box, sort_order
      FROM item_types
      WHERE units_per_box <= 0 OR sort_order < 0
      LIMIT 10
    `);

    const invalidCategories = (invalidCategoriesResult as any).rows || [];
    const duplicateArabicNames = (duplicateArabicNamesResult as any).rows || [];
    const duplicateEnglishNames = (duplicateEnglishNamesResult as any).rows || [];
    const invalidUnitsOrSort = (invalidUnitsOrSortResult as any).rows || [];

    if (invalidCategories.length > 0) {
      throw new Error(`Invalid item type categories found: ${JSON.stringify(invalidCategories)}`);
    }

    if (duplicateArabicNames.length > 0) {
      console.log('⚠️ Duplicate Arabic names found, auto-fixing...');
      await db.execute(sql`
        WITH ranked AS (
          SELECT
            id,
            ROW_NUMBER() OVER (
              PARTITION BY LOWER(name_ar)
              ORDER BY created_at, id
            ) AS row_num
          FROM item_types
        )
        UPDATE item_types AS t
        SET name_ar = CONCAT(t.name_ar, ' #', t.id)
        FROM ranked
        WHERE t.id = ranked.id
          AND ranked.row_num > 1;
      `);
    }

    if (duplicateEnglishNames.length > 0) {
      console.log('⚠️ Duplicate English names found, auto-fixing...');
      await db.execute(sql`
        WITH ranked AS (
          SELECT
            id,
            ROW_NUMBER() OVER (
              PARTITION BY LOWER(name_en)
              ORDER BY created_at, id
            ) AS row_num
          FROM item_types
        )
        UPDATE item_types AS t
        SET name_en = CONCAT(t.name_en, ' #', t.id)
        FROM ranked
        WHERE t.id = ranked.id
          AND ranked.row_num > 1;
      `);
    }

    const duplicateArabicNamesAfterFixResult = await db.execute(sql`
      SELECT LOWER(name_ar) AS normalized_name, COUNT(*)::int AS duplicate_count
      FROM item_types
      GROUP BY LOWER(name_ar)
      HAVING COUNT(*) > 1
      LIMIT 10
    `);

    const duplicateEnglishNamesAfterFixResult = await db.execute(sql`
      SELECT LOWER(name_en) AS normalized_name, COUNT(*)::int AS duplicate_count
      FROM item_types
      GROUP BY LOWER(name_en)
      HAVING COUNT(*) > 1
      LIMIT 10
    `);

    const duplicateArabicNamesAfterFix = (duplicateArabicNamesAfterFixResult as any).rows || [];
    const duplicateEnglishNamesAfterFix = (duplicateEnglishNamesAfterFixResult as any).rows || [];

    if (duplicateArabicNamesAfterFix.length > 0) {
      throw new Error(`Duplicate Arabic item type names remain after auto-fix: ${JSON.stringify(duplicateArabicNamesAfterFix)}`);
    }

    if (duplicateEnglishNamesAfterFix.length > 0) {
      throw new Error(`Duplicate English item type names remain after auto-fix: ${JSON.stringify(duplicateEnglishNamesAfterFix)}`);
    }

    if (invalidUnitsOrSort.length > 0) {
      throw new Error(`Invalid units_per_box/sort_order rows found: ${JSON.stringify(invalidUnitsOrSort)}`);
    }

    console.log('✅ Data validation passed. Applying constraints...');

    await db.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'item_types_category_check'
        ) THEN
          ALTER TABLE item_types
          ADD CONSTRAINT item_types_category_check
          CHECK (category IN ('devices', 'papers', 'sim', 'accessories'));
        END IF;
      END $$;
    `);

    await db.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'item_types_units_per_box_check'
        ) THEN
          ALTER TABLE item_types
          ADD CONSTRAINT item_types_units_per_box_check
          CHECK (units_per_box > 0);
        END IF;
      END $$;
    `);

    await db.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'item_types_sort_order_check'
        ) THEN
          ALTER TABLE item_types
          ADD CONSTRAINT item_types_sort_order_check
          CHECK (sort_order >= 0);
        END IF;
      END $$;
    `);

    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS item_types_name_ar_unique_ci
      ON item_types (LOWER(name_ar));
    `);

    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS item_types_name_en_unique_ci
      ON item_types (LOWER(name_en));
    `);

    console.log('✅ item_types constraints applied successfully.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to apply item_types constraints:', error);
    process.exit(1);
  }
}

applyItemTypesConstraints();
