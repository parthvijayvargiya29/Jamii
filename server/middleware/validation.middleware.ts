/**
 * Validation Middleware
 * 
 * Request validation middleware using Zod schemas.
 * Validates request body, query params, and route params.
 */

import type { Request, Response, NextFunction } from "express";
import type { ZodSchema } from "zod";

/**
 * Middleware factory for validating request body
 */
export const validateBody = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({
          message: "Validation failed",
          errors: result.error.flatten().fieldErrors,
        });
      }
      req.body = result.data;
      next();
    } catch (error) {
      return res.status(400).json({ message: "Invalid request body" });
    }
  };
};

/**
 * Middleware factory for validating query parameters
 */
export const validateQuery = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.safeParse(req.query);
      if (!result.success) {
        return res.status(400).json({
          message: "Validation failed",
          errors: result.error.flatten().fieldErrors,
        });
      }
      req.query = result.data;
      next();
    } catch (error) {
      return res.status(400).json({ message: "Invalid query parameters" });
    }
  };
};

/**
 * Middleware factory for validating route parameters
 */
export const validateParams = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.safeParse(req.params);
      if (!result.success) {
        return res.status(400).json({
          message: "Validation failed",
          errors: result.error.flatten().fieldErrors,
        });
      }
      req.params = result.data;
      next();
    } catch (error) {
      return res.status(400).json({ message: "Invalid route parameters" });
    }
  };
};
