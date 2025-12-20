/**
 * User Model
 * 
 * This file contains the User model interface for database operations.
 * Supports multiple storage backends (in-memory, SQLite, PostgreSQL).
 */

import type { User, InsertUser } from "@shared/schema";

// User model interface for database operations
export interface IUserModel {
  findById(id: string): Promise<User | undefined>;
  findByEmail(email: string): Promise<User | undefined>;
  findByRestaurant(restaurantId: string): Promise<User[]>;
  findAll(): Promise<User[]>;
  create(user: InsertUser): Promise<User>;
  update(id: string, data: Partial<User>): Promise<User | undefined>;
  delete(id: string): Promise<boolean>;
}
