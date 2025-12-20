/**
 * Restaurant Model
 * 
 * This file contains the Restaurant model interface for database operations.
 */

import type { Restaurant, InsertRestaurant } from "@shared/schema";

// Restaurant model interface for database operations
export interface IRestaurantModel {
  findById(id: string): Promise<Restaurant | undefined>;
  findByName(name: string): Promise<Restaurant | undefined>;
  findAll(): Promise<Restaurant[]>;
  create(restaurant: InsertRestaurant): Promise<Restaurant>;
  update(id: string, data: Partial<Restaurant>): Promise<Restaurant | undefined>;
  delete(id: string): Promise<boolean>;
}
