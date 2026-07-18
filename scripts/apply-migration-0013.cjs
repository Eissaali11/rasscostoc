const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

(async () => {
  const cs = process.env.OPS_DB_URL_NULIP_INVENTORY;
  const client = new Client({ connectionString: cs });
  try {
    await client.connect();
    
    // Run migration 0013 which creates courier_request_items and courier_execution_attempts
    const migSql = fs.readFileSync(
      path.join(__dirname, '../migrations/0013_polite_calypso.sql'),
      'utf8'
    );
    
    // Split by --> statement-breakpoint and run each statement
    const statements = migSql.split('--\> statement-breakpoint').map(s => s.trim()).filter(Boolean);
    
    for (const stmt of statements) {
      try {
        await client.query(stmt);
        console.log('✅ Executed:', stmt.substring(0, 60) + '...');
      } catch (err) {
        console.warn('⚠️ Skipped (already exists?):', err.message.substring(0, 100));
      }
    }

    console.log('\n--- Verifying tables ---');
    const res = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_name IN ('courier_request_items', 'courier_execution_attempts')
    `);
    console.table(res.rows);

  } catch (err) {
    console.error('Fatal error:', err);
  } finally {
    await client.end();
  }
})();
