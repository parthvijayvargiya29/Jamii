import { Router, Request, Response } from "express";
import { pool } from "../db";
import { authenticateToken, authorizeRoles } from "../middleware/auth.middleware";
import { clockInSchema, TimeEntryStatus } from "@shared/schema";

const router = Router();

const TIME_ENTRY_SELECT = `
  id, user_id AS "userId", shift_id AS "shiftId", 
  restaurant_id AS "restaurantId", clock_in_time AS "clockInTime",
  clock_out_time AS "clockOutTime", total_minutes AS "totalMinutes",
  status, created_at AS "createdAt"
`;

router.post("/clock-in", authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const restaurantId = req.user!.restaurantId;

    if (!restaurantId) {
      return res.status(400).json({ message: "User must be assigned to a restaurant" });
    }

    const parsed = clockInSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });
    }

    const openEntryResult = await pool.query(
      `SELECT id FROM time_entries WHERE user_id = $1 AND status = $2`,
      [userId, TimeEntryStatus.OPEN]
    );

    if (openEntryResult.rows.length > 0) {
      return res.status(400).json({ 
        message: "You already have an open time entry. Please clock out first.",
        openEntryId: openEntryResult.rows[0].id
      });
    }

    let shiftId = parsed.data.shiftId || null;

    if (!shiftId) {
      const today = new Date().toISOString().split('T')[0];
      const shiftResult = await pool.query(
        `SELECT s.id FROM shifts s
         JOIN shift_assignments sa ON s.id = sa.shift_id
         WHERE sa.user_id = $1 AND s.shift_date = $2 AND s.restaurant_id = $3
         LIMIT 1`,
        [userId, today, restaurantId]
      );
      if (shiftResult.rows.length > 0) {
        shiftId = shiftResult.rows[0].id;
      }
    }

    const result = await pool.query(
      `INSERT INTO time_entries (user_id, restaurant_id, shift_id, clock_in_time, status)
       VALUES ($1, $2, $3, NOW(), $4)
       RETURNING ${TIME_ENTRY_SELECT}`,
      [userId, restaurantId, shiftId, TimeEntryStatus.OPEN]
    );

    res.status(201).json({
      message: "Clocked in successfully",
      timeEntry: result.rows[0]
    });
  } catch (error) {
    console.error("Error clocking in:", error);
    res.status(500).json({ message: "Failed to clock in" });
  }
});

router.get("/status", authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const openEntryResult = await pool.query(
      `SELECT ${TIME_ENTRY_SELECT} FROM time_entries WHERE user_id = $1 AND status = $2`,
      [userId, TimeEntryStatus.OPEN]
    );

    if (openEntryResult.rows.length === 0) {
      return res.json({ hasOpenEntry: false, openEntry: null });
    }

    res.json({ hasOpenEntry: true, openEntry: openEntryResult.rows[0] });
  } catch (error) {
    console.error("Error fetching time entry status:", error);
    res.status(500).json({ message: "Failed to fetch status" });
  }
});

router.post("/clock-out", authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const openEntryResult = await pool.query(
      `SELECT ${TIME_ENTRY_SELECT} FROM time_entries WHERE user_id = $1 AND status = $2`,
      [userId, TimeEntryStatus.OPEN]
    );

    if (openEntryResult.rows.length === 0) {
      return res.status(400).json({ 
        message: "No open time entry found. Please clock in first."
      });
    }

    const openEntry = openEntryResult.rows[0];

    const result = await pool.query(
      `UPDATE time_entries 
       SET clock_out_time = NOW(),
           total_minutes = EXTRACT(EPOCH FROM (NOW() - clock_in_time)) / 60,
           status = $1
       WHERE id = $2
       RETURNING ${TIME_ENTRY_SELECT}`,
      [TimeEntryStatus.CLOSED, openEntry.id]
    );

    res.json({
      message: "Clocked out successfully",
      timeEntry: result.rows[0]
    });
  } catch (error) {
    console.error("Error clocking out:", error);
    res.status(500).json({ message: "Failed to clock out" });
  }
});

const MANAGER_TIME_ENTRY_SELECT = `
  te.id,
  te.user_id AS "userId",
  te.shift_id AS "shiftId",
  te.restaurant_id AS "restaurantId",
  te.clock_in_time AS "clockInTime",
  te.clock_out_time AS "clockOutTime",
  te.total_minutes AS "totalMinutes",
  te.status,
  te.created_at AS "createdAt",
  u.name AS "userName",
  s.start_time AS "shiftStartTime",
  s.end_time AS "shiftEndTime",
  s.station AS "shiftStation"
`;

router.get("/today", authenticateToken, authorizeRoles("admin", "manager"), async (req: Request, res: Response) => {
  try {
    const restaurantId = req.user!.restaurantId;
    const today = new Date().toISOString().split('T')[0];

    const result = await pool.query(
      `SELECT ${MANAGER_TIME_ENTRY_SELECT}
       FROM time_entries te
       JOIN users u ON te.user_id = u.id
       LEFT JOIN shifts s ON te.shift_id = s.id
       WHERE te.restaurant_id = $1 AND DATE(te.clock_in_time) = $2
       ORDER BY te.clock_in_time DESC`,
      [restaurantId, today]
    );

    res.json({ entries: result.rows });
  } catch (error) {
    console.error("Error fetching today's time entries:", error);
    res.status(500).json({ message: "Failed to fetch time entries" });
  }
});

router.get("/week", authenticateToken, authorizeRoles("admin", "manager"), async (req: Request, res: Response) => {
  try {
    const restaurantId = req.user!.restaurantId;
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const result = await pool.query(
      `SELECT ${MANAGER_TIME_ENTRY_SELECT}
       FROM time_entries te
       JOIN users u ON te.user_id = u.id
       LEFT JOIN shifts s ON te.shift_id = s.id
       WHERE te.restaurant_id = $1 AND DATE(te.clock_in_time) >= $2
       ORDER BY te.clock_in_time DESC`,
      [restaurantId, weekAgo.toISOString().split('T')[0]]
    );

    res.json({ entries: result.rows });
  } catch (error) {
    console.error("Error fetching week's time entries:", error);
    res.status(500).json({ message: "Failed to fetch time entries" });
  }
});

router.get("/by-user/:id", authenticateToken, authorizeRoles("admin", "manager"), async (req: Request, res: Response) => {
  try {
    const restaurantId = req.user!.restaurantId;
    const targetUserId = req.params.id;

    const userCheck = await pool.query(
      `SELECT id FROM users WHERE id = $1 AND restaurant_id = $2`,
      [targetUserId, restaurantId]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({ message: "User not found in your restaurant" });
    }

    const result = await pool.query(
      `SELECT ${MANAGER_TIME_ENTRY_SELECT}
       FROM time_entries te
       JOIN users u ON te.user_id = u.id
       LEFT JOIN shifts s ON te.shift_id = s.id
       WHERE te.user_id = $1 AND te.restaurant_id = $2
       ORDER BY te.clock_in_time DESC
       LIMIT 50`,
      [targetUserId, restaurantId]
    );

    res.json({ entries: result.rows });
  } catch (error) {
    console.error("Error fetching user time entries:", error);
    res.status(500).json({ message: "Failed to fetch time entries" });
  }
});

export default router;
