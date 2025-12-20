/**
 * User Routes
 * 
 * Routes for user management:
 * - GET /api/users - Get all users (admin only)
 * - GET /api/users/:id - Get user by ID
 * - PATCH /api/users/:id - Update user
 * - DELETE /api/users/:id - Delete user
 * - PATCH /api/users/:id/role - Update user role (admin only)
 */

import { Router } from "express";
import * as userController from "../controllers/user.controller";
import { authenticateToken, authorizeRoles } from "../middleware/auth.middleware";
import { UserRole } from "@shared/schema";

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Admin only routes
router.get("/", authorizeRoles(UserRole.ADMIN), userController.getAllUsers);
router.patch("/:id/role", authorizeRoles(UserRole.ADMIN), userController.updateUserRole);

// User routes (with authorization checks in controller)
router.get("/:id", userController.getUserById);
router.patch("/:id", userController.updateUser);
router.delete("/:id", userController.deleteUser);

export default router;
