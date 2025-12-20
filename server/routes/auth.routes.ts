/**
 * Authentication Routes
 * 
 * Routes for user authentication:
 * - POST /api/auth/register - Register new user
 * - POST /api/auth/login - Login user
 * - POST /api/auth/logout - Logout user
 * - GET /api/auth/me - Get current user
 * - POST /api/auth/refresh - Refresh token
 */

import { Router } from "express";
import * as authController from "../controllers/auth.controller";
import { authenticateToken } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validation.middleware";
import { loginSchema, registerSchema } from "@shared/schema";

const router = Router();

// Public routes
router.post("/register", validateBody(registerSchema), authController.register);
router.post("/login", validateBody(loginSchema), authController.login);

// Protected routes
router.post("/logout", authenticateToken, authController.logout);
router.get("/me", authenticateToken, authController.getCurrentUser);
router.post("/refresh", authController.refreshToken);

export default router;
