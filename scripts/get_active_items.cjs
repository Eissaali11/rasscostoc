const { Client } = require('pg');
(async () => {
  const cs = process.env.OPS_DB_URL_NULIP_INVENTORY;
  const client = new Client({ connectionString: cs });
  try {
    await client.connect();

    console.log("=== ALL USERS ===");
    const usersRes = await client.query(`
      SELECT id, username, full_name, role, city
      FROM users
      ORDER BY role, username
    `);
    console.table(usersRes.rows);

    console.log("\n=== ALL INVENTORY REQUESTS JOINED WITH USER ===");
    const reqsRes = await client.query(`
      SELECT ir.id, ir.status, u.full_name as tech_name, ir.created_at,
             ir.n950_boxes, ir.n950_units, ir.lebara_boxes, ir.lebara_units,
             ir.stickers_boxes, ir.stickers_units
      FROM inventory_requests ir
      JOIN users u ON ir.technician_id = u.id
      ORDER BY ir.created_at DESC
    `);
    console.table(reqsRes.rows.map(row => {
      const formatted = { id: row.id, status: row.status, tech: row.tech_name };
      for (const [k, v] of Object.entries(row)) {
        if (v > 0 && k !== 'id' && k !== 'status' && k !== 'tech_name' && k !== 'created_at') {
          formatted[k] = v;
        }
      }
      return formatted;
    }));

  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
})();
