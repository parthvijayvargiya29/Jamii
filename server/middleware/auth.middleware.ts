/**
 * Authentication Middleware
 * 
 * JWT-based authentication middleware for protecting routes.
 * Includes role checking and restaurant isolation.
 */

import type { Request, Response, NextFunction } from "express";
import type { JWTPayload, UserRoleType } from "@shared/schema";
import { UserRole } from "@shared/schema";
import { verifyToken } from "../utils/jwt.utils";

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

/**
 * Middleware to authenticate JWT tokens
 * Extracts token from Authorization header and verifies it
 */
export const authenticateToken = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1]; // Bearer <token>

  if (!token) {
    return res.status(401).json({ message: "Access token required" });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return res.status(403).json({ message: "Invalid or expired token" });
  }

  req.user = payload;
  next();
};

/**
 * Middleware to require user to be associated with a restaurant
 * Useful for endpoints that operate on the user's restaurant data
 */
export const requireRestaurant = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }

  if (!req.user.restaurantId) {
    return res.status(400).json({ 
      message: "User must be associated with a restaurant to access this resource" 
    });
  }

  next();
};

/**
 * Middleware for role-based authorization
 * Restricts access to users with specific roles
 * 
 * @example
 * // Only admins can access
 * router.get("/admin-only", authenticateToken, authorizeRoles("admin"), handler);
 * 
 * // Admins and managers can access
 * router.get("/management", authenticateToken, authorizeRoles("admin", "manager"), handler);
 */
export const authorizeRoles = (...allowedRoles: UserRoleType[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    if (!allowedRoles.includes(req.user.role as UserRoleType)) {
      return res.status(403).json({ 
        message: "Access denied. Insufficient permissions.",
        required: allowedRoles,
        current: req.user.role
      });
    }

    next();
  };
};

/**
 * Middleware for restaurant isolation
 * Ensures users can only access data from their own restaurant
 * Admins can optionally bypass this restriction
 * 
 * @param options.allowAdmin - If true, admins can access any restaurant
 * @param options.paramName - The request parameter containing restaurant ID (default: "restaurantId")
 * 
 * @example
 * // Staff can only access their restaurant's data
 * router.get("/inventory/:restaurantId", authenticateToken, restrictToRestaurant(), handler);
 * 
 * // Admins can access any restaurant
 * router.get("/inventory/:restaurantId", authenticateToken, restrictToRestaurant({ allowAdmin: true }), handler);
 */
export const restrictToRestaurant = (options: {
  allowAdmin?: boolean;
  paramName?: string;
} = {}) => {
  const { allowAdmin = false, paramName = "restaurantId" } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    // Get restaurant ID from params, query, or body
    const requestedRestaurantId = 
      req.params[paramName] || 
      req.query[paramName] || 
      req.body?.[paramName];

    // Admin bypass (if enabled)
    if (allowAdmin && req.user.role === UserRole.ADMIN) {
      return next();
    }

    // Check if user has a restaurant assigned
    if (!req.user.restaurantId) {
      return res.status(403).json({ 
        message: "User is not assigned to any restaurant" 
      });
    }

    // Check restaurant match
    if (requestedRestaurantId && requestedRestaurantId !== req.user.restaurantId) {
      return res.status(403).json({ 
        message: "Access denied. You can only access your own restaurant's data.",
        yourRestaurant: req.user.restaurantId,
        requested: requestedRestaurantId
      });
    }

    next();
  };
};

/**
 * Optional authentication - doesn't fail if no token provided
 * Useful for routes that work differently for authenticated vs anonymous users
 * 
 * @example
 * router.get("/public-data", optionalAuth, (req, res) => {
 *   if (req.user) {
 *     // Show personalized data
 *   } else {
 *     // Show public data
 *   }
 * });
 */
export const optionalAuth = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];

  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      req.user = payload;
    }
  }

  next();
};

/**
 * Middleware to check if user owns a resource or is admin
 * Managers can only modify resources within their own restaurant
 * 
 * @param getUserId - Function to extract owner user ID from request
 * @param getResourceRestaurantId - Optional function to get the resource's restaurant ID
 * 
 * @example
 * router.delete("/users/:id", authenticateToken, isOwnerOrAdmin((req) => req.params.id), handler);
 */
export const isOwnerOrManager = (
  getUserId: (req: Request) => string,
  getResourceRestaurantId?: (req: Request) => string | null
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const resourceOwnerId = getUserId(req);
    const isOwner = req.user.userId === resourceOwnerId;
    
    // Admins have global access
    if (req.user.role === UserRole.ADMIN) {
      return next();
    }

    // Owner can always access their own resources
    if (isOwner) {
      return next();
    }

    // Managers can only modify resources within their restaurant
    if (req.user.role === UserRole.MANAGER) {
      // If we can determine the resource's restaurant, check it matches
      if (getResourceRestaurantId) {
        const resourceRestaurantId = getResourceRestaurantId(req);
        if (resourceRestaurantId && resourceRestaurantId !== req.user.restaurantId) {
          return res.status(403).json({ 
            message: "Access denied. Managers can only modify resources in their own restaurant." 
          });
        }
        return next();
      }
      // If no restaurant check function provided, managers can proceed
      // (the controller should do additional validation)
      return next();
    }

    // Staff cannot modify other users' resources
    return res.status(403).json({ 
      message: "Access denied. You can only modify your own resources." 
    });
  };
};
