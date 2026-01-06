/**
 * Inventory Logs Routes
 * 
 * API routes for inventory log operations and analytics.
 * All routes require authentication and restaurant isolation.
 * 
 * Permissions:
 * - GET: All authenticated users (staff, manager, admin)
 * - POST: Admin and Manager only (creates inventory changes)
 * - PATCH/DELETE: Admin only
 */

import { Router, type Request, type Response } from "express";
import { storage } from "../storage";
import { authenticateToken, requireRestaurant, authorizeRoles } from "../middleware/auth.middleware";
import { UserRole, createInventoryLogSchema, updateInventoryLogSchema } from "@shared/schema";
import type { InventoryLog } from "@shared/schema";

const router = Router();

// Helper to parse date from query string
function parseDate(dateStr: string | undefined): Date | undefined {
  if (!dateStr) return undefined;
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? undefined : date;
}

// Helper to get effective restaurant ID (supports admin restaurant switching)
function getEffectiveRestaurantId(req: Request): string | null {
  // Admin users can specify a restaurantId via query params
  if (req.user?.role === "admin" && req.query.restaurantId) {
    return req.query.restaurantId as string;
  }
  return req.user?.restaurantId || null;
}

// Helper to group logs by time period
function groupLogsByPeriod(logs: InventoryLog[], period: "day" | "week"): Record<string, InventoryLog[]> {
  const grouped: Record<string, InventoryLog[]> = {};
  
  for (const log of logs) {
    if (!log.createdAt) continue;
    
    let key: string;
    if (period === "day") {
      key = log.createdAt.toISOString().split("T")[0]; // YYYY-MM-DD
    } else {
      // Week: use Monday of the week
      const date = new Date(log.createdAt);
      const day = date.getDay();
      const diff = date.getDate() - day + (day === 0 ? -6 : 1);
      date.setDate(diff);
      key = date.toISOString().split("T")[0];
    }
    
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(log);
  }
  
  return grouped;
}

/**
 * Get inventory logs with filtering
 * GET /api/inventory-logs
 * 
 * Query params:
 * - itemId: Filter by inventory item
 * - startDate: Filter from date (ISO string)
 * - endDate: Filter to date (ISO string)
 * - changeType: Filter by change type (Delivery, Usage, Adjustment)
 * - groupBy: Group results by 'day' or 'week'
 */
router.get("/", authenticateToken, requireRestaurant, async (req: Request, res: Response) => {
  try {
    const { itemId, startDate, endDate, changeType, groupBy } = req.query;

    if (!req.user?.restaurantId) {
      return res.status(400).json({ message: "Restaurant ID required" });
    }

    const logs = await storage.getInventoryLogsFiltered(req.user.restaurantId, {
      itemId: itemId as string | undefined,
      startDate: parseDate(startDate as string),
      endDate: parseDate(endDate as string),
      changeType: changeType as string | undefined,
    });

    // If groupBy is specified, return grouped data
    if (groupBy === "day" || groupBy === "week") {
      const grouped = groupLogsByPeriod(logs, groupBy);
      return res.json({ logs: grouped, groupedBy: groupBy });
    }

    res.json({ logs });
  } catch (error) {
    console.error("Get inventory logs error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * Get daily usage analytics
 * GET /api/inventory-logs/analytics/daily-usage
 * 
 * Returns daily usage (negative changes) aggregated by day
 * Useful for usage trend charts
 */
router.get("/analytics/daily-usage", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { itemId, startDate, endDate } = req.query;

    const restaurantId = getEffectiveRestaurantId(req);
    if (!restaurantId) {
      return res.status(400).json({ message: "Restaurant ID required" });
    }

    const logs = await storage.getInventoryLogsFiltered(restaurantId, {
      itemId: itemId as string | undefined,
      startDate: parseDate(startDate as string),
      endDate: parseDate(endDate as string),
    });

    // Filter to usage logs (Usage type with negative changes)
    const usageLogs = logs.filter(
      (log) => log.changeType === "Usage" && parseFloat(log.quantityChanged) < 0
    );

    // Group by day and sum usage
    const dailyUsage: Record<string, { date: string; totalUsage: number; itemCount: number }> = {};
    
    for (const log of usageLogs) {
      if (!log.createdAt) continue;
      const dateKey = log.createdAt.toISOString().split("T")[0];
      
      if (!dailyUsage[dateKey]) {
        dailyUsage[dateKey] = { date: dateKey, totalUsage: 0, itemCount: 0 };
      }
      
      dailyUsage[dateKey].totalUsage += Math.abs(parseFloat(log.quantityChanged));
      dailyUsage[dateKey].itemCount += 1;
    }

    // Convert to sorted array
    const data = Object.values(dailyUsage).sort((a, b) => a.date.localeCompare(b.date));

    res.json({ data, period: "daily" });
  } catch (error) {
    console.error("Get daily usage error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * Get deliveries over time
 * GET /api/inventory-logs/analytics/deliveries
 * 
 * Returns delivery data aggregated by day/week
 * Useful for delivery trend charts
 */
router.get("/analytics/deliveries", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { itemId, startDate, endDate, groupBy = "day" } = req.query;

    const restaurantId = getEffectiveRestaurantId(req);
    if (!restaurantId) {
      return res.status(400).json({ message: "Restaurant ID required" });
    }

    const logs = await storage.getInventoryLogsFiltered(restaurantId, {
      itemId: itemId as string | undefined,
      startDate: parseDate(startDate as string),
      endDate: parseDate(endDate as string),
      changeType: "Delivery",
    });

    // Group by period and sum deliveries
    const period = groupBy === "week" ? "week" : "day";
    const grouped = groupLogsByPeriod(logs, period as "day" | "week");

    const data = Object.entries(grouped)
      .map(([date, periodLogs]) => ({
        date,
        totalDelivered: periodLogs.reduce((sum, log) => sum + parseFloat(log.quantityChanged), 0),
        deliveryCount: periodLogs.length,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    res.json({ data, period });
  } catch (error) {
    console.error("Get deliveries error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * Get net stock movement
 * GET /api/inventory-logs/analytics/net-movement
 * 
 * Returns net change in stock over time (deliveries - usage)
 * Useful for stock trend charts
 */
router.get("/analytics/net-movement", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { itemId, startDate, endDate, groupBy = "day" } = req.query;

    const restaurantId = getEffectiveRestaurantId(req);
    if (!restaurantId) {
      return res.status(400).json({ message: "Restaurant ID required" });
    }

    const logs = await storage.getInventoryLogsFiltered(restaurantId, {
      itemId: itemId as string | undefined,
      startDate: parseDate(startDate as string),
      endDate: parseDate(endDate as string),
    });

    // Group by period
    const period = groupBy === "week" ? "week" : "day";
    const grouped = groupLogsByPeriod(logs, period as "day" | "week");

    const data = Object.entries(grouped)
      .map(([date, periodLogs]) => {
        const deliveries = periodLogs
          .filter((l) => l.changeType === "Delivery")
          .reduce((sum, l) => sum + parseFloat(l.quantityChanged), 0);
        
        const usage = periodLogs
          .filter((l) => l.changeType === "Usage" && parseFloat(l.quantityChanged) < 0)
          .reduce((sum, l) => sum + Math.abs(parseFloat(l.quantityChanged)), 0);
        
        const adjustments = periodLogs
          .filter((l) => l.changeType === "Adjustment")
          .reduce((sum, l) => sum + parseFloat(l.quantityChanged), 0);

        return {
          date,
          deliveries,
          usage,
          adjustments,
          netMovement: deliveries - usage + adjustments,
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    res.json({ data, period });
  } catch (error) {
    console.error("Get net movement error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * Get summary analytics
 * GET /api/inventory-logs/analytics/summary
 * 
 * Returns summary statistics for the given period
 * Useful for dashboard summary cards
 */
router.get("/analytics/summary", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { itemId, startDate, endDate } = req.query;

    const restaurantId = getEffectiveRestaurantId(req);
    if (!restaurantId) {
      return res.status(400).json({ message: "Restaurant ID required" });
    }

    const logs = await storage.getInventoryLogsFiltered(restaurantId, {
      itemId: itemId as string | undefined,
      startDate: parseDate(startDate as string),
      endDate: parseDate(endDate as string),
    });

    // Calculate summary statistics
    const totalDeliveries = logs
      .filter((l) => l.changeType === "Delivery")
      .reduce((sum, l) => sum + parseFloat(l.quantityChanged), 0);

    const totalUsage = logs
      .filter((l) => l.changeType === "Usage" && parseFloat(l.quantityChanged) < 0)
      .reduce((sum, l) => sum + Math.abs(parseFloat(l.quantityChanged)), 0);

    const totalAdjustments = logs
      .filter((l) => l.changeType === "Adjustment")
      .reduce((sum, l) => sum + parseFloat(l.quantityChanged), 0);

    const deliveryCount = logs.filter((l) => l.changeType === "Delivery").length;
    const usageCount = logs.filter((l) => l.changeType === "Usage").length;
    const adjustmentCount = logs.filter((l) => l.changeType === "Adjustment").length;

    // Calculate daily averages
    const uniqueDays = new Set(
      logs
        .filter((l) => l.createdAt)
        .map((l) => l.createdAt!.toISOString().split("T")[0])
    );
    const dayCount = uniqueDays.size || 1;

    res.json({
      summary: {
        totalDeliveries,
        totalUsage,
        totalAdjustments,
        netMovement: totalDeliveries - totalUsage + totalAdjustments,
        deliveryCount,
        usageCount,
        adjustmentCount,
        totalLogCount: logs.length,
        averageDailyUsage: totalUsage / dayCount,
        averageDailyDeliveries: totalDeliveries / dayCount,
        daysCovered: dayCount,
      },
    });
  } catch (error) {
    console.error("Get summary error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * Create inventory log entry (admin/manager only)
 * POST /api/inventory-logs
 * 
 * Creates a log entry and updates the inventory item quantity
 */
router.post(
  "/",
  authenticateToken,
  requireRestaurant,
  authorizeRoles(UserRole.ADMIN, UserRole.MANAGER),
  async (req: Request, res: Response) => {
    try {
      const validation = createInventoryLogSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          message: "Invalid log data",
          errors: validation.error.flatten(),
        });
      }

      const { inventoryItemId, changeType, quantityChanged, notes } = validation.data;

      // Verify the inventory item exists and belongs to user's restaurant
      const inventoryItem = await storage.getInventoryItem(inventoryItemId);
      if (!inventoryItem) {
        return res.status(404).json({ message: "Inventory item not found" });
      }
      if (inventoryItem.restaurantId !== req.user!.restaurantId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Calculate new quantity
      const currentQty = parseFloat(inventoryItem.quantity);
      const changeQty = parseFloat(String(quantityChanged));
      const newQty = currentQty + changeQty;

      // Create the log entry
      const logData = {
        inventoryItemId,
        restaurantId: req.user!.restaurantId!,
        changeType,
        quantityChanged: String(quantityChanged),
        finalQuantity: String(newQty),
        createdBy: req.user!.userId,
        notes: notes || null,
      };

      const log = await storage.createInventoryLog(logData);

      // Update the inventory item quantity
      await storage.updateInventoryItem(inventoryItemId, {
        quantity: String(newQty),
        updatedAt: new Date(),
      });

      res.status(201).json({ log });
    } catch (error) {
      console.error("Create inventory log error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }
);

/**
 * Update inventory log notes (admin only)
 * PATCH /api/inventory-logs/:id
 * 
 * Only allows updating notes field - quantities cannot be modified
 */
router.patch(
  "/:id",
  authenticateToken,
  requireRestaurant,
  authorizeRoles(UserRole.ADMIN),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      const validation = updateInventoryLogSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          message: "Invalid update data",
          errors: validation.error.flatten(),
        });
      }

      const existingLog = await storage.getInventoryLog(id);
      if (!existingLog) {
        return res.status(404).json({ message: "Inventory log not found" });
      }

      // Restaurant isolation check
      if (existingLog.restaurantId !== req.user!.restaurantId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const updatedLog = await storage.updateInventoryLog(id, validation.data);
      res.json({ log: updatedLog });
    } catch (error) {
      console.error("Update inventory log error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }
);

/**
 * Delete inventory log (admin only)
 * DELETE /api/inventory-logs/:id
 * 
 * Warning: This does NOT reverse the quantity change on the inventory item
 */
router.delete(
  "/:id",
  authenticateToken,
  requireRestaurant,
  authorizeRoles(UserRole.ADMIN),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const existingLog = await storage.getInventoryLog(id);
      if (!existingLog) {
        return res.status(404).json({ message: "Inventory log not found" });
      }

      // Restaurant isolation check
      if (existingLog.restaurantId !== req.user!.restaurantId) {
        return res.status(403).json({ message: "Access denied" });
      }

      await storage.deleteInventoryLog(id);
      res.json({ message: "Inventory log deleted successfully" });
    } catch (error) {
      console.error("Delete inventory log error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }
);

export default router;
