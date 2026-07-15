import pkg from 'pg';
const { Client } = pkg;
import { execSync } from 'child_process';
import dotenv from 'dotenv';
dotenv.config();

const baseConnectionString = 'postgresql://postgres:postgres@localhost:5432/postgres';
const perfConnectionString = 'postgresql://postgres:postgres@localhost:5432/nulip_performance';

async function main() {
  console.log('Connecting to postgres database to check nulip_performance...');
  const client = new Client({ connectionString: baseConnectionString });
  await client.connect();

  try {
    const res = await client.query("SELECT 1 FROM pg_database WHERE datname = 'nulip_performance'");
    if (res.rowCount === 0) {
      console.log('Creating database nulip_performance...');
      await client.query('CREATE DATABASE nulip_performance');
      console.log('Database nulip_performance created successfully.');
    } else {
      console.log('Database nulip_performance already exists.');
    }
  } catch (err) {
    console.error('Error checking/creating database:', err);
    process.exit(1);
  } finally {
    await client.end();
  }

  console.log('Running migrations on nulip_performance...');
  try {
    // Run migration command using drizzle-kit or raw migration SQL
    // Let's run migrations via migrations folder or script
    process.env.DATABASE_URL = perfConnectionString;
    console.log('Executing migrations...');
    execSync('npx tsx scripts/migrate.ts', { stdio: 'inherit', env: process.env });
    console.log('Migrations completed successfully.');
  } catch (err) {
    console.error('Failed to run migrations:', err);
    process.exit(1);
  }
}

main();
