/**
 * Restaurant Routes
 * 
 * API routes for restaurant operations.
 */

import { Router, type Request, type Response } from "express";
import { storage } from "../storage";

const router = Router();

/**
 * Get all restaurants
 * GET /api/restaurants
 * 
 * Returns list of all restaurants (for registration/assignment)
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const restaurants = await storage.getAllRestaurants();
    res.json({ restaurants });
  } catch (error) {
    console.error("Get restaurants error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
