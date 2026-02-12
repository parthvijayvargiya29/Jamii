/**
 * Recipe Routes
 * 
 * CRUD operations for recipes.
 * Recipes are shared across all restaurants (no restaurant_id column).
 * - All authenticated users can view recipes
 * - Only admin/manager can create, edit, delete
 */

import { Router } from "express";
import multer from "multer";
import path from "path";
import { randomUUID } from "crypto";
import { storage } from "../storage";
import { createRecipeSchema, updateRecipeSchema, UserRole } from "@shared/schema";
import { 
  authenticateToken, 
  authorizeRoles 
} from "../middleware/auth.middleware";

const router = Router();

const uploadDir = path.join(process.cwd(), "client", "public", "assets", "images");

const imageStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".png";
    cb(null, `recipe-${randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage: imageStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|gif|webp)$/i;
    if (allowed.test(path.extname(file.originalname))) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

// Get all recipes (shared across all restaurants)
router.get("/", authenticateToken, async (req, res) => {
  try {
    const recipes = await storage.getAllRecipes();
    res.json({ recipes });
  } catch (error) {
    console.error("Error fetching recipes:", error);
    res.status(500).json({ message: "Failed to fetch recipes" });
  }
});

// Get single recipe by ID
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const recipe = await storage.getRecipe(req.params.id);
    
    if (!recipe) {
      return res.status(404).json({ message: "Recipe not found" });
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
  authorizeRoles(UserRole.ADMIN, UserRole.MANAGER),
  async (req, res) => {
    try {
      const validation = createRecipeSchema.safeParse(req.body);
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
  authorizeRoles(UserRole.ADMIN, UserRole.MANAGER),
  async (req, res) => {
    try {
      const recipe = await storage.getRecipe(req.params.id);
      
      if (!recipe) {
        return res.status(404).json({ message: "Recipe not found" });
      }
      
      const validation = updateRecipeSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Invalid update data",
          errors: validation.error.flatten()
        });
      }
      
      const updatedRecipe = await storage.updateRecipe(req.params.id, {
        ...validation.data,
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
  authorizeRoles(UserRole.ADMIN, UserRole.MANAGER),
  async (req, res) => {
    try {
      const recipe = await storage.getRecipe(req.params.id);
      
      if (!recipe) {
        return res.status(404).json({ message: "Recipe not found" });
      }
      
      await storage.deleteRecipe(req.params.id);
      res.json({ message: "Recipe deleted successfully" });
    } catch (error) {
      console.error("Error deleting recipe:", error);
      res.status(500).json({ message: "Failed to delete recipe" });
    }
  }
);

router.post(
  "/upload-image",
  authenticateToken,
  authorizeRoles(UserRole.ADMIN, UserRole.MANAGER),
  upload.single("image"),
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "No image file provided" });
    }
    const imageUrl = `/assets/images/${req.file.filename}`;
    res.json({ imageUrl });
  }
);

export default router;
