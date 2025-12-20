/**
 * Storage Interface
 * 
 * Abstract storage layer that supports multiple backends:
 * - In-memory storage (development/testing)
 * - SQLite (development)
 * - PostgreSQL (production)
 */

import { randomUUID } from "crypto";
import {
  type User,
  type InsertUser,
  type Restaurant,
  type InsertRestaurant,
  type InventoryItem,
  type InsertInventoryItem,
  type InventoryLog,
  type InsertInventoryLog,
  type Recipe,
  type InsertRecipe,
  type CleaningTask,
  type InsertCleaningTask,
  type CleaningLog,
  type InsertCleaningLog,
  UserRole,
} from "@shared/schema";

// ============================================================================
// STORAGE INTERFACE
// ============================================================================

export interface IStorage {
  // Restaurant operations
  getRestaurant(id: string): Promise<Restaurant | undefined>;
  getRestaurantByName(name: string): Promise<Restaurant | undefined>;
  getAllRestaurants(): Promise<Restaurant[]>;
  createRestaurant(restaurant: InsertRestaurant): Promise<Restaurant>;
  updateRestaurant(id: string, data: Partial<Restaurant>): Promise<Restaurant | undefined>;
  deleteRestaurant(id: string): Promise<boolean>;

  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUsersByRestaurant(restaurantId: string): Promise<User[]>;
  getAllUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, data: Partial<User>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;

  // Inventory Item operations
  getInventoryItem(id: string): Promise<InventoryItem | undefined>;
  getInventoryItemsByRestaurant(restaurantId: string): Promise<InventoryItem[]>;
  getInventoryItemsByCategory(restaurantId: string, category: string): Promise<InventoryItem[]>;
  getLowStockItems(restaurantId: string): Promise<InventoryItem[]>;
  searchInventoryItems(restaurantId: string, query: string, limit?: number): Promise<InventoryItem[]>;
  createInventoryItem(item: InsertInventoryItem): Promise<InventoryItem>;
  updateInventoryItem(id: string, data: Partial<InventoryItem>): Promise<InventoryItem | undefined>;
  deleteInventoryItem(id: string): Promise<boolean>;

  // Inventory Log operations
  getInventoryLog(id: string): Promise<InventoryLog | undefined>;
  getInventoryLogsByItem(inventoryItemId: string): Promise<InventoryLog[]>;
  getInventoryLogsByRestaurant(restaurantId: string): Promise<InventoryLog[]>;
  getInventoryLogsFiltered(
    restaurantId: string,
    filters: {
      itemId?: string;
      startDate?: Date;
      endDate?: Date;
      changeType?: string;
    }
  ): Promise<InventoryLog[]>;
  createInventoryLog(log: InsertInventoryLog): Promise<InventoryLog>;

  // Recipe operations
  getRecipe(id: string): Promise<Recipe | undefined>;
  getRecipesByRestaurant(restaurantId: string): Promise<Recipe[]>;
  createRecipe(recipe: InsertRecipe): Promise<Recipe>;
  updateRecipe(id: string, data: Partial<Recipe>): Promise<Recipe | undefined>;
  deleteRecipe(id: string): Promise<boolean>;

  // Cleaning Task operations
  getCleaningTask(id: string): Promise<CleaningTask | undefined>;
  getCleaningTasksByRestaurant(restaurantId: string): Promise<CleaningTask[]>;
  getCleaningTasksByFrequency(restaurantId: string, frequency: string): Promise<CleaningTask[]>;
  createCleaningTask(task: InsertCleaningTask): Promise<CleaningTask>;
  updateCleaningTask(id: string, data: Partial<CleaningTask>): Promise<CleaningTask | undefined>;
  deleteCleaningTask(id: string): Promise<boolean>;

  // Cleaning Log operations
  getCleaningLog(id: string): Promise<CleaningLog | undefined>;
  getCleaningLogsByTask(taskId: string): Promise<CleaningLog[]>;
  getCleaningLogsByUser(userId: string): Promise<CleaningLog[]>;
  createCleaningLog(log: InsertCleaningLog): Promise<CleaningLog>;
}

// ============================================================================
// IN-MEMORY STORAGE IMPLEMENTATION
// ============================================================================

export class MemStorage implements IStorage {
  private restaurants: Map<string, Restaurant>;
  private users: Map<string, User>;
  private inventoryItems: Map<string, InventoryItem>;
  private inventoryLogs: Map<string, InventoryLog>;
  private recipes: Map<string, Recipe>;
  private cleaningTasks: Map<string, CleaningTask>;
  private cleaningLogs: Map<string, CleaningLog>;

  constructor() {
    this.restaurants = new Map();
    this.users = new Map();
    this.inventoryItems = new Map();
    this.inventoryLogs = new Map();
    this.recipes = new Map();
    this.cleaningTasks = new Map();
    this.cleaningLogs = new Map();

    // Seed two restaurants
    this.seedRestaurants();
  }

  private async seedRestaurants() {
    const restaurant1: Restaurant = {
      id: "rest-a-001",
      name: "Restaurant A",
      createdAt: new Date(),
    };
    const restaurant2: Restaurant = {
      id: "rest-b-002",
      name: "Restaurant B",
      createdAt: new Date(),
    };
    this.restaurants.set(restaurant1.id, restaurant1);
    this.restaurants.set(restaurant2.id, restaurant2);

    // Seed sample inventory items for testing
    this.seedInventoryItems(restaurant1.id, restaurant2.id);
    
    // Seed demo users for testing
    this.seedUsers(restaurant1.id, restaurant2.id);
  }

  private async seedUsers(restaurantAId: string, restaurantBId: string) {
    // Pre-hashed password for "demo123" using bcrypt
    const hashedPassword = "$2b$10$JSQ8BRE5tCtGtWqFrAZ68.yL/VjHuVoJfFgDZu0q.TugBcCbhfaeW";
    
    const users: User[] = [
      {
        id: "user-admin-001",
        name: "Admin User",
        email: "admin@demo.com",
        passwordHash: hashedPassword,
        role: "admin",
        restaurantId: restaurantAId,
        createdAt: new Date(),
      },
      {
        id: "user-manager-001",
        name: "Manager A",
        email: "manager@demo.com",
        passwordHash: hashedPassword,
        role: "manager",
        restaurantId: restaurantAId,
        createdAt: new Date(),
      },
      {
        id: "user-manager-002",
        name: "Manager B",
        email: "managerb@demo.com",
        passwordHash: hashedPassword,
        role: "manager",
        restaurantId: restaurantBId,
        createdAt: new Date(),
      },
      {
        id: "user-staff-001",
        name: "Staff User",
        email: "staff@demo.com",
        passwordHash: hashedPassword,
        role: "staff",
        restaurantId: restaurantAId,
        createdAt: new Date(),
      },
    ];
    
    users.forEach(user => this.users.set(user.id, user));
  }

  private async seedInventoryItems(restaurantAId: string, restaurantBId: string) {
    const items: InventoryItem[] = [
      { id: "inv-001", restaurantId: restaurantAId, name: "Tomatoes", category: "Produce", unit: "kg", quantity: "25", lowStockThreshold: "10", createdAt: new Date(), updatedAt: new Date() },
      { id: "inv-002", restaurantId: restaurantAId, name: "Onions", category: "Produce", unit: "kg", quantity: "15", lowStockThreshold: "5", createdAt: new Date(), updatedAt: new Date() },
      { id: "inv-003", restaurantId: restaurantAId, name: "Olive Oil", category: "Pantry", unit: "liters", quantity: "10", lowStockThreshold: "3", createdAt: new Date(), updatedAt: new Date() },
      { id: "inv-004", restaurantId: restaurantAId, name: "Chicken Breast", category: "Meat", unit: "kg", quantity: "20", lowStockThreshold: "8", createdAt: new Date(), updatedAt: new Date() },
      { id: "inv-005", restaurantId: restaurantAId, name: "Salmon Fillet", category: "Seafood", unit: "kg", quantity: "12", lowStockThreshold: "5", createdAt: new Date(), updatedAt: new Date() },
      { id: "inv-006", restaurantId: restaurantAId, name: "Parmesan Cheese", category: "Dairy", unit: "kg", quantity: "5", lowStockThreshold: "2", createdAt: new Date(), updatedAt: new Date() },
      { id: "inv-007", restaurantId: restaurantAId, name: "Fresh Basil", category: "Herbs", unit: "bunches", quantity: "8", lowStockThreshold: "3", createdAt: new Date(), updatedAt: new Date() },
      { id: "inv-008", restaurantId: restaurantAId, name: "Garlic", category: "Produce", unit: "kg", quantity: "3", lowStockThreshold: "1", createdAt: new Date(), updatedAt: new Date() },
      { id: "inv-009", restaurantId: restaurantBId, name: "Potatoes", category: "Produce", unit: "kg", quantity: "30", lowStockThreshold: "15", createdAt: new Date(), updatedAt: new Date() },
      { id: "inv-010", restaurantId: restaurantBId, name: "Beef Tenderloin", category: "Meat", unit: "kg", quantity: "15", lowStockThreshold: "5", createdAt: new Date(), updatedAt: new Date() },
    ];
    items.forEach(item => this.inventoryItems.set(item.id, item));

    // Seed inventory logs for analytics testing
    this.seedInventoryLogs(restaurantAId);
  }

  private async seedInventoryLogs(restaurantId: string) {
    const now = new Date();
    const logs: InventoryLog[] = [];
    
    // Generate 30 days of sample log data
    for (let day = 0; day < 30; day++) {
      const date = new Date(now);
      date.setDate(date.getDate() - day);
      
      // Deliveries (positive changes) - typically 2-3 per week
      if (day % 3 === 0) {
        logs.push({
          id: `log-del-${day}-001`,
          inventoryItemId: "inv-001",
          restaurantId,
          changeType: "Delivery",
          quantityChanged: String(Math.floor(Math.random() * 20) + 10),
          finalQuantity: "25",
          createdAt: date,
          createdBy: null,
          notes: "Weekly delivery"
        });
        logs.push({
          id: `log-del-${day}-004`,
          inventoryItemId: "inv-004",
          restaurantId,
          changeType: "Delivery",
          quantityChanged: String(Math.floor(Math.random() * 15) + 5),
          finalQuantity: "20",
          createdAt: date,
          createdBy: null,
          notes: "Meat delivery"
        });
      }
      
      // End of day counts (usage - negative changes) - daily
      logs.push({
        id: `log-eod-${day}-001`,
        inventoryItemId: "inv-001",
        restaurantId,
        changeType: "EndOfDayCount",
        quantityChanged: String(-(Math.floor(Math.random() * 5) + 2)),
        finalQuantity: String(25 - Math.floor(Math.random() * 10)),
        createdAt: date,
        createdBy: null,
        notes: "Daily usage"
      });
      logs.push({
        id: `log-eod-${day}-004`,
        inventoryItemId: "inv-004",
        restaurantId,
        changeType: "EndOfDayCount",
        quantityChanged: String(-(Math.floor(Math.random() * 3) + 1)),
        finalQuantity: String(20 - Math.floor(Math.random() * 5)),
        createdAt: date,
        createdBy: null,
        notes: "Daily usage"
      });
      
      // Occasional adjustments
      if (day % 7 === 0) {
        logs.push({
          id: `log-adj-${day}`,
          inventoryItemId: "inv-003",
          restaurantId,
          changeType: "Adjustment",
          quantityChanged: String(Math.floor(Math.random() * 4) - 2),
          finalQuantity: "10",
          createdAt: date,
          createdBy: null,
          notes: "Inventory correction"
        });
      }
    }
    
    logs.forEach(log => this.inventoryLogs.set(log.id, log));
  }

  // -------------------------------------------------------------------------
  // Restaurant Operations
  // -------------------------------------------------------------------------

  async getRestaurant(id: string): Promise<Restaurant | undefined> {
    return this.restaurants.get(id);
  }

  async getRestaurantByName(name: string): Promise<Restaurant | undefined> {
    return Array.from(this.restaurants.values()).find((r) => r.name === name);
  }

  async getAllRestaurants(): Promise<Restaurant[]> {
    return Array.from(this.restaurants.values());
  }

  async createRestaurant(data: InsertRestaurant): Promise<Restaurant> {
    const id = randomUUID();
    const restaurant: Restaurant = {
      id,
      name: data.name,
      createdAt: new Date(),
    };
    this.restaurants.set(id, restaurant);
    return restaurant;
  }

  async updateRestaurant(id: string, data: Partial<Restaurant>): Promise<Restaurant | undefined> {
    const restaurant = this.restaurants.get(id);
    if (!restaurant) return undefined;
    const updated = { ...restaurant, ...data };
    this.restaurants.set(id, updated);
    return updated;
  }

  async deleteRestaurant(id: string): Promise<boolean> {
    return this.restaurants.delete(id);
  }

  // -------------------------------------------------------------------------
  // User Operations
  // -------------------------------------------------------------------------

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find((u) => u.email === email);
  }

  async getUsersByRestaurant(restaurantId: string): Promise<User[]> {
    return Array.from(this.users.values()).filter((u) => u.restaurantId === restaurantId);
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async createUser(data: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = {
      id,
      name: data.name,
      email: data.email,
      passwordHash: data.passwordHash,
      role: data.role || UserRole.STAFF,
      restaurantId: data.restaurantId || null,
      createdAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: string, data: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    const updated = { ...user, ...data };
    this.users.set(id, updated);
    return updated;
  }

  async deleteUser(id: string): Promise<boolean> {
    return this.users.delete(id);
  }

  // -------------------------------------------------------------------------
  // Inventory Item Operations
  // -------------------------------------------------------------------------

  async getInventoryItem(id: string): Promise<InventoryItem | undefined> {
    return this.inventoryItems.get(id);
  }

  async getInventoryItemsByRestaurant(restaurantId: string): Promise<InventoryItem[]> {
    return Array.from(this.inventoryItems.values()).filter((i) => i.restaurantId === restaurantId);
  }

  async getInventoryItemsByCategory(restaurantId: string, category: string): Promise<InventoryItem[]> {
    return Array.from(this.inventoryItems.values()).filter(
      (i) => i.restaurantId === restaurantId && i.category === category
    );
  }

  async getLowStockItems(restaurantId: string): Promise<InventoryItem[]> {
    return Array.from(this.inventoryItems.values()).filter(
      (i) => i.restaurantId === restaurantId && parseFloat(i.quantity) <= parseFloat(i.lowStockThreshold)
    );
  }

  async searchInventoryItems(restaurantId: string, query: string, limit: number = 10): Promise<InventoryItem[]> {
    const normalizedQuery = query.toLowerCase().trim();
    if (!normalizedQuery) {
      return [];
    }
    
    const results = Array.from(this.inventoryItems.values())
      .filter((item) => 
        item.restaurantId === restaurantId && 
        item.name.toLowerCase().includes(normalizedQuery)
      )
      .slice(0, limit);
    
    return results;
  }

  async createInventoryItem(data: InsertInventoryItem): Promise<InventoryItem> {
    const id = randomUUID();
    const item: InventoryItem = {
      id,
      restaurantId: data.restaurantId,
      name: data.name,
      category: data.category,
      unit: data.unit,
      quantity: data.quantity || "0",
      lowStockThreshold: data.lowStockThreshold || "0",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.inventoryItems.set(id, item);
    return item;
  }

  async updateInventoryItem(id: string, data: Partial<InventoryItem>): Promise<InventoryItem | undefined> {
    const item = this.inventoryItems.get(id);
    if (!item) return undefined;
    const updated = { ...item, ...data, updatedAt: new Date() };
    this.inventoryItems.set(id, updated);
    return updated;
  }

  async deleteInventoryItem(id: string): Promise<boolean> {
    return this.inventoryItems.delete(id);
  }

  // -------------------------------------------------------------------------
  // Inventory Log Operations
  // -------------------------------------------------------------------------

  async getInventoryLog(id: string): Promise<InventoryLog | undefined> {
    return this.inventoryLogs.get(id);
  }

  async getInventoryLogsByItem(inventoryItemId: string): Promise<InventoryLog[]> {
    return Array.from(this.inventoryLogs.values())
      .filter((l) => l.inventoryItemId === inventoryItemId)
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }

  async getInventoryLogsByRestaurant(restaurantId: string): Promise<InventoryLog[]> {
    return Array.from(this.inventoryLogs.values())
      .filter((l) => l.restaurantId === restaurantId)
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }

  async getInventoryLogsFiltered(
    restaurantId: string,
    filters: {
      itemId?: string;
      startDate?: Date;
      endDate?: Date;
      changeType?: string;
    }
  ): Promise<InventoryLog[]> {
    return Array.from(this.inventoryLogs.values())
      .filter((log) => {
        if (log.restaurantId !== restaurantId) return false;
        if (filters.itemId && log.inventoryItemId !== filters.itemId) return false;
        if (filters.changeType && log.changeType !== filters.changeType) return false;
        if (filters.startDate && log.createdAt && log.createdAt < filters.startDate) return false;
        if (filters.endDate && log.createdAt) {
          // Make end date inclusive by comparing against end of day
          const endOfDay = new Date(filters.endDate);
          endOfDay.setHours(23, 59, 59, 999);
          if (log.createdAt > endOfDay) return false;
        }
        return true;
      })
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }

  async createInventoryLog(data: InsertInventoryLog): Promise<InventoryLog> {
    const id = randomUUID();
    const log: InventoryLog = {
      id,
      inventoryItemId: data.inventoryItemId,
      restaurantId: data.restaurantId,
      changeType: data.changeType,
      quantityChanged: data.quantityChanged,
      finalQuantity: data.finalQuantity,
      createdAt: new Date(),
      createdBy: data.createdBy || null,
      notes: data.notes || null,
    };
    this.inventoryLogs.set(id, log);
    return log;
  }

  // -------------------------------------------------------------------------
  // Recipe Operations
  // -------------------------------------------------------------------------

  async getRecipe(id: string): Promise<Recipe | undefined> {
    return this.recipes.get(id);
  }

  async getRecipesByRestaurant(restaurantId: string): Promise<Recipe[]> {
    return Array.from(this.recipes.values()).filter((r) => r.restaurantId === restaurantId);
  }

  async createRecipe(data: InsertRecipe): Promise<Recipe> {
    const id = randomUUID();
    const recipe: Recipe = {
      id,
      restaurantId: data.restaurantId,
      name: data.name,
      ingredients: (data.ingredients || []) as Recipe["ingredients"],
      instructions: data.instructions || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.recipes.set(id, recipe);
    return recipe;
  }

  async updateRecipe(id: string, data: Partial<Recipe>): Promise<Recipe | undefined> {
    const recipe = this.recipes.get(id);
    if (!recipe) return undefined;
    const updated = { ...recipe, ...data, updatedAt: new Date() };
    this.recipes.set(id, updated);
    return updated;
  }

  async deleteRecipe(id: string): Promise<boolean> {
    return this.recipes.delete(id);
  }

  // -------------------------------------------------------------------------
  // Cleaning Task Operations
  // -------------------------------------------------------------------------

  async getCleaningTask(id: string): Promise<CleaningTask | undefined> {
    return this.cleaningTasks.get(id);
  }

  async getCleaningTasksByRestaurant(restaurantId: string): Promise<CleaningTask[]> {
    return Array.from(this.cleaningTasks.values()).filter((t) => t.restaurantId === restaurantId);
  }

  async getCleaningTasksByFrequency(restaurantId: string, frequency: string): Promise<CleaningTask[]> {
    return Array.from(this.cleaningTasks.values()).filter(
      (t) => t.restaurantId === restaurantId && t.frequency === frequency
    );
  }

  async createCleaningTask(data: InsertCleaningTask): Promise<CleaningTask> {
    const id = randomUUID();
    const task: CleaningTask = {
      id,
      restaurantId: data.restaurantId,
      name: data.name,
      frequency: data.frequency,
      createdAt: new Date(),
    };
    this.cleaningTasks.set(id, task);
    return task;
  }

  async updateCleaningTask(id: string, data: Partial<CleaningTask>): Promise<CleaningTask | undefined> {
    const task = this.cleaningTasks.get(id);
    if (!task) return undefined;
    const updated = { ...task, ...data };
    this.cleaningTasks.set(id, updated);
    return updated;
  }

  async deleteCleaningTask(id: string): Promise<boolean> {
    return this.cleaningTasks.delete(id);
  }

  // -------------------------------------------------------------------------
  // Cleaning Log Operations
  // -------------------------------------------------------------------------

  async getCleaningLog(id: string): Promise<CleaningLog | undefined> {
    return this.cleaningLogs.get(id);
  }

  async getCleaningLogsByTask(taskId: string): Promise<CleaningLog[]> {
    return Array.from(this.cleaningLogs.values())
      .filter((l) => l.cleaningTaskId === taskId)
      .sort((a, b) => (b.completedAt?.getTime() || 0) - (a.completedAt?.getTime() || 0));
  }

  async getCleaningLogsByUser(userId: string): Promise<CleaningLog[]> {
    return Array.from(this.cleaningLogs.values())
      .filter((l) => l.completedBy === userId)
      .sort((a, b) => (b.completedAt?.getTime() || 0) - (a.completedAt?.getTime() || 0));
  }

  async createCleaningLog(data: InsertCleaningLog): Promise<CleaningLog> {
    const id = randomUUID();
    const log: CleaningLog = {
      id,
      cleaningTaskId: data.cleaningTaskId,
      completedBy: data.completedBy,
      completedAt: new Date(),
      notes: data.notes || null,
    };
    this.cleaningLogs.set(id, log);
    return log;
  }
}

// Export singleton storage instance
export const storage = new MemStorage();
