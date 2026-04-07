import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { startTaskNotificationScheduler } from "./services/task-notification.scheduler";
import path from "path";
import { pool } from "./db";
import bcrypt from "bcryptjs";

const app = express();

// Serve attached assets (recipe images, etc.)
app.use('/attached_assets', express.static(path.resolve(process.cwd(), 'attached_assets')));
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

// ANSI colour helpers
const c = {
  reset:  "\x1b[0m",
  dim:    "\x1b[2m",
  bold:   "\x1b[1m",
  green:  "\x1b[32m",
  yellow: "\x1b[33m",
  red:    "\x1b[31m",
  cyan:   "\x1b[36m",
  blue:   "\x1b[34m",
};

function statusColor(code: number) {
  if (code >= 500) return c.red;
  if (code >= 400) return c.yellow;
  if (code >= 300) return c.cyan;
  return c.green;
}

function methodColor(method: string) {
  switch (method) {
    case "GET":    return c.blue;
    case "POST":   return c.green;
    case "PATCH":
    case "PUT":    return c.yellow;
    case "DELETE": return c.red;
    default:       return c.reset;
  }
}

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${c.dim}${formattedTime}${c.reset} ${c.dim}[${source}]${c.reset} ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (!path.startsWith("/api")) return;

    const status = res.statusCode;
    const sc = statusColor(status);
    const mc = methodColor(req.method);

    const durationStr = duration > 500
      ? `${c.yellow}${duration}ms${c.reset}`
      : `${c.dim}${duration}ms${c.reset}`;

    let logLine =
      `  ${mc}${c.bold}${req.method.padEnd(6)}${c.reset} ` +
      `${c.dim}${path}${c.reset} ` +
      `${sc}${c.bold}${status}${c.reset} ` +
      `${durationStr}`;

    if (capturedJsonResponse) {
      const formatted = JSON.stringify(capturedJsonResponse, null, 2)
        .split("\n")
        .map((line, i) => (i === 0 ? ` :: ${line}` : `     ${line}`))
        .join("\n");
      logLine += `\n${c.dim}${formatted}${c.reset}`;
    }

    console.log(logLine + "\n");
  });

  next();
});

async function ensureSeedData() {
  try {
    // Check if restaurants already exist
    const { rows } = await pool.query("SELECT COUNT(*) AS count FROM restaurants");
    if (parseInt(rows[0].count, 10) > 0) return;

    log("No restaurants found — seeding initial data…", "seed");

    // Create the two restaurants
    const r1 = await pool.query(
      "INSERT INTO restaurants (name) VALUES ($1) RETURNING id",
      ["Restaurant Immortl"]
    );
    const r2 = await pool.query(
      "INSERT INTO restaurants (name) VALUES ($1) RETURNING id",
      ["Restaurant Mini Pavillion"]
    );
    const immortlId = r1.rows[0].id;
    const miniId    = r2.rows[0].id;

    // Create admin user (attached to Immortl by default)
    const hash = await bcrypt.hash("demo123", 10);
    await pool.query(
      `INSERT INTO users (name, email, password_hash, role, restaurant_id)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO NOTHING`,
      ["Admin User", "admin@demo.com", hash, "admin", immortlId]
    );

    log(`Seeded: Restaurant Immortl (${immortlId}), Restaurant Mini Pavillion (${miniId}), admin@demo.com`, "seed");
  } catch (err: any) {
    // Table might not exist yet on a brand-new deploy — that's okay, routes will handle it
    log(`Seed skipped: ${err.message}`, "seed");
  }
}

(async () => {
  await registerRoutes(httpServer, app);
  await ensureSeedData();

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
      
      // Start the task notification scheduler
      startTaskNotificationScheduler();
    },
  );
})();
