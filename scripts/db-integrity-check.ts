import pkg from 'pg';
const { Client } = pkg;

(async () => {
  const cs = 'postgresql://postgres:postgres@localhost:5432/nulip_inventory';
  const client = new Client({ connectionString: cs });
  try {
    await client.connect();
    console.log('====================================================================');
    console.log('📊 DATABASE SCHEMA AND RELATION INTEGRITY CHECK');
    console.log('====================================================================\n');

    // 1. Get all tables and row counts
    console.log('--- 1. Tables and Record Counts ---');
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    for (const row of tablesRes.rows) {
      const countRes = await client.query(`SELECT COUNT(*) FROM public."${row.table_name}"`);
      console.log(`  Table: ${row.table_name.padEnd(30)} | Rows: ${countRes.rows[0].count}`);
    }

    // 2. Foreign Key constraints
    console.log('\n--- 2. Foreign Key Constraints & Relationships ---');
    const fkRes = await client.query(`
      SELECT
        tc.table_name, 
        kcu.column_name, 
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name 
      FROM 
        information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
      ORDER BY tc.table_name, kcu.column_name;
    `);

    fkRes.rows.forEach(fk => {
      console.log(`  Relationship: ${fk.table_name}.${fk.column_name} ---> ${fk.foreign_table_name}.${fk.foreign_column_name}`);
    });

    // 3. Unique & Primary key constraints
    console.log('\n--- 3. Primary Key & Unique Constraints ---');
    const constRes = await client.query(`
      SELECT 
        table_name, 
        constraint_name, 
        constraint_type 
      FROM 
        information_schema.table_constraints 
      WHERE 
        table_schema = 'public' 
        AND constraint_type IN ('PRIMARY KEY', 'UNIQUE')
      ORDER BY table_name, constraint_type;
    `);
    constRes.rows.forEach(c => {
      console.log(`  Constraint: ${c.table_name.padEnd(30)} | Type: ${c.constraint_type.padEnd(12)} | Name: ${c.constraint_name}`);
    });

  } catch (err) {
    console.error('Error during DB integrity check:', err);
  } finally {
    await client.end();
  }
})();
