/**
 * Routes Index
 * 
 * Central routing configuration.
 * All API routes are prefixed with /api
 */

import { Router } from "express";
import authRoutes from "./auth.routes";
import userRoutes from "./user.routes";
import inventoryRoutes from "./inventory.routes";
import inventoryLogsRoutes from "./inventory-logs.routes";
import restaurantRoutes from "./restaurant.routes";
import recipeRoutes from "./recipe.routes";
import cleaningRoutes from "./cleaning.routes";
import shiftsRoutes from "./shifts.routes";

const router = Router();

// Mount route modules
router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/inventory", inventoryRoutes);
router.use("/inventory-logs", inventoryLogsRoutes);
router.use("/restaurants", restaurantRoutes);
router.use("/recipes", recipeRoutes);
router.use("/cleaning", cleaningRoutes);
router.use("/shifts", shiftsRoutes);

// Health check endpoint
router.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

export default router;
