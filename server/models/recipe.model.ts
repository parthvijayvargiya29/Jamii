/**
 * Recipe Model
 * 
 * This file contains the Recipe model interface for database operations.
 */

import type { Recipe, InsertRecipe } from "@shared/schema";

// Recipe model interface for database operations
export interface IRecipeModel {
  findById(id: string): Promise<Recipe | undefined>;
  findByRestaurant(restaurantId: string): Promise<Recipe[]>;
  create(recipe: InsertRecipe): Promise<Recipe>;
  update(id: string, data: Partial<Recipe>): Promise<Recipe | undefined>;
  delete(id: string): Promise<boolean>;
}
