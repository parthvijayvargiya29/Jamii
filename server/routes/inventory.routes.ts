/**
 * Inventory Routes
 * 
 * API routes for inventory item operations.
 * All routes require authentication and restaurant isolation.
 */

import { Router, type Request, type Response } from "express";
import { storage } from "../storage";
import { authenticateToken, requireRestaurant } from "../middleware/auth.middleware";

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

export default router;
