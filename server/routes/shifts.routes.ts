import { Router, Request, Response } from "express";
import { pool } from "../db";
import { 
  authenticateToken, 
  authorizeRoles 
} from "../middleware/auth.middleware";
import { 
  UserRole,
  createUserAvailabilitySchema,
  createShiftSchema,
  createShiftAssignmentSchema,
} from "@shared/schema";

const router = Router();

// SQL SELECT statements for column aliasing
const AVAILABILITY_SELECT = `
  id, user_id AS "userId", restaurant_id AS "restaurantId",
  day_of_week AS "dayOfWeek", specific_date AS "specificDate",
  start_time AS "startTime", end_time AS "endTime", 
  is_available AS "isAvailable", created_at AS "createdAt"
`;

const SHIFT_SELECT = `
  id, restaurant_id AS "restaurantId", shift_date AS "shiftDate",
  start_time AS "startTime", end_time AS "endTime", station,
  required_staff AS "requiredStaff", created_at AS "createdAt"
`;

const ASSIGNMENT_SELECT = `
  id, shift_id AS "shiftId", user_id AS "userId", status,
  created_at AS "createdAt"
`;

// Helper to get effective restaurant ID (supports admin restaurant switching)
function getEffectiveRestaurantId(req: Request): string | null {
  if (req.user?.role === UserRole.ADMIN && req.query.restaurantId) {
    return req.query.restaurantId as string;
  }
  return req.user?.restaurantId || null;
}

// ============================================================================
// AVAILABILITY ROUTES
// ============================================================================

// Get availability for a specific user
router.get("/availability/:userId", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const restaurantId = getEffectiveRestaurantId(req);

    // Users can only view their own availability, admins/managers can view all
    if (req.user!.role === UserRole.STAFF && req.user!.userId !== userId) {
      return res.status(403).json({ message: "Access denied" });
    }

    let query = `SELECT ${AVAILABILITY_SELECT} FROM user_availability WHERE user_id = $1`;
    const params: any[] = [userId];

    if (restaurantId) {
      query += ` AND restaurant_id = $2`;
      params.push(restaurantId);
    }

    query += ` ORDER BY day_of_week, start_time`;

    const result = await pool.query(query, params);
    res.json({ availability: result.rows });
  } catch (error) {
    console.error("Error fetching availability:", error);
    res.status(500).json({ message: "Failed to fetch availability" });
  }
});

// Get my availability
router.get("/availability", authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    let restaurantId = req.user!.restaurantId;

    // For admins without a restaurant, get the first available restaurant
    if (!restaurantId && req.user!.role === UserRole.ADMIN) {
      const defaultRestaurant = await pool.query(`SELECT id FROM restaurants LIMIT 1`);
      if (defaultRestaurant.rows.length > 0) {
        restaurantId = defaultRestaurant.rows[0].id;
      }
    }

    let query = `SELECT ${AVAILABILITY_SELECT} FROM user_availability WHERE user_id = $1`;
    const params: any[] = [userId];

    if (restaurantId) {
      query += ` AND restaurant_id = $2`;
      params.push(restaurantId);
    }

    query += ` ORDER BY day_of_week, start_time`;

    const result = await pool.query(query, params);
    res.json({ availability: result.rows });
  } catch (error) {
    console.error("Error fetching availability:", error);
    res.status(500).json({ message: "Failed to fetch availability" });
  }
});

// Create or update availability
router.post("/availability", authenticateToken, async (req: Request, res: Response) => {
  try {
    const parsed = createUserAvailabilitySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });
    }

    const { dayOfWeek, specificDate, startTime, endTime, isAvailable } = parsed.data;
    const userId = req.user!.userId;
    let restaurantId = req.user!.restaurantId;

    // For admins without a restaurant, get the first available restaurant
    if (!restaurantId && req.user!.role === UserRole.ADMIN) {
      const defaultRestaurant = await pool.query(`SELECT id FROM restaurants LIMIT 1`);
      if (defaultRestaurant.rows.length > 0) {
        restaurantId = defaultRestaurant.rows[0].id;
      }
    }

    if (!restaurantId) {
      return res.status(400).json({ message: "Restaurant ID required" });
    }

    // Upsert: Check if record exists for this user/restaurant/day (and specific date if provided)
    let existingQuery = `SELECT id FROM user_availability WHERE user_id = $1 AND restaurant_id = $2 AND day_of_week = $3`;
    const existingParams: any[] = [userId, restaurantId, dayOfWeek];
    
    if (specificDate) {
      existingQuery += ` AND specific_date = $4`;
      existingParams.push(specificDate);
    } else {
      existingQuery += ` AND specific_date IS NULL`;
    }

    const existingResult = await pool.query(existingQuery, existingParams);

    let result;
    if (existingResult.rows.length > 0) {
      // Update existing
      result = await pool.query(
        `UPDATE user_availability 
         SET start_time = $1, end_time = $2, is_available = $3, specific_date = $4
         WHERE id = $5
         RETURNING ${AVAILABILITY_SELECT}`,
        [startTime, endTime, isAvailable, specificDate || null, existingResult.rows[0].id]
      );
    } else {
      // Insert new
      result = await pool.query(
        `INSERT INTO user_availability (user_id, restaurant_id, day_of_week, specific_date, start_time, end_time, is_available)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING ${AVAILABILITY_SELECT}`,
        [userId, restaurantId, dayOfWeek, specificDate || null, startTime, endTime, isAvailable]
      );
    }

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error saving availability:", error);
    res.status(500).json({ message: "Failed to save availability" });
  }
});

// Delete availability entry
router.delete("/availability/:id", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Verify ownership
    const existing = await pool.query(
      `SELECT user_id FROM user_availability WHERE id = $1`,
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ message: "Availability not found" });
    }

    if (req.user!.role === UserRole.STAFF && existing.rows[0].user_id !== req.user!.userId) {
      return res.status(403).json({ message: "Access denied" });
    }

    await pool.query(`DELETE FROM user_availability WHERE id = $1`, [id]);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting availability:", error);
    res.status(500).json({ message: "Failed to delete availability" });
  }
});

// Get my allocated/assigned shifts
router.get("/my-shifts", authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    
    // Get all shifts where user is assigned, ordered by date
    const result = await pool.query(
      `SELECT s.id, s.restaurant_id AS "restaurantId", s.shift_date AS "shiftDate",
              s.start_time AS "startTime", s.end_time AS "endTime", s.station,
              s.required_staff AS "requiredStaff", s.created_at AS "createdAt",
              sa.id AS "assignmentId", sa.status AS "assignmentStatus",
              r.name AS "restaurantName"
       FROM shifts s
       JOIN shift_assignments sa ON s.id = sa.shift_id
       JOIN restaurants r ON s.restaurant_id = r.id
       WHERE sa.user_id = $1
         AND s.shift_date >= CURRENT_DATE
       ORDER BY s.shift_date, s.start_time`,
      [userId]
    );

    res.json({ shifts: result.rows });
  } catch (error) {
    console.error("Error fetching my shifts:", error);
    res.status(500).json({ message: "Failed to fetch my shifts" });
  }
});

// ============================================================================
// SHIFT ROUTES
// ============================================================================

// Get shifts for a specific date
router.get("/", authenticateToken, async (req: Request, res: Response) => {
  try {
    const restaurantId = getEffectiveRestaurantId(req);
    const { date } = req.query;

    if (!restaurantId) {
      return res.status(400).json({ message: "Restaurant ID required" });
    }

    let query = `SELECT ${SHIFT_SELECT} FROM shifts WHERE restaurant_id = $1`;
    const params: any[] = [restaurantId];

    if (date) {
      query += ` AND shift_date = $2`;
      params.push(date);
    }

    query += ` ORDER BY shift_date, start_time`;

    const result = await pool.query(query, params);
    
    // Fetch assignments for each shift
    const shiftsWithAssignments = await Promise.all(
      result.rows.map(async (shift) => {
        const assignmentsResult = await pool.query(
          `SELECT sa.id, sa.shift_id AS "shiftId", sa.user_id AS "userId", sa.status, 
                  sa.created_at AS "createdAt", u.name AS "userName"
           FROM shift_assignments sa
           JOIN users u ON sa.user_id = u.id
           WHERE sa.shift_id = $1`,
          [shift.id]
        );
        return { ...shift, assignments: assignmentsResult.rows };
      })
    );

    res.json({ shifts: shiftsWithAssignments });
  } catch (error) {
    console.error("Error fetching shifts:", error);
    res.status(500).json({ message: "Failed to fetch shifts" });
  }
});

// Get shifts for a week
router.get("/week", authenticateToken, async (req: Request, res: Response) => {
  try {
    const restaurantId = getEffectiveRestaurantId(req);
    const { start } = req.query;

    if (!restaurantId || !start) {
      return res.status(400).json({ message: "Restaurant ID and start date required" });
    }

    // Calculate end date (7 days from start)
    const startDate = new Date(start as string);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);
    const endStr = endDate.toISOString().split("T")[0];

    const result = await pool.query(
      `SELECT ${SHIFT_SELECT} FROM shifts 
       WHERE restaurant_id = $1 AND shift_date >= $2 AND shift_date <= $3
       ORDER BY shift_date, start_time`,
      [restaurantId, start, endStr]
    );

    // Fetch assignments for each shift
    const shiftsWithAssignments = await Promise.all(
      result.rows.map(async (shift) => {
        const assignmentsResult = await pool.query(
          `SELECT sa.id, sa.shift_id AS "shiftId", sa.user_id AS "userId", sa.status, 
                  sa.created_at AS "createdAt", u.name AS "userName"
           FROM shift_assignments sa
           JOIN users u ON sa.user_id = u.id
           WHERE sa.shift_id = $1`,
          [shift.id]
        );
        return { ...shift, assignments: assignmentsResult.rows };
      })
    );

    res.json({ shifts: shiftsWithAssignments });
  } catch (error) {
    console.error("Error fetching week shifts:", error);
    res.status(500).json({ message: "Failed to fetch shifts" });
  }
});

// Get shifts for a month
router.get("/month", authenticateToken, async (req: Request, res: Response) => {
  try {
    const restaurantId = getEffectiveRestaurantId(req);
    const { year, month } = req.query;

    if (!restaurantId || !year || !month) {
      return res.status(400).json({ message: "Restaurant ID, year, and month required" });
    }

    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const endDate = new Date(Number(year), Number(month), 0).toISOString().split("T")[0];

    const result = await pool.query(
      `SELECT ${SHIFT_SELECT} FROM shifts 
       WHERE restaurant_id = $1 AND shift_date >= $2 AND shift_date <= $3
       ORDER BY shift_date, start_time`,
      [restaurantId, startDate, endDate]
    );

    // Fetch assignments for each shift
    const shiftsWithAssignments = await Promise.all(
      result.rows.map(async (shift) => {
        const assignmentsResult = await pool.query(
          `SELECT sa.id, sa.shift_id AS "shiftId", sa.user_id AS "userId", sa.status, 
                  sa.created_at AS "createdAt", u.name AS "userName"
           FROM shift_assignments sa
           JOIN users u ON sa.user_id = u.id
           WHERE sa.shift_id = $1`,
          [shift.id]
        );
        return { ...shift, assignments: assignmentsResult.rows };
      })
    );

    res.json({ shifts: shiftsWithAssignments });
  } catch (error) {
    console.error("Error fetching month shifts:", error);
    res.status(500).json({ message: "Failed to fetch shifts" });
  }
});

// Create a shift (manager/admin only)
router.post("/", 
  authenticateToken, 
  authorizeRoles(UserRole.ADMIN, UserRole.MANAGER),
  async (req: Request, res: Response) => {
    try {
      const parsed = createShiftSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });
      }

      let restaurantId = req.user!.restaurantId;
      if (req.user!.role === UserRole.ADMIN && req.body.restaurantId) {
        restaurantId = req.body.restaurantId;
      }

      if (!restaurantId) {
        return res.status(400).json({ message: "Restaurant ID required" });
      }

      const { shiftDate, startTime, endTime, station, requiredStaff } = parsed.data;

      const result = await pool.query(
        `INSERT INTO shifts (restaurant_id, shift_date, start_time, end_time, station, required_staff)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING ${SHIFT_SELECT}`,
        [restaurantId, shiftDate, startTime, endTime, station, requiredStaff]
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("Error creating shift:", error);
      res.status(500).json({ message: "Failed to create shift" });
    }
  }
);

// Update a shift
router.patch("/:id", 
  authenticateToken, 
  authorizeRoles(UserRole.ADMIN, UserRole.MANAGER),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // Verify shift exists and belongs to user's restaurant
      const existing = await pool.query(
        `SELECT restaurant_id FROM shifts WHERE id = $1`,
        [id]
      );

      if (existing.rows.length === 0) {
        return res.status(404).json({ message: "Shift not found" });
      }

      if (req.user!.role !== UserRole.ADMIN && existing.rows[0].restaurant_id !== req.user!.restaurantId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const updates: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      const allowedFields = ["shiftDate", "startTime", "endTime", "station", "requiredStaff"];
      const fieldMap: Record<string, string> = {
        shiftDate: "shift_date",
        startTime: "start_time",
        endTime: "end_time",
        station: "station",
        requiredStaff: "required_staff",
      };

      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updates.push(`${fieldMap[field]} = $${paramCount}`);
          values.push(req.body[field]);
          paramCount++;
        }
      }

      if (updates.length === 0) {
        return res.status(400).json({ message: "No valid fields to update" });
      }

      values.push(id);
      const result = await pool.query(
        `UPDATE shifts SET ${updates.join(", ")} WHERE id = $${paramCount} RETURNING ${SHIFT_SELECT}`,
        values
      );

      res.json(result.rows[0]);
    } catch (error) {
      console.error("Error updating shift:", error);
      res.status(500).json({ message: "Failed to update shift" });
    }
  }
);

// Delete a shift
router.delete("/:id", 
  authenticateToken, 
  authorizeRoles(UserRole.ADMIN, UserRole.MANAGER),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const existing = await pool.query(
        `SELECT restaurant_id FROM shifts WHERE id = $1`,
        [id]
      );

      if (existing.rows.length === 0) {
        return res.status(404).json({ message: "Shift not found" });
      }

      if (req.user!.role !== UserRole.ADMIN && existing.rows[0].restaurant_id !== req.user!.restaurantId) {
        return res.status(403).json({ message: "Access denied" });
      }

      await pool.query(`DELETE FROM shifts WHERE id = $1`, [id]);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting shift:", error);
      res.status(500).json({ message: "Failed to delete shift" });
    }
  }
);

// ============================================================================
// SHIFT ASSIGNMENT ROUTES
// ============================================================================

// Get available users for a shift (based on availability)
router.get("/:shiftId/available-users", 
  authenticateToken, 
  authorizeRoles(UserRole.ADMIN, UserRole.MANAGER),
  async (req: Request, res: Response) => {
    try {
      const { shiftId } = req.params;

      // Get shift details
      const shiftResult = await pool.query(
        `SELECT ${SHIFT_SELECT} FROM shifts WHERE id = $1`,
        [shiftId]
      );

      if (shiftResult.rows.length === 0) {
        return res.status(404).json({ message: "Shift not found" });
      }

      const shift = shiftResult.rows[0];

      // Find users who are available on this specific date and time, not already assigned
      // Uses specific_date availability (not weekly recurring)
      // Also filters by user station matching shift station
      const availableUsersResult = await pool.query(
        `SELECT DISTINCT u.id, u.name, u.email, u.role, u.station,
                ua.start_time AS "availableFrom", ua.end_time AS "availableTo"
         FROM users u
         JOIN user_availability ua ON u.id = ua.user_id
         WHERE ua.restaurant_id = $1
           AND ua.specific_date = $2
           AND ua.is_available = true
           AND ua.start_time <= $3
           AND ua.end_time >= $4
           AND u.station = $5
           AND u.id NOT IN (
             SELECT sa.user_id FROM shift_assignments sa
             JOIN shifts s ON sa.shift_id = s.id
             WHERE s.shift_date = $2
               AND s.restaurant_id = $1
               AND NOT (s.end_time <= $3 OR s.start_time >= $4)
           )
         ORDER BY u.name`,
        [shift.restaurantId, shift.shiftDate, shift.startTime, shift.endTime, shift.station]
      );

      res.json({ users: availableUsersResult.rows });
    } catch (error) {
      console.error("Error fetching available users:", error);
      res.status(500).json({ message: "Failed to fetch available users" });
    }
  }
);

// Assign user to shift
router.post("/assignments", 
  authenticateToken, 
  authorizeRoles(UserRole.ADMIN, UserRole.MANAGER),
  async (req: Request, res: Response) => {
    try {
      const parsed = createShiftAssignmentSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });
      }

      const { shiftId, userId } = parsed.data;

      // Check if shift exists
      const shiftResult = await pool.query(
        `SELECT ${SHIFT_SELECT} FROM shifts WHERE id = $1`,
        [shiftId]
      );

      if (shiftResult.rows.length === 0) {
        return res.status(404).json({ message: "Shift not found" });
      }

      const shift = shiftResult.rows[0];

      // Verify access
      if (req.user!.role !== UserRole.ADMIN && shift.restaurantId !== req.user!.restaurantId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Check for double-booking (overlapping shifts for same user on same date)
      const overlapResult = await pool.query(
        `SELECT s.id FROM shifts s
         JOIN shift_assignments sa ON s.id = sa.shift_id
         WHERE sa.user_id = $1
           AND s.shift_date = $2
           AND NOT (s.end_time <= $3 OR s.start_time >= $4)`,
        [userId, shift.shiftDate, shift.startTime, shift.endTime]
      );

      if (overlapResult.rows.length > 0) {
        return res.status(400).json({ message: "User is already assigned to an overlapping shift" });
      }

      // Check if already assigned to this shift
      const existingResult = await pool.query(
        `SELECT id FROM shift_assignments WHERE shift_id = $1 AND user_id = $2`,
        [shiftId, userId]
      );

      if (existingResult.rows.length > 0) {
        return res.status(400).json({ message: "User is already assigned to this shift" });
      }

      // Create assignment
      const result = await pool.query(
        `INSERT INTO shift_assignments (shift_id, user_id)
         VALUES ($1, $2)
         RETURNING ${ASSIGNMENT_SELECT}`,
        [shiftId, userId]
      );

      // Fetch user name for response
      const userResult = await pool.query(`SELECT name FROM users WHERE id = $1`, [userId]);
      const assignment = { ...result.rows[0], userName: userResult.rows[0]?.name };

      res.status(201).json(assignment);
    } catch (error) {
      console.error("Error creating assignment:", error);
      res.status(500).json({ message: "Failed to create assignment" });
    }
  }
);

// Update assignment status
router.patch("/assignments/:id", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["assigned", "confirmed", "swapped"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    // Verify assignment exists
    const existing = await pool.query(
      `SELECT sa.*, s.restaurant_id AS "restaurantId"
       FROM shift_assignments sa
       JOIN shifts s ON sa.shift_id = s.id
       WHERE sa.id = $1`,
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ message: "Assignment not found" });
    }

    // Users can confirm their own assignments
    if (req.user!.role === UserRole.STAFF && existing.rows[0].user_id !== req.user!.userId) {
      return res.status(403).json({ message: "Access denied" });
    }

    const result = await pool.query(
      `UPDATE shift_assignments SET status = $1 WHERE id = $2 RETURNING ${ASSIGNMENT_SELECT}`,
      [status, id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error updating assignment:", error);
    res.status(500).json({ message: "Failed to update assignment" });
  }
});

// Remove assignment
router.delete("/assignments/:id", 
  authenticateToken, 
  authorizeRoles(UserRole.ADMIN, UserRole.MANAGER),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const existing = await pool.query(
        `SELECT sa.*, s.restaurant_id AS "restaurantId"
         FROM shift_assignments sa
         JOIN shifts s ON sa.shift_id = s.id
         WHERE sa.id = $1`,
        [id]
      );

      if (existing.rows.length === 0) {
        return res.status(404).json({ message: "Assignment not found" });
      }

      if (req.user!.role !== UserRole.ADMIN && existing.rows[0].restaurantId !== req.user!.restaurantId) {
        return res.status(403).json({ message: "Access denied" });
      }

      await pool.query(`DELETE FROM shift_assignments WHERE id = $1`, [id]);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting assignment:", error);
      res.status(500).json({ message: "Failed to delete assignment" });
    }
  }
);

// Get all users for a restaurant (for assignment dropdown)
router.get("/users", authenticateToken, async (req: Request, res: Response) => {
  try {
    const restaurantId = getEffectiveRestaurantId(req);

    if (!restaurantId) {
      return res.status(400).json({ message: "Restaurant ID required" });
    }

    const result = await pool.query(
      `SELECT id, name, email, role FROM users WHERE restaurant_id = $1 ORDER BY name`,
      [restaurantId]
    );

    res.json({ users: result.rows });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

export default router;
