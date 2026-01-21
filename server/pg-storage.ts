/**
 * PostgreSQL Storage Implementation
 * 
 * This module implements the IStorage interface using PostgreSQL.
 * Uses column aliasing in SQL to convert snake_case to camelCase.
 */

import { pool } from "./db";
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
  type CleaningLogWithDetails,
  UserRole,
} from "@shared/schema";
import type { IStorage } from "./storage";

// SQL SELECT statements with column aliasing for camelCase output
const RESTAURANT_SELECT = `
  id, name, created_at AS "createdAt"
`;

const USER_SELECT = `
  id, name, email, password_hash AS "passwordHash", role, 
  restaurant_id AS "restaurantId", created_at AS "createdAt"
`;

const INVENTORY_ITEM_SELECT = `
  id, restaurant_id AS "restaurantId", item, storage, unit, 
  quantity, low_stock_threshold AS "lowStockThreshold", 
  created_at AS "createdAt"
`;

const INVENTORY_LOG_SELECT = `
  id, inventory_item_id AS "inventoryItemId", restaurant_id AS "restaurantId",
  change_type AS "changeType", quantity_changed AS "quantityChanged", 
  final_quantity AS "finalQuantity", created_at AS "createdAt", 
  created_by AS "createdBy", notes
`;

const RECIPE_SELECT = `
  id, name, dish_base AS "dishBase", instructions, 
  created_at AS "createdAt", updated_at AS "updatedAt",
  category, diet, dish_sauce AS "dishSauce", timing_minutes AS "timingMinutes",
  post_type AS "postType", image_url AS "imageUrl"
`;

const CLEANING_TASK_SELECT = `
  id, restaurant_id AS "restaurantId", day, is_active AS "isActive", station, task, created_at AS "createdAt"
`;

const CLEANING_LOG_SELECT = `
  id, cleaning_task_id AS "cleaningTaskId", completed_by AS "completedBy",
  completed_at AS "completedAt", notes
`;

export class PgStorage implements IStorage {
  // -------------------------------------------------------------------------
  // Restaurant Operations
  // -------------------------------------------------------------------------

  async getRestaurant(id: string): Promise<Restaurant | undefined> {
    const result = await pool.query(
      `SELECT ${RESTAURANT_SELECT} FROM restaurants WHERE id = $1`,
      [id]
    );
    return result.rows[0] as Restaurant | undefined;
  }

  async getRestaurantByName(name: string): Promise<Restaurant | undefined> {
    const result = await pool.query(
      `SELECT ${RESTAURANT_SELECT} FROM restaurants WHERE name = $1`,
      [name]
    );
    return result.rows[0] as Restaurant | undefined;
  }

  async getAllRestaurants(): Promise<Restaurant[]> {
    const result = await pool.query(
      `SELECT ${RESTAURANT_SELECT} FROM restaurants ORDER BY name`
    );
    return result.rows as Restaurant[];
  }

  async createRestaurant(data: InsertRestaurant): Promise<Restaurant> {
    const result = await pool.query(
      `INSERT INTO restaurants (name) VALUES ($1) RETURNING ${RESTAURANT_SELECT}`,
      [data.name]
    );
    return result.rows[0] as Restaurant;
  }

  async updateRestaurant(id: string, data: Partial<Restaurant>): Promise<Restaurant | undefined> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (data.name !== undefined) {
      fields.push(`name = $${idx++}`);
      values.push(data.name);
    }

    if (fields.length === 0) return this.getRestaurant(id);

    values.push(id);
    const result = await pool.query(
      `UPDATE restaurants SET ${fields.join(", ")} WHERE id = $${idx} RETURNING ${RESTAURANT_SELECT}`,
      values
    );
    return result.rows[0] as Restaurant | undefined;
  }

  async deleteRestaurant(id: string): Promise<boolean> {
    const result = await pool.query("DELETE FROM restaurants WHERE id = $1", [id]);
    return (result.rowCount ?? 0) > 0;
  }

  // -------------------------------------------------------------------------
  // User Operations
  // -------------------------------------------------------------------------

  async getUser(id: string): Promise<User | undefined> {
    const result = await pool.query(
      `SELECT ${USER_SELECT} FROM users WHERE id = $1`,
      [id]
    );
    return result.rows[0] as User | undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await pool.query(
      `SELECT ${USER_SELECT} FROM users WHERE email = $1`,
      [email]
    );
    return result.rows[0] as User | undefined;
  }

  async getUsersByRestaurant(restaurantId: string): Promise<User[]> {
    const result = await pool.query(
      `SELECT ${USER_SELECT} FROM users WHERE restaurant_id = $1 ORDER BY name`,
      [restaurantId]
    );
    return result.rows as User[];
  }

  async getAllUsers(): Promise<User[]> {
    const result = await pool.query(`SELECT ${USER_SELECT} FROM users ORDER BY name`);
    return result.rows as User[];
  }

  async createUser(data: InsertUser): Promise<User> {
    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, restaurant_id) 
       VALUES ($1, $2, $3, $4, $5) RETURNING ${USER_SELECT}`,
      [data.name, data.email, data.passwordHash, data.role || UserRole.STAFF, data.restaurantId || null]
    );
    return result.rows[0] as User;
  }

  async updateUser(id: string, data: Partial<User>): Promise<User | undefined> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (data.name !== undefined) { fields.push(`name = $${idx++}`); values.push(data.name); }
    if (data.email !== undefined) { fields.push(`email = $${idx++}`); values.push(data.email); }
    if (data.passwordHash !== undefined) { fields.push(`password_hash = $${idx++}`); values.push(data.passwordHash); }
    if (data.role !== undefined) { fields.push(`role = $${idx++}`); values.push(data.role); }
    if (data.restaurantId !== undefined) { fields.push(`restaurant_id = $${idx++}`); values.push(data.restaurantId); }

    if (fields.length === 0) return this.getUser(id);

    values.push(id);
    const result = await pool.query(
      `UPDATE users SET ${fields.join(", ")} WHERE id = $${idx} RETURNING ${USER_SELECT}`,
      values
    );
    return result.rows[0] as User | undefined;
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await pool.query("DELETE FROM users WHERE id = $1", [id]);
    return (result.rowCount ?? 0) > 0;
  }

  // -------------------------------------------------------------------------
  // Inventory Item Operations
  // -------------------------------------------------------------------------

  async getInventoryItem(id: string): Promise<InventoryItem | undefined> {
    const result = await pool.query(
      `SELECT ${INVENTORY_ITEM_SELECT} FROM inventory_items WHERE id = $1`,
      [id]
    );
    return result.rows[0] as InventoryItem | undefined;
  }

  async getInventoryItemsByRestaurant(restaurantId: string): Promise<InventoryItem[]> {
    const result = await pool.query(
      `SELECT ${INVENTORY_ITEM_SELECT} FROM inventory_items WHERE restaurant_id = $1 ORDER BY item`,
      [restaurantId]
    );
    return result.rows as InventoryItem[];
  }

  async getInventoryItemsByStorage(restaurantId: string, storage: string): Promise<InventoryItem[]> {
    const result = await pool.query(
      `SELECT ${INVENTORY_ITEM_SELECT} FROM inventory_items WHERE restaurant_id = $1 AND storage = $2 ORDER BY item`,
      [restaurantId, storage]
    );
    return result.rows as InventoryItem[];
  }

  async getLowStockItems(restaurantId: string): Promise<InventoryItem[]> {
    const result = await pool.query(
      `SELECT ${INVENTORY_ITEM_SELECT} FROM inventory_items WHERE restaurant_id = $1 AND quantity <= low_stock_threshold ORDER BY item`,
      [restaurantId]
    );
    return result.rows as InventoryItem[];
  }

  async searchInventoryItems(restaurantId: string, query: string, limit: number = 10): Promise<InventoryItem[]> {
    const result = await pool.query(
      `SELECT ${INVENTORY_ITEM_SELECT} FROM inventory_items 
       WHERE restaurant_id = $1 AND LOWER(item) LIKE LOWER($2) 
       ORDER BY item LIMIT $3`,
      [restaurantId, `%${query}%`, limit]
    );
    return result.rows as InventoryItem[];
  }

  async createInventoryItem(data: InsertInventoryItem): Promise<InventoryItem> {
    const result = await pool.query(
      `INSERT INTO inventory_items (restaurant_id, item, storage, unit, quantity, low_stock_threshold) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${INVENTORY_ITEM_SELECT}`,
      [data.restaurantId, data.item, data.storage, data.unit, data.quantity || 0, data.lowStockThreshold || 0]
    );
    return result.rows[0] as InventoryItem;
  }

  async updateInventoryItem(id: string, data: Partial<InventoryItem>): Promise<InventoryItem | undefined> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (data.item !== undefined) { fields.push(`item = $${idx++}`); values.push(data.item); }
    if (data.storage !== undefined) { fields.push(`storage = $${idx++}`); values.push(data.storage); }
    if (data.unit !== undefined) { fields.push(`unit = $${idx++}`); values.push(data.unit); }
    if (data.quantity !== undefined) { fields.push(`quantity = $${idx++}`); values.push(data.quantity); }
    if (data.lowStockThreshold !== undefined) { fields.push(`low_stock_threshold = $${idx++}`); values.push(data.lowStockThreshold); }

    if (fields.length === 0) return this.getInventoryItem(id);

    values.push(id);
    const result = await pool.query(
      `UPDATE inventory_items SET ${fields.join(", ")} WHERE id = $${idx} RETURNING ${INVENTORY_ITEM_SELECT}`,
      values
    );
    return result.rows[0] as InventoryItem | undefined;
  }

  async deleteInventoryItem(id: string): Promise<boolean> {
    const result = await pool.query("DELETE FROM inventory_items WHERE id = $1", [id]);
    return (result.rowCount ?? 0) > 0;
  }

  // -------------------------------------------------------------------------
  // Inventory Log Operations
  // -------------------------------------------------------------------------

  async getInventoryLog(id: string): Promise<InventoryLog | undefined> {
    const result = await pool.query(
      `SELECT ${INVENTORY_LOG_SELECT} FROM inventory_logs WHERE id = $1`,
      [id]
    );
    return result.rows[0] as InventoryLog | undefined;
  }

  async getInventoryLogsByItem(inventoryItemId: string): Promise<InventoryLog[]> {
    const result = await pool.query(
      `SELECT ${INVENTORY_LOG_SELECT} FROM inventory_logs WHERE inventory_item_id = $1 ORDER BY created_at DESC`,
      [inventoryItemId]
    );
    return result.rows as InventoryLog[];
  }

  async getInventoryLogsByRestaurant(restaurantId: string): Promise<InventoryLog[]> {
    const result = await pool.query(
      `SELECT ${INVENTORY_LOG_SELECT} FROM inventory_logs WHERE restaurant_id = $1 ORDER BY created_at DESC`,
      [restaurantId]
    );
    return result.rows as InventoryLog[];
  }

  async getInventoryLogsFiltered(
    restaurantId: string,
    filters: { itemId?: string; startDate?: Date; endDate?: Date; changeType?: string }
  ): Promise<InventoryLog[]> {
    const conditions = ["restaurant_id = $1"];
    const values: unknown[] = [restaurantId];
    let idx = 2;

    if (filters.itemId) {
      conditions.push(`inventory_item_id = $${idx++}`);
      values.push(filters.itemId);
    }
    if (filters.startDate) {
      conditions.push(`created_at >= $${idx++}`);
      values.push(filters.startDate);
    }
    if (filters.endDate) {
      conditions.push(`created_at <= $${idx++}`);
      values.push(filters.endDate);
    }
    if (filters.changeType) {
      conditions.push(`change_type = $${idx++}`);
      values.push(filters.changeType);
    }

    const result = await pool.query(
      `SELECT ${INVENTORY_LOG_SELECT} FROM inventory_logs WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC`,
      values
    );
    return result.rows as InventoryLog[];
  }

  async createInventoryLog(data: InsertInventoryLog): Promise<InventoryLog> {
    const result = await pool.query(
      `INSERT INTO inventory_logs (inventory_item_id, restaurant_id, change_type, quantity_changed, final_quantity, created_by, notes) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING ${INVENTORY_LOG_SELECT}`,
      [data.inventoryItemId, data.restaurantId, data.changeType, data.quantityChanged, data.finalQuantity, data.createdBy || null, data.notes || null]
    );
    return result.rows[0] as InventoryLog;
  }

  async updateInventoryLog(id: string, data: Partial<InventoryLog>): Promise<InventoryLog | undefined> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (data.changeType !== undefined) { fields.push(`change_type = $${idx++}`); values.push(data.changeType); }
    if (data.quantityChanged !== undefined) { fields.push(`quantity_changed = $${idx++}`); values.push(data.quantityChanged); }
    if (data.finalQuantity !== undefined) { fields.push(`final_quantity = $${idx++}`); values.push(data.finalQuantity); }
    if (data.notes !== undefined) { fields.push(`notes = $${idx++}`); values.push(data.notes); }

    if (fields.length === 0) return this.getInventoryLog(id);

    values.push(id);
    const result = await pool.query(
      `UPDATE inventory_logs SET ${fields.join(", ")} WHERE id = $${idx} RETURNING ${INVENTORY_LOG_SELECT}`,
      values
    );
    return result.rows[0] as InventoryLog | undefined;
  }

  async deleteInventoryLog(id: string): Promise<boolean> {
    const result = await pool.query("DELETE FROM inventory_logs WHERE id = $1", [id]);
    return (result.rowCount ?? 0) > 0;
  }

  // -------------------------------------------------------------------------
  // Recipe Operations
  // -------------------------------------------------------------------------

  async getRecipe(id: string): Promise<Recipe | undefined> {
    const result = await pool.query(
      `SELECT ${RECIPE_SELECT} FROM recipes WHERE id = $1`,
      [id]
    );
    return result.rows[0] as Recipe | undefined;
  }

  async getRecipesByRestaurant(_restaurantId: string): Promise<Recipe[]> {
    return this.getAllRecipes();
  }

  async getAllRecipes(): Promise<Recipe[]> {
    const result = await pool.query(
      `SELECT ${RECIPE_SELECT} FROM recipes ORDER BY name`
    );
    return result.rows as Recipe[];
  }

  async createRecipe(data: InsertRecipe): Promise<Recipe> {
    const result = await pool.query(
      `INSERT INTO recipes (name, category, dish_base, dish_sauce, diet, timing_minutes, instructions, post_type, image_url) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING ${RECIPE_SELECT}`,
      [
        data.name, 
        data.category || null, 
        data.dishBase || null, 
        data.dishSauce || null, 
        data.diet || null, 
        data.timingMinutes || null, 
        data.instructions || null,
        data.postType || null,
        data.imageUrl || null
      ]
    );
    return result.rows[0] as Recipe;
  }

  async updateRecipe(id: string, data: Partial<Recipe>): Promise<Recipe | undefined> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (data.name !== undefined) { fields.push(`name = $${idx++}`); values.push(data.name); }
    if (data.category !== undefined) { fields.push(`category = $${idx++}`); values.push(data.category); }
    if (data.dishBase !== undefined) { fields.push(`dish_base = $${idx++}`); values.push(data.dishBase); }
    if (data.dishSauce !== undefined) { fields.push(`dish_sauce = $${idx++}`); values.push(data.dishSauce); }
    if (data.diet !== undefined) { fields.push(`diet = $${idx++}`); values.push(data.diet); }
    if (data.timingMinutes !== undefined) { fields.push(`timing_minutes = $${idx++}`); values.push(data.timingMinutes); }
    if (data.instructions !== undefined) { fields.push(`instructions = $${idx++}`); values.push(data.instructions); }
    if (data.postType !== undefined) { fields.push(`post_type = $${idx++}`); values.push(data.postType); }
    if (data.imageUrl !== undefined) { fields.push(`image_url = $${idx++}`); values.push(data.imageUrl); }
    
    fields.push(`updated_at = $${idx++}`);
    values.push(new Date());

    values.push(id);
    const result = await pool.query(
      `UPDATE recipes SET ${fields.join(", ")} WHERE id = $${idx} RETURNING ${RECIPE_SELECT}`,
      values
    );
    return result.rows[0] as Recipe | undefined;
  }

  async deleteRecipe(id: string): Promise<boolean> {
    const result = await pool.query("DELETE FROM recipes WHERE id = $1", [id]);
    return (result.rowCount ?? 0) > 0;
  }

  // -------------------------------------------------------------------------
  // Cleaning Task Operations
  // -------------------------------------------------------------------------

  async getCleaningTask(id: string): Promise<CleaningTask | undefined> {
    const result = await pool.query(
      `SELECT ${CLEANING_TASK_SELECT} FROM cleaning_tasks WHERE id = $1`,
      [id]
    );
    return result.rows[0] as CleaningTask | undefined;
  }

  async getCleaningTasksByRestaurant(restaurantId: string): Promise<CleaningTask[]> {
    const result = await pool.query(
      `SELECT ${CLEANING_TASK_SELECT} FROM cleaning_tasks WHERE restaurant_id = $1 ORDER BY station, day, task`,
      [restaurantId]
    );
    return result.rows as CleaningTask[];
  }

  async getCleaningTasksByStation(restaurantId: string, station: string): Promise<CleaningTask[]> {
    const result = await pool.query(
      `SELECT ${CLEANING_TASK_SELECT} FROM cleaning_tasks WHERE restaurant_id = $1 AND station = $2 ORDER BY day, task`,
      [restaurantId, station]
    );
    return result.rows as CleaningTask[];
  }

  async getCleaningTasksByDay(restaurantId: string, day: string): Promise<CleaningTask[]> {
    const result = await pool.query(
      `SELECT ${CLEANING_TASK_SELECT} FROM cleaning_tasks WHERE restaurant_id = $1 AND day = $2 ORDER BY station, task`,
      [restaurantId, day]
    );
    return result.rows as CleaningTask[];
  }

  async createCleaningTask(data: InsertCleaningTask): Promise<CleaningTask> {
    const result = await pool.query(
      `INSERT INTO cleaning_tasks (restaurant_id, day, is_active, station, task) 
       VALUES ($1, $2, $3, $4, $5) RETURNING ${CLEANING_TASK_SELECT}`,
      [data.restaurantId, data.day, data.isActive ?? true, data.station, data.task]
    );
    return result.rows[0] as CleaningTask;
  }

  async updateCleaningTask(id: string, data: Partial<CleaningTask>): Promise<CleaningTask | undefined> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (data.day !== undefined) { fields.push(`day = $${idx++}`); values.push(data.day); }
    if (data.isActive !== undefined) { fields.push(`is_active = $${idx++}`); values.push(data.isActive); }
    if (data.station !== undefined) { fields.push(`station = $${idx++}`); values.push(data.station); }
    if (data.task !== undefined) { fields.push(`task = $${idx++}`); values.push(data.task); }

    if (fields.length === 0) return this.getCleaningTask(id);

    values.push(id);
    const result = await pool.query(
      `UPDATE cleaning_tasks SET ${fields.join(", ")} WHERE id = $${idx} RETURNING ${CLEANING_TASK_SELECT}`,
      values
    );
    return result.rows[0] as CleaningTask | undefined;
  }

  async deleteCleaningTask(id: string): Promise<boolean> {
    const result = await pool.query("DELETE FROM cleaning_tasks WHERE id = $1", [id]);
    return (result.rowCount ?? 0) > 0;
  }

  // -------------------------------------------------------------------------
  // Cleaning Log Operations
  // -------------------------------------------------------------------------

  async getCleaningLog(id: string): Promise<CleaningLog | undefined> {
    const result = await pool.query(
      `SELECT ${CLEANING_LOG_SELECT} FROM cleaning_logs WHERE id = $1`,
      [id]
    );
    return result.rows[0] as CleaningLog | undefined;
  }

  async getCleaningLogsByTask(taskId: string): Promise<CleaningLog[]> {
    const result = await pool.query(
      `SELECT ${CLEANING_LOG_SELECT} FROM cleaning_logs WHERE cleaning_task_id = $1 ORDER BY completed_at DESC`,
      [taskId]
    );
    return result.rows as CleaningLog[];
  }

  async getCleaningLogsByUser(userId: string): Promise<CleaningLog[]> {
    const result = await pool.query(
      `SELECT ${CLEANING_LOG_SELECT} FROM cleaning_logs WHERE completed_by = $1 ORDER BY completed_at DESC`,
      [userId]
    );
    return result.rows as CleaningLog[];
  }

  async getCleaningLogsByRestaurant(restaurantId: string): Promise<CleaningLogWithDetails[]> {
    const result = await pool.query(
      `SELECT 
        cl.id, 
        cl.cleaning_task_id as "cleaningTaskId", 
        cl.completed_by as "completedBy", 
        cl.completed_at as "completedAt", 
        cl.notes,
        ct.task as "taskName",
        ct.station,
        ct.day,
        ct.restaurant_id as "restaurantId",
        r.name as "restaurantName",
        u.name as username
      FROM cleaning_logs cl
      JOIN cleaning_tasks ct ON cl.cleaning_task_id = ct.id
      JOIN users u ON cl.completed_by = u.id
      JOIN restaurants r ON ct.restaurant_id = r.id
      WHERE ct.restaurant_id = $1
      ORDER BY cl.completed_at DESC`,
      [restaurantId]
    );
    return result.rows as CleaningLogWithDetails[];
  }

  async getAllCleaningLogs(): Promise<CleaningLogWithDetails[]> {
    const result = await pool.query(
      `SELECT 
        cl.id, 
        cl.cleaning_task_id as "cleaningTaskId", 
        cl.completed_by as "completedBy", 
        cl.completed_at as "completedAt", 
        cl.notes,
        ct.task as "taskName",
        ct.station,
        ct.day,
        ct.restaurant_id as "restaurantId",
        r.name as "restaurantName",
        u.name as username
      FROM cleaning_logs cl
      JOIN cleaning_tasks ct ON cl.cleaning_task_id = ct.id
      JOIN users u ON cl.completed_by = u.id
      JOIN restaurants r ON ct.restaurant_id = r.id
      ORDER BY r.name, cl.completed_at DESC`
    );
    return result.rows as CleaningLogWithDetails[];
  }

  async createCleaningLog(data: InsertCleaningLog): Promise<CleaningLog> {
    const result = await pool.query(
      `INSERT INTO cleaning_logs (cleaning_task_id, completed_by, notes) 
       VALUES ($1, $2, $3) RETURNING ${CLEANING_LOG_SELECT}`,
      [data.cleaningTaskId, data.completedBy, data.notes || null]
    );
    return result.rows[0] as CleaningLog;
  }

  // -------------------------------------------------------------------------
  // Incomplete Task Detection (for notifications)
  // -------------------------------------------------------------------------

  async getIncompleteTasksForDay(
    restaurantId: string,
    dayOfWeek: string,
    dateStart: Date,
    dateEnd: Date
  ): Promise<{ taskId: string; taskName: string; station: string; day: string }[]> {
    const result = await pool.query(
      `SELECT 
        ct.id as "taskId",
        ct.task as "taskName",
        ct.station,
        ct.day
      FROM cleaning_tasks ct
      WHERE ct.restaurant_id = $1
        AND ct.is_active = true
        AND ct.day = $2
        AND NOT EXISTS (
          SELECT 1 FROM cleaning_logs cl
          WHERE cl.cleaning_task_id = ct.id
            AND cl.completed_at >= $3
            AND cl.completed_at < $4
        )
      ORDER BY ct.station, ct.task`,
      [restaurantId, dayOfWeek, dateStart, dateEnd]
    );
    return result.rows;
  }

  async getAdminsByRestaurant(restaurantId: string): Promise<{ id: string; name: string; email: string }[]> {
    // Get admins assigned to this restaurant OR global admins (restaurantId is null)
    const result = await pool.query(
      `SELECT id, name, email FROM users WHERE (restaurant_id = $1 OR restaurant_id IS NULL) AND role = $2`,
      [restaurantId, UserRole.ADMIN]
    );
    return result.rows;
  }
}
