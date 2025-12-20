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

import { Router } from "express";
import * as userController from "../controllers/user.controller";
import { 
  authenticateToken, 
  authorizeRoles,
  isOwnerOrManager 
} from "../middleware/auth.middleware";
import { UserRole } from "@shared/schema";

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Admin only routes
router.get("/", authorizeRoles(UserRole.ADMIN), userController.getAllUsers);
router.patch("/:id/role", authorizeRoles(UserRole.ADMIN), userController.updateUserRole);

// User routes (with authorization checks)
// Users can view their own profile, managers can view their restaurant's users
router.get("/:id", userController.getUserById);

// Users can update their own profile, or admins can update anyone
router.patch("/:id", isOwnerOrManager((req) => req.params.id), userController.updateUser);

// Users can delete their own account, or admins can delete anyone
router.delete("/:id", isOwnerOrManager((req) => req.params.id), userController.deleteUser);

export default router;
