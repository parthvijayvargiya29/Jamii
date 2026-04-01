/**
 * PostgreSQL Database Connection
 * 
 * This module establishes a connection to PostgreSQL using the pg library.
 * 
 * INITIALIZATION INSTRUCTIONS:
 * ============================
 * 1. Ensure DATABASE_URL environment variable is set
 * 2. Run the initialization script:
 *    
 *    node server/seed.js
 * 
 * This will create all tables and seed initial data.
 */

import pg from 'pg';
const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

pool.on('error', (err: Error) => {
  console.error('[DB] Pool error:', err.message);
});

export async function query(text: string, params?: unknown[]) {
  try {
    return await pool.query(text, params);
  } catch (error: unknown) {
    console.error('[DB] Query error:', (error as Error).message);
    throw error;
  }
}

export async function getClient() {
  return pool.connect();
}

export async function testConnection() {
  try {
    await pool.query('SELECT NOW()');
    return true;
  } catch (error: unknown) {
    console.error('[DB] Connection failed:', (error as Error).message);
    return false;
  }
}

export { pool };
