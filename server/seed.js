/**
 * Database Initialization and Seeding Script
 * 
 * INITIALIZATION INSTRUCTIONS:
 * ============================
 * 
 * To initialize the database and seed data, run:
 * 
 *   node server/seed.js
 * 
 * This script will:
 * 1. Connect to PostgreSQL using DATABASE_URL
 * 2. Create all tables if they do not exist
 * 3. Seed two restaurants
 * 4. Seed one admin user with a hashed password
 * 
 * Prerequisites:
 * - DATABASE_URL environment variable must be set
 * - PostgreSQL database must be accessible
 * 
 * Demo Login Credentials (after seeding):
 * - Email: admin@demo.com
 * - Password: demo123
 */

import pg from 'pg';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is not set');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function createTables() {
  console.log('Creating tables...');
  
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  
  try {
    await pool.query(schema);
    console.log('Tables created successfully');
  } catch (error) {
    console.error('Error creating tables:', error.message);
    throw error;
  }
}

async function seedRestaurants() {
  console.log('Seeding restaurants...');
  
  const restaurants = [
    { name: 'Restaurant A' },
    { name: 'Restaurant B' }
  ];
  
  const insertedRestaurants = [];
  
  for (const restaurant of restaurants) {
    const existing = await pool.query(
      'SELECT id FROM restaurants WHERE name = $1',
      [restaurant.name]
    );
    
    if (existing.rows.length > 0) {
      console.log(`Restaurant "${restaurant.name}" already exists`);
      insertedRestaurants.push(existing.rows[0]);
    } else {
      const result = await pool.query(
        'INSERT INTO restaurants (name) VALUES ($1) RETURNING id, name',
        [restaurant.name]
      );
      console.log(`Created restaurant: ${result.rows[0].name}`);
      insertedRestaurants.push(result.rows[0]);
    }
  }
  
  return insertedRestaurants;
}

async function seedAdminUser(restaurantId) {
  console.log('Seeding admin user...');
  
  const adminEmail = 'admin@demo.com';
  const adminPassword = 'demo123';
  
  const existing = await pool.query(
    'SELECT id FROM users WHERE email = $1',
    [adminEmail]
  );
  
  if (existing.rows.length > 0) {
    console.log('Admin user already exists');
    return existing.rows[0];
  }
  
  const saltRounds = 10;
  const passwordHash = await bcrypt.hash(adminPassword, saltRounds);
  
  const result = await pool.query(
    `INSERT INTO users (name, email, password_hash, role, restaurant_id) 
     VALUES ($1, $2, $3, $4, $5) 
     RETURNING id, name, email, role`,
    ['Admin User', adminEmail, passwordHash, 'admin', restaurantId]
  );
  
  console.log(`Created admin user: ${result.rows[0].email}`);
  return result.rows[0];
}

async function seedManagerUser(restaurantAId, restaurantBId) {
  console.log('Seeding manager users...');
  
  const managers = [
    { name: 'Manager A', email: 'manager@demo.com', restaurantId: restaurantAId },
    { name: 'Manager B', email: 'managerb@demo.com', restaurantId: restaurantBId }
  ];
  
  const password = 'demo123';
  const saltRounds = 10;
  const passwordHash = await bcrypt.hash(password, saltRounds);
  
  for (const manager of managers) {
    const existing = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [manager.email]
    );
    
    if (existing.rows.length > 0) {
      console.log(`Manager "${manager.email}" already exists`);
    } else {
      await pool.query(
        `INSERT INTO users (name, email, password_hash, role, restaurant_id) 
         VALUES ($1, $2, $3, $4, $5)`,
        [manager.name, manager.email, passwordHash, 'manager', manager.restaurantId]
      );
      console.log(`Created manager: ${manager.email}`);
    }
  }
}

async function seedStaffUser(restaurantId) {
  console.log('Seeding staff user...');
  
  const staffEmail = 'staff@demo.com';
  const password = 'demo123';
  
  const existing = await pool.query(
    'SELECT id FROM users WHERE email = $1',
    [staffEmail]
  );
  
  if (existing.rows.length > 0) {
    console.log('Staff user already exists');
    return;
  }
  
  const saltRounds = 10;
  const passwordHash = await bcrypt.hash(password, saltRounds);
  
  await pool.query(
    `INSERT INTO users (name, email, password_hash, role, restaurant_id) 
     VALUES ($1, $2, $3, $4, $5)`,
    ['Staff User', staffEmail, passwordHash, 'staff', restaurantId]
  );
  
  console.log(`Created staff user: ${staffEmail}`);
}

async function main() {
  console.log('========================================');
  console.log('Database Initialization Started');
  console.log('========================================\n');
  
  try {
    const testResult = await pool.query('SELECT NOW()');
    console.log('Database connection successful:', testResult.rows[0].now);
    console.log('');
    
    await createTables();
    console.log('');
    
    const restaurants = await seedRestaurants();
    console.log('');
    
    const restaurantA = restaurants[0];
    const restaurantB = restaurants[1];
    
    await seedAdminUser(restaurantA.id);
    await seedManagerUser(restaurantA.id, restaurantB.id);
    await seedStaffUser(restaurantA.id);
    
    console.log('\n========================================');
    console.log('Database Initialization Complete!');
    console.log('========================================');
    console.log('\nDemo Login Credentials:');
    console.log('------------------------');
    console.log('Admin:   admin@demo.com / demo123');
    console.log('Manager: manager@demo.com / demo123');
    console.log('Manager: managerb@demo.com / demo123');
    console.log('Staff:   staff@demo.com / demo123');
    console.log('');
    
  } catch (error) {
    console.error('\nDatabase initialization failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
