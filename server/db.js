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

pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('PostgreSQL pool error:', err);
});

export async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text: text.substring(0, 50), duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Query error:', error.message);
    throw error;
  }
}

export async function getClient() {
  const client = await pool.connect();
  return client;
}

export async function testConnection() {
  try {
    const res = await pool.query('SELECT NOW()');
    console.log('Database connection successful:', res.rows[0].now);
    return true;
  } catch (error) {
    console.error('Database connection failed:', error.message);
    return false;
  }
}

export { pool };
