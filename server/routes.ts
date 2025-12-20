/**
 * Routes Registration
 * 
 * Main routes file that registers all API routes.
 * Individual route modules are in /routes folder.
 */

import type { Express } from "express";
import { createServer, type Server } from "http";
import apiRoutes from "./routes/index";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Mount all API routes under /api prefix
  app.use("/api", apiRoutes);

  return httpServer;
}
