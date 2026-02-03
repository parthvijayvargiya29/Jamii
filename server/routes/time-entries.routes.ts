import { Router, Request, Response } from "express";
import { pool } from "../db";
import { authenticateToken } from "../middleware/auth.middleware";
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

export default router;
