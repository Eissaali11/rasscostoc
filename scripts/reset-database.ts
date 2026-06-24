/**
 * Reset database - drop all tables and recreate
 */
import 'dotenv/config';
import pg from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';

const { Pool } = pg;

async function resetDatabase() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    console.log('🗑️  Dropping all existing tables...');
    
    // Get all table names
    const result = await pool.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
    `);
    
    if (result.rows.length > 0) {
      console.log(`Found ${result.rows.length} existing tables`);
      
      // Drop all tables
      for (const row of result.rows) {
        await pool.query(`DROP TABLE IF EXISTS "${row.tablename}" CASCADE`);
        console.log(`  ✅ Dropped table: ${row.tablename}`);
      }
    } else {
      console.log('No existing tables found');
    }
    
    console.log('\n⏳ Running Drizzle migrator to create tables...');
    const { drizzle } = await import('drizzle-orm/node-postgres');
    const { migrate } = await import('drizzle-orm/node-postgres/migrator');
    const db = drizzle({ client: pool });
    await migrate(db, { migrationsFolder: "./migrations" });
    console.log('\n✅ Migrations applied and registered successfully!');
    console.log('\n🎉 Database is ready!');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

resetDatabase();
