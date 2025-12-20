/**
 * Recipe Routes
 * 
 * CRUD operations for recipes.
 * - All authenticated users can view recipes
 * - Only admin/manager can create, edit, delete
 */

import { Router } from "express";
import { storage } from "../storage";
import { insertRecipeSchema } from "@shared/schema";
import { 
  authenticateToken, 
  requireRestaurant, 
  authorizeRoles 
} from "../middleware/auth.middleware";
import { UserRole } from "@shared/schema";

const router = Router();

// Get all recipes for user's restaurant
router.get("/", authenticateToken, requireRestaurant, async (req, res) => {
  try {
    const restaurantId = req.user!.restaurantId!;
    const recipes = await storage.getRecipesByRestaurant(restaurantId);
    res.json({ recipes });
  } catch (error) {
    console.error("Error fetching recipes:", error);
    res.status(500).json({ message: "Failed to fetch recipes" });
  }
});

// Get single recipe by ID
router.get("/:id", authenticateToken, requireRestaurant, async (req, res) => {
  try {
    const recipe = await storage.getRecipe(req.params.id);
    
    if (!recipe) {
      return res.status(404).json({ message: "Recipe not found" });
    }
    
    // Ensure user can only see their restaurant's recipes
    if (recipe.restaurantId !== req.user!.restaurantId) {
      return res.status(403).json({ message: "Access denied" });
    }
    
    res.json({ recipe });
  } catch (error) {
    console.error("Error fetching recipe:", error);
    res.status(500).json({ message: "Failed to fetch recipe" });
  }
});

// Create recipe (admin/manager only)
router.post(
  "/",
  authenticateToken,
  requireRestaurant,
  authorizeRoles(UserRole.ADMIN, UserRole.MANAGER),
  async (req, res) => {
    try {
      const restaurantId = req.user!.restaurantId!;
      
      const recipeData = {
        ...req.body,
        restaurantId,
      };
      
      const validation = insertRecipeSchema.safeParse(recipeData);
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Invalid recipe data",
          errors: validation.error.flatten()
        });
      }
      
      const recipe = await storage.createRecipe(validation.data);
      res.status(201).json({ recipe });
    } catch (error) {
      console.error("Error creating recipe:", error);
      res.status(500).json({ message: "Failed to create recipe" });
    }
  }
);

// Update recipe (admin/manager only)
router.patch(
  "/:id",
  authenticateToken,
  requireRestaurant,
  authorizeRoles(UserRole.ADMIN, UserRole.MANAGER),
  async (req, res) => {
    try {
      const recipe = await storage.getRecipe(req.params.id);
      
      if (!recipe) {
        return res.status(404).json({ message: "Recipe not found" });
      }
      
      // Ensure user can only update their restaurant's recipes
      if (recipe.restaurantId !== req.user!.restaurantId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const updatedRecipe = await storage.updateRecipe(req.params.id, {
        ...req.body,
        updatedAt: new Date(),
      });
      
      res.json({ recipe: updatedRecipe });
    } catch (error) {
      console.error("Error updating recipe:", error);
      res.status(500).json({ message: "Failed to update recipe" });
    }
  }
);

// Delete recipe (admin/manager only)
router.delete(
  "/:id",
  authenticateToken,
  requireRestaurant,
  authorizeRoles(UserRole.ADMIN, UserRole.MANAGER),
  async (req, res) => {
    try {
      const recipe = await storage.getRecipe(req.params.id);
      
      if (!recipe) {
        return res.status(404).json({ message: "Recipe not found" });
      }
      
      // Ensure user can only delete their restaurant's recipes
      if (recipe.restaurantId !== req.user!.restaurantId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      await storage.deleteRecipe(req.params.id);
      res.json({ message: "Recipe deleted successfully" });
    } catch (error) {
      console.error("Error deleting recipe:", error);
      res.status(500).json({ message: "Failed to delete recipe" });
    }
  }
);

export default router;
