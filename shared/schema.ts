import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, json, index, decimal, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ============================================================================
// ENUMS
// ============================================================================

export const UserRole = {
  ADMIN: "admin",
  MANAGER: "manager",
  STAFF: "staff",
} as const;

export type UserRoleType = (typeof UserRole)[keyof typeof UserRole];

export const ChangeType = {
  DELIVERY: "Delivery",
  END_OF_DAY_COUNT: "EndOfDayCount",
  ADJUSTMENT: "Adjustment",
} as const;

export type ChangeTypeValue = (typeof ChangeType)[keyof typeof ChangeType];

// ============================================================================
// RESTAURANTS TABLE
// ============================================================================

export const restaurants = pgTable("restaurants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertRestaurantSchema = createInsertSchema(restaurants).pick({
  name: true,
});

export type InsertRestaurant = z.infer<typeof insertRestaurantSchema>;
export type Restaurant = typeof restaurants.$inferSelect;

// ============================================================================
// USERS TABLE
// ============================================================================

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default(UserRole.STAFF),
  restaurantId: varchar("restaurant_id").references(() => restaurants.id),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("users_email_idx").on(table.email),
  index("users_restaurant_idx").on(table.restaurantId),
  index("users_role_idx").on(table.role),
]);

export const insertUserSchema = createInsertSchema(users).pick({
  name: true,
  email: true,
  passwordHash: true,
  role: true,
  restaurantId: true,
});

export const registerUserSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum([UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF]).optional(),
  restaurantId: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type RegisterCredentials = z.infer<typeof registerUserSchema>;
export type LoginCredentials = z.infer<typeof loginSchema>;

// JWT Payload type
export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRoleType;
  restaurantId: string | null;
}

// ============================================================================
// INVENTORY ITEMS TABLE
// ============================================================================

export const inventoryItems = pgTable("inventory_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  restaurantId: varchar("restaurant_id").notNull().references(() => restaurants.id),
  name: text("name").notNull(),
  category: text("category").notNull(),
  unit: text("unit").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull().default("0"),
  lowStockThreshold: decimal("low_stock_threshold", { precision: 10, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("inventory_restaurant_idx").on(table.restaurantId),
  index("inventory_category_idx").on(table.category),
  index("inventory_name_idx").on(table.name),
]);

export const insertInventoryItemSchema = createInsertSchema(inventoryItems).pick({
  restaurantId: true,
  name: true,
  category: true,
  unit: true,
  quantity: true,
  lowStockThreshold: true,
});

// Client-facing schema (restaurantId is set by server from auth)
export const createInventoryItemSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  category: z.string().min(1, "Category is required").max(100),
  unit: z.string().min(1, "Unit is required").max(50),
  quantity: z.union([z.string(), z.number()]).optional().default("0"),
  lowStockThreshold: z.union([z.string(), z.number()]).optional().default("0"),
});

export const updateInventoryItemSchema = createInventoryItemSchema.partial();

export type InsertInventoryItem = z.infer<typeof insertInventoryItemSchema>;
export type InventoryItem = typeof inventoryItems.$inferSelect;

// ============================================================================
// INVENTORY LOGS TABLE
// ============================================================================

export const inventoryLogs = pgTable("inventory_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  inventoryItemId: varchar("inventory_item_id").notNull().references(() => inventoryItems.id),
  restaurantId: varchar("restaurant_id").notNull().references(() => restaurants.id),
  changeType: text("change_type").notNull(), // "Delivery" | "EndOfDayCount" | "Adjustment"
  quantityChanged: decimal("quantity_changed", { precision: 10, scale: 2 }).notNull(),
  finalQuantity: decimal("final_quantity", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by").references(() => users.id),
  notes: text("notes"),
}, (table) => [
  index("inventory_logs_item_idx").on(table.inventoryItemId),
  index("inventory_logs_restaurant_idx").on(table.restaurantId),
  index("inventory_logs_created_at_idx").on(table.createdAt),
  index("inventory_logs_change_type_idx").on(table.changeType),
]);

export const insertInventoryLogSchema = createInsertSchema(inventoryLogs).pick({
  inventoryItemId: true,
  restaurantId: true,
  changeType: true,
  quantityChanged: true,
  finalQuantity: true,
  createdBy: true,
  notes: true,
});

// Client-facing schema for creating inventory logs
export const createInventoryLogSchema = z.object({
  inventoryItemId: z.string().min(1, "Inventory item is required"),
  changeType: z.enum([ChangeType.DELIVERY, ChangeType.END_OF_DAY_COUNT, ChangeType.ADJUSTMENT], {
    errorMap: () => ({ message: "Invalid change type" }),
  }),
  quantityChanged: z.union([z.string(), z.number()]),
  notes: z.string().max(1000).optional(),
});

export const updateInventoryLogSchema = z.object({
  notes: z.string().max(1000).optional(),
});

export type InsertInventoryLog = z.infer<typeof insertInventoryLogSchema>;
export type InventoryLog = typeof inventoryLogs.$inferSelect;

// ============================================================================
// RECIPES TABLE
// ============================================================================

export const recipes = pgTable("recipes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  dishBase: text("dish_base"),
  instructions: text("instructions"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  category: text("category"),
  diet: text("diet"),
  dishSauce: text("dish_sauce"),
  timingMinutes: integer("timing_minutes"),
}, (table) => [
  index("recipes_name_idx").on(table.name),
  index("recipes_category_idx").on(table.category),
]);

export const insertRecipeSchema = createInsertSchema(recipes).pick({
  name: true,
  dishBase: true,
  instructions: true,
  category: true,
  diet: true,
  dishSauce: true,
  timingMinutes: true,
});

// Client-facing schemas for recipe operations
export const createRecipeSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  category: z.string().optional().nullable(),
  dishBase: z.string().max(200).optional().nullable(),
  dishSauce: z.string().max(200).optional().nullable(),
  diet: z.string().max(100).optional().nullable(),
  timingMinutes: z.number().int().positive().optional().nullable(),
  instructions: z.string().max(5000).optional().nullable(),
});

export const updateRecipeSchema = createRecipeSchema.partial();

export type InsertRecipe = z.infer<typeof insertRecipeSchema>;
export type Recipe = typeof recipes.$inferSelect;

// ============================================================================
// CLEANING TASKS TABLE
// ============================================================================

export const cleaningTasks = pgTable("cleaning_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  restaurantId: varchar("restaurant_id").notNull().references(() => restaurants.id),
  day: text("day"), // e.g., "Monday", "Tuesday", etc.
  isActive: boolean("is_active").default(true),
  station: text("station"), // e.g., "Kitchen", "Prep Area", "Front Counter"
  task: text("task"), // The specific cleaning task description
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("cleaning_tasks_restaurant_idx").on(table.restaurantId),
  index("cleaning_tasks_station_idx").on(table.station),
]);

export const insertCleaningTaskSchema = createInsertSchema(cleaningTasks).pick({
  restaurantId: true,
  day: true,
  isActive: true,
  station: true,
  task: true,
});

export type InsertCleaningTask = z.infer<typeof insertCleaningTaskSchema>;
export type CleaningTask = typeof cleaningTasks.$inferSelect;

// ============================================================================
// CLEANING LOGS TABLE
// ============================================================================

export const cleaningLogs = pgTable("cleaning_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  cleaningTaskId: varchar("cleaning_task_id").notNull().references(() => cleaningTasks.id),
  completedBy: varchar("completed_by").notNull().references(() => users.id),
  completedAt: timestamp("completed_at").defaultNow(),
  notes: text("notes"),
}, (table) => [
  index("cleaning_logs_task_idx").on(table.cleaningTaskId),
  index("cleaning_logs_completed_by_idx").on(table.completedBy),
  index("cleaning_logs_completed_at_idx").on(table.completedAt),
]);

export const insertCleaningLogSchema = createInsertSchema(cleaningLogs).pick({
  cleaningTaskId: true,
  completedBy: true,
  notes: true,
});

export type InsertCleaningLog = z.infer<typeof insertCleaningLogSchema>;
export type CleaningLog = typeof cleaningLogs.$inferSelect;
