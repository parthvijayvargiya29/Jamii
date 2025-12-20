/**
 * Routes Index
 * 
 * Central routing configuration.
 * All API routes are prefixed with /api
 */

import { Router } from "express";
import authRoutes from "./auth.routes";
import userRoutes from "./user.routes";

const router = Router();

// Mount route modules
router.use("/auth", authRoutes);
router.use("/users", userRoutes);

// Health check endpoint
router.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

export default router;
