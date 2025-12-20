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

const router = Router();

// Mount route modules
router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/inventory", inventoryRoutes);
router.use("/inventory-logs", inventoryLogsRoutes);
router.use("/restaurants", restaurantRoutes);

// Health check endpoint
router.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

export default router;
