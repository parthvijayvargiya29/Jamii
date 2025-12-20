/**
 * Authentication Middleware
 * 
 * JWT-based authentication middleware for protecting routes.
 * Verifies JWT tokens and attaches user information to requests.
 */

import type { Request, Response, NextFunction } from "express";
import type { JWTPayload, UserRoleType } from "@shared/schema";

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
 * Placeholder - implementation will be added when features are built
 */
export const authenticateToken = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // TODO: Implement JWT token verification
  // 1. Extract token from Authorization header
  // 2. Verify token using jsonwebtoken
  // 3. Attach decoded payload to req.user
  // 4. Call next() or return 401/403
  next();
};

/**
 * Middleware for role-based authorization
 * Restricts access to users with specific roles
 */
export const authorizeRoles = (...allowedRoles: UserRoleType[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // TODO: Implement role-based access control
    // 1. Check if req.user exists (user is authenticated)
    // 2. Check if user's role is in allowedRoles
    // 3. Call next() or return 403 Forbidden
    next();
  };
};

/**
 * Optional authentication - doesn't fail if no token provided
 */
export const optionalAuth = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // TODO: Implement optional authentication
  // Similar to authenticateToken but doesn't fail on missing token
  next();
};
