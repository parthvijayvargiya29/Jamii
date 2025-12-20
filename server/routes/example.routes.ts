/**
 * Example Routes
 * 
 * This file demonstrates middleware usage patterns for:
 * - Authentication
 * - Role-based authorization
 * - Restaurant isolation
 * 
 * These are example patterns - not actual routes used in the application.
 */

import { Router } from "express";
import { 
  authenticateToken, 
  authorizeRoles, 
  restrictToRestaurant,
  optionalAuth,
  isOwnerOrManager 
} from "../middleware/auth.middleware";
import { UserRole } from "@shared/schema";

const router = Router();

// ============================================================================
// EXAMPLE 1: Basic Authentication
// ============================================================================
// Any authenticated user can access this route
router.get("/protected", 
  authenticateToken, 
  (req, res) => {
    res.json({ message: "You are authenticated!", user: req.user });
  }
);

// ============================================================================
// EXAMPLE 2: Role-Based Authorization
// ============================================================================

// Only admins can access
router.get("/admin-only", 
  authenticateToken, 
  authorizeRoles(UserRole.ADMIN), 
  (req, res) => {
    res.json({ message: "Welcome, Admin!" });
  }
);

// Admins and managers can access
router.get("/management", 
  authenticateToken, 
  authorizeRoles(UserRole.ADMIN, UserRole.MANAGER), 
  (req, res) => {
    res.json({ message: "Welcome to the management area!" });
  }
);

// All roles can access, but behavior might differ
router.get("/all-roles", 
  authenticateToken, 
  authorizeRoles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF), 
  (req, res) => {
    res.json({ message: `Welcome, ${req.user?.role}!` });
  }
);

// ============================================================================
// EXAMPLE 3: Restaurant Isolation
// ============================================================================

// Users can only access their own restaurant's data
router.get("/inventory/:restaurantId", 
  authenticateToken, 
  restrictToRestaurant(), 
  (req, res) => {
    res.json({ 
      message: "Inventory data for your restaurant",
      restaurantId: req.params.restaurantId 
    });
  }
);

// Admins can bypass restaurant restriction
router.get("/all-inventory/:restaurantId", 
  authenticateToken, 
  restrictToRestaurant({ allowAdmin: true }), 
  (req, res) => {
    res.json({ 
      message: "Inventory data (admin can see any restaurant)",
      restaurantId: req.params.restaurantId 
    });
  }
);

// Custom parameter name for restaurant ID
router.get("/recipes", 
  authenticateToken, 
  restrictToRestaurant({ paramName: "restaurant" }), // Looks for ?restaurant=xxx
  (req, res) => {
    res.json({ message: "Recipes for your restaurant" });
  }
);

// ============================================================================
// EXAMPLE 4: Optional Authentication
// ============================================================================

// Route works for both authenticated and anonymous users
router.get("/public-content", 
  optionalAuth, 
  (req, res) => {
    if (req.user) {
      res.json({ 
        message: "Personalized content for logged-in user",
        user: req.user 
      });
    } else {
      res.json({ message: "Public content for anonymous user" });
    }
  }
);

// ============================================================================
// EXAMPLE 5: Resource Ownership
// ============================================================================

// Users can only modify their own resources (or managers/admins can modify any)
router.patch("/profile/:userId", 
  authenticateToken, 
  isOwnerOrManager((req) => req.params.userId), 
  (req, res) => {
    res.json({ message: "Profile updated successfully" });
  }
);

// ============================================================================
// EXAMPLE 6: Combining Multiple Middleware
// ============================================================================

// Complex authorization: Admin or manager, and restaurant-restricted
router.post("/inventory/:restaurantId/items", 
  authenticateToken,                                    // Must be logged in
  authorizeRoles(UserRole.ADMIN, UserRole.MANAGER),    // Must be admin or manager
  restrictToRestaurant({ allowAdmin: true }),           // Must belong to restaurant (unless admin)
  (req, res) => {
    res.json({ message: "Inventory item created" });
  }
);

// Staff can view, only managers can modify
router.get("/cleaning-tasks/:restaurantId", 
  authenticateToken,
  restrictToRestaurant(),
  (req, res) => {
    res.json({ message: "Cleaning tasks list" });
  }
);

router.post("/cleaning-tasks/:restaurantId", 
  authenticateToken,
  authorizeRoles(UserRole.ADMIN, UserRole.MANAGER),
  restrictToRestaurant({ allowAdmin: true }),
  (req, res) => {
    res.json({ message: "Cleaning task created" });
  }
);

export default router;
