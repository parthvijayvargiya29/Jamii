/**
 * JWT Utilities
 * 
 * Helper functions for JWT token operations.
 */

import jwt from "jsonwebtoken";
import jwtConfig from "../config/jwt";
import type { JWTPayload } from "@shared/schema";

/**
 * Generate an access token
 */
export const generateAccessToken = (payload: JWTPayload): string => {
  return jwt.sign(payload, jwtConfig.secret, {
    expiresIn: jwtConfig.expiresIn,
    issuer: jwtConfig.issuer,
  });
};

/**
 * Generate a refresh token
 */
export const generateRefreshToken = (payload: JWTPayload): string => {
  return jwt.sign(payload, jwtConfig.secret, {
    expiresIn: jwtConfig.refreshExpiresIn,
    issuer: jwtConfig.issuer,
  });
};

/**
 * Verify and decode a token
 */
export const verifyToken = (token: string): JWTPayload | null => {
  try {
    const decoded = jwt.verify(token, jwtConfig.secret, {
      issuer: jwtConfig.issuer,
    }) as JWTPayload;
    return decoded;
  } catch (error) {
    return null;
  }
};

/**
 * Decode a token without verification (for debugging)
 */
export const decodeToken = (token: string): JWTPayload | null => {
  try {
    return jwt.decode(token) as JWTPayload;
  } catch (error) {
    return null;
  }
};
