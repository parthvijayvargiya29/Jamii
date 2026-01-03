/**
 * Inventory Routes
 * 
 * API routes for inventory item operations.
 * All routes require authentication and restaurant isolation.
 * 
 * Permissions:
 * - GET: All authenticated users (staff, manager, admin)
 * - POST/PATCH/DELETE: Admin and Manager only
 */

import { Router, type Request, type Response } from "express";
import { storage } from "../storage";
import { authenticateToken, requireRestaurant, authorizeRoles } from "../middleware/auth.middleware";
import { UserRole, createInventoryItemSchema, updateInventoryItemSchema } from "@shared/schema";

const router = Router();

/**
 * Search inventory items by name
 * GET /api/inventory/search?q=query&limit=10
 * 
 * Fast, case-insensitive search limited to user's restaurant.
 * Returns up to `limit` matching items (default: 10, max: 50)
 */
router.get("/search", authenticateToken, requireRestaurant, async (req: Request, res: Response) => {
  try {
    const { q, limit } = req.query;
    const query = typeof q === "string" ? q : "";
    const maxResults = Math.min(
      Math.max(1, parseInt(limit as string) || 10),
      50
    );

    if (!req.user?.restaurantId) {
      return res.status(400).json({ message: "Restaurant ID required" });
    }

    const results = await storage.searchInventoryItems(
      req.user.restaurantId,
      query,
      maxResults
    );

    res.json({ items: results });
  } catch (error) {
    console.error("Search inventory error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * Get all inventory items for user's restaurant
 * GET /api/inventory
 */
router.get("/", authenticateToken, requireRestaurant, async (req: Request, res: Response) => {
  try {
    if (!req.user?.restaurantId) {
      return res.status(400).json({ message: "Restaurant ID required" });
    }

    const items = await storage.getInventoryItemsByRestaurant(req.user.restaurantId);
    res.json({ items });
  } catch (error) {
    console.error("Get inventory error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * Get low stock items for user's restaurant
 * GET /api/inventory/low-stock
 */
router.get("/low-stock", authenticateToken, requireRestaurant, async (req: Request, res: Response) => {
  try {
    if (!req.user?.restaurantId) {
      return res.status(400).json({ message: "Restaurant ID required" });
    }

    const items = await storage.getLowStockItems(req.user.restaurantId);
    res.json({ items });
  } catch (error) {
    console.error("Get low stock items error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * Get single inventory item by ID
 * GET /api/inventory/:id
 */
router.get("/:id", authenticateToken, requireRestaurant, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const item = await storage.getInventoryItem(id);

    if (!item) {
      return res.status(404).json({ message: "Inventory item not found" });
    }

    // Restaurant isolation check
    if (item.restaurantId !== req.user?.restaurantId) {
      return res.status(403).json({ message: "Access denied" });
    }

    res.json({ item });
  } catch (error) {
    console.error("Get inventory item error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * Create inventory item (admin/manager only)
 * POST /api/inventory
 */
router.post(
  "/",
  authenticateToken,
  requireRestaurant,
  authorizeRoles(UserRole.ADMIN, UserRole.MANAGER),
  async (req: Request, res: Response) => {
    try {
      const validation = createInventoryItemSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          message: "Invalid inventory item data",
          errors: validation.error.flatten(),
        });
      }

      const itemData = {
        ...validation.data,
        restaurantId: req.user!.restaurantId!,
        quantity: String(validation.data.quantity),
        lowStockThreshold: String(validation.data.lowStockThreshold),
      };

      const item = await storage.createInventoryItem(itemData);
      res.status(201).json({ item });
    } catch (error) {
      console.error("Create inventory item error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }
);

/**
 * Update inventory quantity (all authenticated users)
 * PATCH /api/inventory/:id/quantity
 */
router.patch(
  "/:id/quantity",
  authenticateToken,
  requireRestaurant,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { quantity } = req.body;

      if (quantity === undefined || quantity === null) {
        return res.status(400).json({ message: "Quantity is required" });
      }

      const existingItem = await storage.getInventoryItem(id);

      if (!existingItem) {
        return res.status(404).json({ message: "Inventory item not found" });
      }

      if (existingItem.restaurantId !== req.user?.restaurantId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const updatedItem = await storage.updateInventoryItem(id, {
        quantity: String(quantity),
      });
      res.json({ item: updatedItem });
    } catch (error) {
      console.error("Update inventory quantity error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }
);

/**
 * Update inventory item (admin/manager only)
 * PATCH /api/inventory/:id
 */
router.patch(
  "/:id",
  authenticateToken,
  requireRestaurant,
  authorizeRoles(UserRole.ADMIN, UserRole.MANAGER),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const existingItem = await storage.getInventoryItem(id);

      if (!existingItem) {
        return res.status(404).json({ message: "Inventory item not found" });
      }

      // Restaurant isolation check
      if (existingItem.restaurantId !== req.user?.restaurantId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const validation = updateInventoryItemSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          message: "Invalid update data",
          errors: validation.error.flatten(),
        });
      }

      // Ensure restaurantId cannot be changed
      const updateData: Record<string, unknown> = { ...validation.data };
      delete updateData.restaurantId;
      
      if (updateData.quantity !== undefined) {
        updateData.quantity = String(updateData.quantity);
      }
      if (updateData.lowStockThreshold !== undefined) {
        updateData.lowStockThreshold = String(updateData.lowStockThreshold);
      }
      updateData.updatedAt = new Date();

      const updatedItem = await storage.updateInventoryItem(id, updateData);
      res.json({ item: updatedItem });
    } catch (error) {
      console.error("Update inventory item error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }
);

/**
 * Delete inventory item (admin/manager only)
 * DELETE /api/inventory/:id
 */
router.delete(
  "/:id",
  authenticateToken,
  requireRestaurant,
  authorizeRoles(UserRole.ADMIN, UserRole.MANAGER),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const existingItem = await storage.getInventoryItem(id);

      if (!existingItem) {
        return res.status(404).json({ message: "Inventory item not found" });
      }

      // Restaurant isolation check
      if (existingItem.restaurantId !== req.user?.restaurantId) {
        return res.status(403).json({ message: "Access denied" });
      }

      await storage.deleteInventoryItem(id);
      res.json({ message: "Inventory item deleted successfully" });
    } catch (error) {
      console.error("Delete inventory item error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }
);

export default router;
