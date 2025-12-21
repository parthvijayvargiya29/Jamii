-- ============================================================================
-- PostgreSQL Schema for Restaurant Inventory Management System
-- ============================================================================
-- 
-- INITIALIZATION INSTRUCTIONS:
-- ============================
-- Run the seed script to create tables and seed data:
--
--   node server/seed.js
--
-- Or to run this SQL file directly:
--
--   psql $DATABASE_URL -f server/schema.sql
--
-- ============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- RESTAURANTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS restaurants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_restaurants_name ON restaurants(name);

-- ============================================================================
-- USERS TABLE
-- ============================================================================
-- Roles: 'admin', 'manager', 'staff'
-- Each user belongs to one restaurant (restaurant isolation)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'manager', 'staff')),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_restaurant ON users(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- ============================================================================
-- INVENTORY ITEMS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS inventory_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  unit TEXT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
  low_stock_threshold DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_restaurant ON inventory_items(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_category ON inventory_items(category);
CREATE INDEX IF NOT EXISTS idx_inventory_name ON inventory_items(name);

-- ============================================================================
-- INVENTORY LOGS TABLE
-- ============================================================================
-- Change types: 'Delivery', 'EndOfDayCount', 'Adjustment'
CREATE TABLE IF NOT EXISTS inventory_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  change_type TEXT NOT NULL CHECK (change_type IN ('Delivery', 'EndOfDayCount', 'Adjustment')),
  quantity_changed DECIMAL(10,2) NOT NULL,
  final_quantity DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_inventory_logs_item ON inventory_logs(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_restaurant ON inventory_logs(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_created_at ON inventory_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_change_type ON inventory_logs(change_type);

-- ============================================================================
-- RECIPES TABLE
-- ============================================================================
-- Ingredients stored as JSONB array
CREATE TABLE IF NOT EXISTS recipes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  ingredients JSONB NOT NULL DEFAULT '[]',
  instructions TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recipes_restaurant ON recipes(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_recipes_name ON recipes(name);

-- ============================================================================
-- CLEANING TASKS TABLE
-- ============================================================================
-- Frequency: 'daily', 'weekly', 'monthly'
CREATE TABLE IF NOT EXISTS cleaning_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cleaning_tasks_restaurant ON cleaning_tasks(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_cleaning_tasks_frequency ON cleaning_tasks(frequency);

-- ============================================================================
-- CLEANING LOGS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS cleaning_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cleaning_task_id UUID NOT NULL REFERENCES cleaning_tasks(id) ON DELETE CASCADE,
  completed_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_cleaning_logs_task ON cleaning_logs(cleaning_task_id);
CREATE INDEX IF NOT EXISTS idx_cleaning_logs_completed_by ON cleaning_logs(completed_by);
CREATE INDEX IF NOT EXISTS idx_cleaning_logs_completed_at ON cleaning_logs(completed_at);
