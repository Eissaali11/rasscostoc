import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { sql } from 'drizzle-orm';
import ws from "ws";

neonConfig.webSocketConstructor = ws;

async function syncProductionDatabase() {
  const dbUrl = process.env.DATABASE_URL;
  
  if (!dbUrl) {
    console.error('❌ DATABASE_URL not found');
    process.exit(1);
  }

  console.log('🔄 Connecting to database...');
  const pool = new Pool({ connectionString: dbUrl });
  const db = drizzle({ client: pool });

  try {
    console.log('📋 Checking database tables...');
    
    const tablesResult = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    
    console.log('\n✅ Current tables in database:');
    tablesResult.rows.forEach((row: any) => {
      console.log(`   - ${row.table_name}`);
    });

    const requiredTables = [
      'regions',
      'users',
      'inventory_items',
      'technicians_inventory',
      'transactions',
      'withdrawn_devices',
      'technician_fixed_inventories',
      'stock_movements',
      'warehouses',
      'warehouse_inventory',
      'warehouse_transfers',
      'supervisor_technicians',
      'supervisor_warehouses',
      'inventory_requests',
      'system_logs'
    ];

    console.log('\n🔍 Checking for required tables...');
    const existingTables = tablesResult.rows.map((row: any) => row.table_name);
    const missingTables = requiredTables.filter(t => !existingTables.includes(t));

    if (missingTables.length > 0) {
      console.log('\n⚠️  Missing tables detected:');
      missingTables.forEach(table => console.log(`   ❌ ${table}`));
      console.log('\n📝 To fix this:');
      console.log('   1. Run: npm run db:push');
      console.log('   2. Or use Replit Database panel to "Copy Development to Production"');
    } else {
      console.log('\n✅ All required tables exist!');
    }

    console.log('\n📊 Database sync check completed successfully!');
    
  } catch (error) {
    console.error('❌ Error checking database:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

syncProductionDatabase().catch(console.error);
