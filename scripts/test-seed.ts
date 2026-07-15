import pkg from 'pg';
const { Client } = pkg;

const connectionString = 'postgresql://postgres:postgres@localhost:5432/nulip_performance';

async function main() {
  const client = new Client({ connectionString });
  await client.connect();
  console.log('Connected to nulip_performance for seeding test.');

  try {
    console.log('Truncating tables...');
    await client.query('TRUNCATE TABLE bearer_sessions, custody_movements, inventory_transactions, item_history_logs, items, warehouses, users, courier_executions, courier_requests, item_types CASCADE');

    console.log('Inserting baseline users...');
    const userResult = await client.query(`
      INSERT INTO users (id, username, email, password, full_name, role, is_active)
      SELECT 
        gen_random_uuid(), 
        'user_' || i, 
        'user_' || i || '@example.com', 
        '$2b$10$xyz', 
        'Full Name ' || i, 
        CASE WHEN i <= 2 THEN 'admin' WHEN i <= 5 THEN 'supervisor' ELSE 'technician' END,
        true
      FROM generate_series(1, 20) i
      RETURNING id, role
    `);
    const adminUser = userResult.rows.find(r => r.role === 'admin');
    const adminId = adminUser ? adminUser.id : userResult.rows[0].id;
    console.log(`Admin ID: ${adminId}`);

    console.log('Inserting warehouses...');
    await client.query(`
      INSERT INTO warehouses (id, name, location, description, is_active, created_by)
      SELECT 
        gen_random_uuid(), 
        'Warehouse ' || i, 
        'Riyadh Branch ' || i, 
        'Description ' || i, 
        true, 
        $1
      FROM generate_series(1, 2) i
    `, [adminId]);

    console.log('Inserting item types...');
    await client.query(`
      INSERT INTO item_types (id, name_ar, name_en, category, units_per_box, is_active, is_visible, requires_serial)
      VALUES 
        (gen_random_uuid(), 'أجهزة POS', 'POS Terminals', 'devices', 10, true, true, true),
        (gen_random_uuid(), 'بطاقات SIM STC', 'STC SIM Cards', 'sim', 50, true, true, true),
        (gen_random_uuid(), 'بطاقات SIM Mobily', 'Mobily SIM Cards', 'sim', 50, true, true, true),
        (gen_random_uuid(), 'ورق طابعة', 'Printer Rolls', 'papers', 100, true, true, false),
        (gen_random_uuid(), 'ملصقات', 'Stickers', 'accessories', 200, true, true, false)
    `);

    console.log('Inserting items...');
    await client.query(`
      INSERT INTO items (id, item_type_id, serial_number, barcode, status, current_owner_id, warehouse_id, carrier_name)
      SELECT 
        gen_random_uuid(),
        (SELECT id FROM item_types WHERE requires_serial = true LIMIT 1 OFFSET (i % 3)),
        'SN' || LPAD(i::text, 10, '0'),
        'BAR' || LPAD(i::text, 12, '0'),
        CASE 
          WHEN i % 5 = 0 THEN 'WAREHOUSE' 
          WHEN i % 5 = 1 THEN 'PENDING_ACCEPTANCE'
          WHEN i % 5 = 2 THEN 'IN_TRANSIT_CUSTODY'
          ELSE 'RECEIVED_BY_TECHNICIAN'
        END,
        (SELECT id FROM users WHERE role = 'technician' LIMIT 1 OFFSET (i % 15)),
        (SELECT id FROM warehouses LIMIT 1 OFFSET (i % 2)),
        CASE WHEN i % 2 = 0 THEN 'STC' ELSE 'Mobily' END
      FROM generate_series(1, 100) i
    `);

    console.log('Inserting custody movements...');
    await client.query(`
      INSERT INTO custody_movements (id, item_id, from_owner_id, to_owner_id, reason, reference_type, reference_id, performed_by_id, performed_at)
      SELECT 
        gen_random_uuid(),
        id,
        NULL,
        current_owner_id,
        'INTAKE',
        'WAREHOUSE_TRANSFER',
        'ref_' || (i % 10),
        $1,
        now() - (i % 30 || ' days')::interval
      FROM (
        SELECT id, current_owner_id, row_number() OVER () as i 
        FROM items
      ) t
    `, [adminId]);

    console.log('Inserting courier requests...');
    await client.query(`
      INSERT INTO courier_requests (id, date, installation_type, sim, tid, customer_name, city, created_by, created_at, version)
      SELECT 
        i,
        '2026-07-' || LPAD((i % 28 + 1)::text, 2, '0'),
        'NEW',
        'SIM' || LPAD(i::text, 10, '0'),
        'TID' || LPAD(i::text, 8, '0'),
        'Customer Name ' || i,
        'Riyadh',
        $1,
        now() - (i % 30 || ' days')::interval,
        1
      FROM generate_series(1, 30) i
    `, [adminId]);

    console.log('Inserting courier executions...');
    await client.query(`
      INSERT INTO courier_executions (request_id, sn, sim_serial, installation_status, sales_technician, response_date, entered_by, entered_at, version)
      SELECT 
        i,
        'SN' || LPAD(i::text, 10, '0'),
        'SIM' || LPAD(i::text, 10, '0'),
        CASE WHEN i % 3 = 0 THEN 'INSTALLED' WHEN i % 3 = 1 THEN 'DELIVERED' ELSE 'FAILED' END,
        'Tech Name ' || (i % 10),
        '2026-07-' || LPAD((i % 28 + 1)::text, 2, '0'),
        $1,
        now() - (i % 30 || ' days')::interval,
        1
      FROM generate_series(1, 15) i
    `, [adminId]);

    console.log('Seeding test succeeded!');
  } catch (err) {
    console.error('Seeding test failed:', err);
  } finally {
    await client.end();
  }
}

main();
