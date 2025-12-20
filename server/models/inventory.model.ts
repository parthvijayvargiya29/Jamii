/**
 * Inventory Models
 * 
 * This file contains the InventoryItem and InventoryLog model interfaces.
 */

import type { InventoryItem, InsertInventoryItem, InventoryLog, InsertInventoryLog } from "@shared/schema";

// Inventory Item model interface
export interface IInventoryItemModel {
  findById(id: string): Promise<InventoryItem | undefined>;
  findByRestaurant(restaurantId: string): Promise<InventoryItem[]>;
  findByCategory(restaurantId: string, category: string): Promise<InventoryItem[]>;
  findLowStock(restaurantId: string): Promise<InventoryItem[]>;
  create(item: InsertInventoryItem): Promise<InventoryItem>;
  update(id: string, data: Partial<InventoryItem>): Promise<InventoryItem | undefined>;
  delete(id: string): Promise<boolean>;
}

// Inventory Log model interface
export interface IInventoryLogModel {
  findById(id: string): Promise<InventoryLog | undefined>;
  findByItem(inventoryItemId: string): Promise<InventoryLog[]>;
  findByRestaurant(restaurantId: string): Promise<InventoryLog[]>;
  create(log: InsertInventoryLog): Promise<InventoryLog>;
}
