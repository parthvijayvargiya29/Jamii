import { Router, Request, Response } from "express";
import { storage } from "../storage";
import { 
  authenticateToken, 
  authorizeRoles, 
  requireRestaurant,
  restrictToRestaurant 
} from "../middleware/auth.middleware";
import { insertCleaningTaskSchema, insertCleaningLogSchema, UserRole } from "@shared/schema";
import { checkAndNotifyIncompleteTasks } from "../services/task-notification.scheduler";

const router = Router();

router.get("/", authenticateToken, requireRestaurant, async (req: Request, res: Response) => {
  try {
    const restaurantId = req.user!.restaurantId!;
    const tasks = await storage.getCleaningTasksByRestaurant(restaurantId);
    res.json(tasks);
  } catch (error) {
    console.error("Error fetching cleaning tasks:", error);
    res.status(500).json({ message: "Failed to fetch cleaning tasks" });
  }
});

router.get("/:id", authenticateToken, async (req: Request, res: Response) => {
  try {
    const task = await storage.getCleaningTask(req.params.id);
    if (!task) {
      return res.status(404).json({ message: "Cleaning task not found" });
    }
    
    if (req.user!.role !== UserRole.ADMIN && task.restaurantId !== req.user!.restaurantId) {
      return res.status(403).json({ message: "Access denied to this task" });
    }
    
    res.json(task);
  } catch (error) {
    console.error("Error fetching cleaning task:", error);
    res.status(500).json({ message: "Failed to fetch cleaning task" });
  }
});

router.post("/", 
  authenticateToken, 
  authorizeRoles(UserRole.ADMIN, UserRole.MANAGER),
  requireRestaurant,
  async (req: Request, res: Response) => {
    try {
      const data = insertCleaningTaskSchema.parse({
        ...req.body,
        restaurantId: req.user!.restaurantId
      });
      
      const task = await storage.createCleaningTask(data);
      res.status(201).json(task);
    } catch (error) {
      console.error("Error creating cleaning task:", error);
      res.status(400).json({ message: "Failed to create cleaning task" });
    }
  }
);

router.patch("/:id", 
  authenticateToken, 
  authorizeRoles(UserRole.ADMIN, UserRole.MANAGER),
  async (req: Request, res: Response) => {
    try {
      const task = await storage.getCleaningTask(req.params.id);
      if (!task) {
        return res.status(404).json({ message: "Cleaning task not found" });
      }
      
      if (req.user!.role !== UserRole.ADMIN && task.restaurantId !== req.user!.restaurantId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const updated = await storage.updateCleaningTask(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      console.error("Error updating cleaning task:", error);
      res.status(400).json({ message: "Failed to update cleaning task" });
    }
  }
);

router.delete("/:id", 
  authenticateToken, 
  authorizeRoles(UserRole.ADMIN, UserRole.MANAGER),
  async (req: Request, res: Response) => {
    try {
      const task = await storage.getCleaningTask(req.params.id);
      if (!task) {
        return res.status(404).json({ message: "Cleaning task not found" });
      }
      
      if (req.user!.role !== UserRole.ADMIN && task.restaurantId !== req.user!.restaurantId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      await storage.deleteCleaningTask(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting cleaning task:", error);
      res.status(500).json({ message: "Failed to delete cleaning task" });
    }
  }
);

router.get("/logs/all", authenticateToken, requireRestaurant, async (req: Request, res: Response) => {
  try {
    const restaurantId = req.user!.restaurantId!;
    const logs = await storage.getCleaningLogsByRestaurant(restaurantId);
    res.json(logs);
  } catch (error) {
    console.error("Error fetching cleaning logs:", error);
    res.status(500).json({ message: "Failed to fetch cleaning logs" });
  }
});

router.get("/:id/logs", authenticateToken, async (req: Request, res: Response) => {
  try {
    const task = await storage.getCleaningTask(req.params.id);
    if (!task) {
      return res.status(404).json({ message: "Cleaning task not found" });
    }
    
    if (req.user!.role !== UserRole.ADMIN && task.restaurantId !== req.user!.restaurantId) {
      return res.status(403).json({ message: "Access denied" });
    }
    
    const logs = await storage.getCleaningLogsByTask(req.params.id);
    res.json(logs);
  } catch (error) {
    console.error("Error fetching cleaning logs:", error);
    res.status(500).json({ message: "Failed to fetch cleaning logs" });
  }
});

router.post("/:id/complete", authenticateToken, async (req: Request, res: Response) => {
  try {
    const task = await storage.getCleaningTask(req.params.id);
    if (!task) {
      return res.status(404).json({ message: "Cleaning task not found" });
    }
    
    if (req.user!.role !== UserRole.ADMIN && task.restaurantId !== req.user!.restaurantId) {
      return res.status(403).json({ message: "Access denied" });
    }
    
    const log = await storage.createCleaningLog({
      cleaningTaskId: req.params.id,
      completedBy: req.user!.userId,
      notes: req.body.notes || null
    });
    
    res.status(201).json(log);
  } catch (error) {
    console.error("Error completing cleaning task:", error);
    res.status(400).json({ message: "Failed to complete cleaning task" });
  }
});

router.post("/notifications/test", 
  authenticateToken, 
  authorizeRoles(UserRole.ADMIN),
  async (req: Request, res: Response) => {
    try {
      console.log("[Manual Test] Admin triggered notification check");
      await checkAndNotifyIncompleteTasks();
      res.json({ message: "Notification check completed. Check server logs for details." });
    } catch (error) {
      console.error("Error running notification check:", error);
      res.status(500).json({ message: "Failed to run notification check" });
    }
  }
);

export default router;
