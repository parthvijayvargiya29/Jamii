/**
 * User Routes
 * 
 * Routes for user management with role-based authorization:
 * - GET /api/users - Get all users (admin only)
 * - GET /api/users/:id - Get user by ID
 * - PATCH /api/users/:id - Update user
 * - DELETE /api/users/:id - Delete user
 * - PATCH /api/users/:id/role - Update user role (admin only)
 * 
 * @example Middleware Usage:
 * 
 * // Basic authentication
 * router.get("/protected", authenticateToken, handler);
 * 
 * // Role-based access (admin only)
 * router.get("/admin", authenticateToken, authorizeRoles("admin"), handler);
 * 
 * // Multiple roles allowed
 * router.get("/management", authenticateToken, authorizeRoles("admin", "manager"), handler);
 * 
 * // Restaurant isolation (users can only access their restaurant)
 * router.get("/data/:restaurantId", authenticateToken, restrictToRestaurant(), handler);
 * 
 * // Restaurant isolation with admin bypass
 * router.get("/data/:restaurantId", authenticateToken, restrictToRestaurant({ allowAdmin: true }), handler);
 */

import { Router, Request, Response } from "express";
import * as userController from "../controllers/user.controller";
import { 
  authenticateToken, 
  authorizeRoles,
  isOwnerOrManager 
} from "../middleware/auth.middleware";
import { UserRole } from "@shared/schema";
import bcrypt from "bcryptjs";
import { pool } from "../db";

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Admin only routes
router.get("/", authorizeRoles(UserRole.ADMIN), userController.getAllUsers);
router.patch("/:id/role", authorizeRoles(UserRole.ADMIN), userController.updateUserRole);
router.patch("/:id/station", authorizeRoles(UserRole.ADMIN), userController.updateUserStation);

// User routes (with authorization checks)
// Users can view their own profile, managers can view their restaurant's users
router.get("/:id", userController.getUserById);

// Users can update their own profile, or admins can update anyone
router.patch("/:id", isOwnerOrManager((req) => req.params.id), userController.updateUser);

// Users can delete their own account, or admins can delete anyone
router.delete("/:id", isOwnerOrManager((req) => req.params.id), userController.deleteUser);

// Set or update a user's shift PIN (admin/manager only)
router.patch("/:id/pin", authorizeRoles(UserRole.ADMIN, UserRole.MANAGER), async (req: Request, res: Response) => {
  try {
    const { pin } = req.body;
    if (!pin || !/^\d{4}$/.test(pin)) {
      return res.status(400).json({ message: "PIN must be exactly 4 digits" });
    }
    const hashed = await bcrypt.hash(pin, 10);
    const result = await pool.query(
      `UPDATE users SET shift_pin = $1 WHERE id = $2 RETURNING id, name`,
      [hashed, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ message: "PIN updated successfully", user: result.rows[0] });
  } catch (err) {
    console.error("Error setting PIN:", err);
    res.status(500).json({ message: "Failed to set PIN" });
  }
});

// Remove a user's shift PIN (admin/manager only)
router.delete("/:id/pin", authorizeRoles(UserRole.ADMIN, UserRole.MANAGER), async (req: Request, res: Response) => {
  try {
    await pool.query(`UPDATE users SET shift_pin = NULL WHERE id = $1`, [req.params.id]);
    res.json({ message: "PIN removed successfully" });
  } catch (err) {
    res.status(500).json({ message: "Failed to remove PIN" });
  }
});

export default router;
