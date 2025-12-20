/**
 * Authentication Controller
 * 
 * Handles user authentication operations:
 * - User registration
 * - User login
 * - Token refresh
 * - Get current user
 */

import type { Request, Response } from "express";
import { storage } from "../storage";
import { hashPassword, comparePassword } from "../utils/password.utils";
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from "../utils/jwt.utils";
import { registerUserSchema, loginSchema, type JWTPayload } from "@shared/schema";

/**
 * Register a new user
 * POST /api/auth/register
 */
export const register = async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validation = registerUserSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        message: "Validation failed",
        errors: validation.error.flatten().fieldErrors,
      });
    }

    const { name, email, password, restaurantId } = validation.data;
    // Note: role is intentionally ignored from registration - all new users start as staff
    // Only admins can elevate user roles via PATCH /api/users/:id/role

    // Check if user already exists
    const existingUser = await storage.getUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ message: "User with this email already exists" });
    }

    // Verify restaurant exists if provided
    if (restaurantId) {
      const restaurant = await storage.getRestaurant(restaurantId);
      if (!restaurant) {
        return res.status(400).json({ message: "Invalid restaurant ID" });
      }
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user - always starts as staff for security
    // Role elevation must be done by an admin
    const user = await storage.createUser({
      name,
      email,
      passwordHash,
      role: "staff", // Always staff on registration - no privilege escalation
      restaurantId: restaurantId || null,
    });

    // Generate tokens
    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
      role: user.role as JWTPayload["role"],
      restaurantId: user.restaurantId,
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // Return user data (without password) and tokens
    res.status(201).json({
      message: "User registered successfully",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        restaurantId: user.restaurantId,
        createdAt: user.createdAt,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Login user
 * POST /api/auth/login
 */
export const login = async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validation = loginSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        message: "Validation failed",
        errors: validation.error.flatten().fieldErrors,
      });
    }

    const { email, password } = validation.data;

    // Find user by email
    const user = await storage.getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Verify password
    const isValidPassword = await comparePassword(password, user.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Generate tokens
    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
      role: user.role as JWTPayload["role"],
      restaurantId: user.restaurantId,
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // Return user data and tokens
    res.json({
      message: "Login successful",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        restaurantId: user.restaurantId,
        createdAt: user.createdAt,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Logout user
 * POST /api/auth/logout
 * Note: For JWT-based auth, logout is typically handled client-side
 * by removing the token. This endpoint is for any server-side cleanup.
 */
export const logout = async (req: Request, res: Response) => {
  // For JWT-based auth, we just acknowledge the logout
  // In a production system, you might want to blacklist the token
  res.json({ message: "Logged out successfully" });
};

/**
 * Get current user profile
 * GET /api/auth/me
 */
export const getCurrentUser = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    // Fetch full user data from database
    const user = await storage.getUser(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Get restaurant info if user has one
    let restaurant = null;
    if (user.restaurantId) {
      restaurant = await storage.getRestaurant(user.restaurantId);
    }

    // Return user data (excluding password)
    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        restaurantId: user.restaurantId,
        createdAt: user.createdAt,
      },
      restaurant: restaurant ? {
        id: restaurant.id,
        name: restaurant.name,
      } : null,
    });
  } catch (error) {
    console.error("Get current user error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Refresh access token
 * POST /api/auth/refresh
 */
export const refreshToken = async (req: Request, res: Response) => {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      return res.status(400).json({ message: "Refresh token required" });
    }

    // Verify the refresh token (only accepts refresh tokens, not access tokens)
    const payload = verifyRefreshToken(token);
    if (!payload) {
      return res.status(403).json({ message: "Invalid or expired refresh token" });
    }

    // Verify user still exists
    const user = await storage.getUser(payload.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Generate new access token
    const newPayload: JWTPayload = {
      userId: user.id,
      email: user.email,
      role: user.role as JWTPayload["role"],
      restaurantId: user.restaurantId,
    };

    const accessToken = generateAccessToken(newPayload);

    res.json({
      message: "Token refreshed successfully",
      accessToken,
    });
  } catch (error) {
    console.error("Refresh token error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
