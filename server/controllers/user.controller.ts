/**
 * User Controller
 * 
 * Handles user management operations:
 * - Get all users (admin only)
 * - Get user by ID
 * - Update user
 * - Delete user
 * - Update user role
 */

import type { Request, Response } from "express";
import { storage } from "../storage";
import { hashPassword } from "../utils/password.utils";
import { UserRole } from "@shared/schema";

/**
 * Get all users
 * GET /api/users
 * Requires: Admin role
 */
export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const users = await storage.getAllUsers();
    
    // Remove password hashes from response
    const sanitizedUsers = users.map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      restaurantId: user.restaurantId,
      createdAt: user.createdAt,
    }));

    res.json({ users: sanitizedUsers });
  } catch (error) {
    console.error("Get all users error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Get user by ID
 * GET /api/users/:id
 */
export const getUserById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = await storage.getUser(id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check authorization: users can view themselves, managers can view restaurant staff
    if (req.user?.userId !== id) {
      // If not viewing self, must be admin or manager of same restaurant
      if (req.user?.role === UserRole.STAFF) {
        return res.status(403).json({ message: "Access denied" });
      }
      if (req.user?.role === UserRole.MANAGER && req.user?.restaurantId !== user.restaurantId) {
        return res.status(403).json({ message: "Access denied. Can only view users from your restaurant." });
      }
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
    });
  } catch (error) {
    console.error("Get user by ID error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Update user
 * PATCH /api/users/:id
 */
export const updateUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, email, password } = req.body;

    const user = await storage.getUser(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Additional authorization check for managers
    // Managers can only update users in their own restaurant
    if (req.user?.role === UserRole.MANAGER && 
        req.user.userId !== id && 
        user.restaurantId !== req.user.restaurantId) {
      return res.status(403).json({ 
        message: "Access denied. Managers can only modify users in their own restaurant." 
      });
    }

    // Build update object
    const updates: Record<string, any> = {};
    if (name) updates.name = name;
    if (email) {
      // Check if email is already taken
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser && existingUser.id !== id) {
        return res.status(409).json({ message: "Email already in use" });
      }
      updates.email = email;
    }
    if (password) {
      updates.passwordHash = await hashPassword(password);
    }

    const updatedUser = await storage.updateUser(id, updates);

    res.json({
      message: "User updated successfully",
      user: {
        id: updatedUser!.id,
        name: updatedUser!.name,
        email: updatedUser!.email,
        role: updatedUser!.role,
        restaurantId: updatedUser!.restaurantId,
        createdAt: updatedUser!.createdAt,
      },
    });
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Delete user
 * DELETE /api/users/:id
 * Requires: Admin role, own account, or manager (same restaurant only)
 */
export const deleteUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const user = await storage.getUser(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Additional authorization check for managers
    // Managers can only delete users in their own restaurant
    if (req.user?.role === UserRole.MANAGER && 
        req.user.userId !== id && 
        user.restaurantId !== req.user.restaurantId) {
      return res.status(403).json({ 
        message: "Access denied. Managers can only delete users in their own restaurant." 
      });
    }

    await storage.deleteUser(id);

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Update user role
 * PATCH /api/users/:id/role
 * Requires: Admin role
 */
export const updateUserRole = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    // Validate role
    if (!role || !Object.values(UserRole).includes(role)) {
      return res.status(400).json({ 
        message: "Invalid role",
        validRoles: Object.values(UserRole),
      });
    }

    const user = await storage.getUser(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const updatedUser = await storage.updateUser(id, { role });

    res.json({
      message: "User role updated successfully",
      user: {
        id: updatedUser!.id,
        name: updatedUser!.name,
        email: updatedUser!.email,
        role: updatedUser!.role,
        restaurantId: updatedUser!.restaurantId,
        createdAt: updatedUser!.createdAt,
      },
    });
  } catch (error) {
    console.error("Update user role error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
