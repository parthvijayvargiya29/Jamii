/**
 * User Controller
 * 
 * Handles user management operations:
 * - Get all users (admin only)
 * - Get user by ID
 * - Update user
 * - Delete user
 */

import type { Request, Response } from "express";

/**
 * Get all users
 * GET /api/users
 * Requires: Admin role
 */
export const getAllUsers = async (req: Request, res: Response) => {
  // TODO: Implement get all users
  // 1. Fetch all users from database
  // 2. Remove password from response
  // 3. Return users array
  res.status(501).json({ message: "Not implemented" });
};

/**
 * Get user by ID
 * GET /api/users/:id
 */
export const getUserById = async (req: Request, res: Response) => {
  // TODO: Implement get user by ID
  // 1. Extract user ID from params
  // 2. Fetch user from database
  // 3. Return user data (excluding password)
  res.status(501).json({ message: "Not implemented" });
};

/**
 * Update user
 * PATCH /api/users/:id
 */
export const updateUser = async (req: Request, res: Response) => {
  // TODO: Implement update user
  // 1. Validate request body
  // 2. Check authorization (user can only update own profile, unless admin)
  // 3. Update user in database
  // 4. Return updated user data
  res.status(501).json({ message: "Not implemented" });
};

/**
 * Delete user
 * DELETE /api/users/:id
 * Requires: Admin role or own account
 */
export const deleteUser = async (req: Request, res: Response) => {
  // TODO: Implement delete user
  // 1. Check authorization
  // 2. Delete user from database
  // 3. Return success message
  res.status(501).json({ message: "Not implemented" });
};

/**
 * Update user role
 * PATCH /api/users/:id/role
 * Requires: Admin role
 */
export const updateUserRole = async (req: Request, res: Response) => {
  // TODO: Implement update user role
  // 1. Validate new role
  // 2. Update user role in database
  // 3. Return updated user data
  res.status(501).json({ message: "Not implemented" });
};
