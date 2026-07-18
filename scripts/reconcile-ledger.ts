import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL || process.env.OPS_DB_URL_NULIP_INVENTORY;

async function run() {
  console.log('====================================================================');
  console.log('⚙️ StockPro Enterprise v3.2 - Custody Ledger Reconciliation Tool');
  console.log('====================================================================\n');

  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    console.log('✅ Connected to database.');

    // 1. Get first admin user to act as performer
    const adminRes = await client.query("SELECT id, username FROM users WHERE role = 'admin' LIMIT 1");
    if (adminRes.rows.length === 0) {
      console.error('❌ No admin user found in database to perform reconciliation.');
      return;
    }
    const admin = adminRes.rows[0];
    console.log(`👤 Using admin user: "${admin.username}" (ID: ${admin.id}) for movements signature.`);

    // 2. Query mismatched items (specifically those with an owner but no ledger movements)
    const mismatchedRes = await client.query(`
      SELECT i.id, i.serial_number, i.current_owner_id, i.warehouse_id, i.created_at
      FROM items i
      LEFT JOIN custody_movements m ON i.id = m.item_id
      WHERE m.id IS NULL AND i.current_owner_id IS NOT NULL
    `);

    const mismatchedItems = mismatchedRes.rows;
    console.log(`🔍 Found ${mismatchedItems.length} items with active owners but 0 ledger movements history.`);

    if (mismatchedItems.length === 0) {
      console.log('✅ No items need reconciliation. Custody ledger is aligned.');
      return;
    }

    // 3. Start transaction to insert missing movements
    await client.query('BEGIN');
    console.log('🔄 Reconciling missing ledger entries...');

    for (const item of mismatchedItems) {
      const movementId = `mov-rec-${Math.random().toString(36).substr(2, 9)}`;
      await client.query(`
        INSERT INTO custody_movements (
          id, item_id, from_owner_id, to_owner_id, from_warehouse_id, to_warehouse_id, 
          reason, reference_type, reference_id, performed_by_id, notes, performed_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        movementId,
        item.id,
        null, // from_owner
        item.current_owner_id, // to_owner
        item.warehouse_id, // from_warehouse
        null, // to_warehouse
        'INTAKE', // reason
        'RECONCILIATION', // reference_type
        'REC-2026-07-10', // reference_id
        admin.id, // performed_by_id
        'Automated reconciliation of initial custody state for PRV', // notes
        item.created_at || new Date() // performed_at
      ]);
      console.log(`  + Created INTAKE movement for item "${item.serial_number}" to owner ${item.current_owner_id}`);
    }

    await client.query('COMMIT');
    console.log(`\n🎉 Reconciled all ${mismatchedItems.length} items successfully!`);

  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('❌ Error during reconciliation:', err.message);
  } finally {
    await client.end();
  }
}

run();
