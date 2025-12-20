/**
 * JWT Utilities
 * 
 * Helper functions for JWT token operations.
 */

import jwt from "jsonwebtoken";
import jwtConfig from "../config/jwt";
import type { JWTPayload } from "@shared/schema";

// Token expiration times in seconds
const ACCESS_TOKEN_EXPIRY = 60 * 60; // 1 hour
const REFRESH_TOKEN_EXPIRY = 60 * 60 * 24 * 7; // 7 days

/**
 * Generate an access token
 */
export const generateAccessToken = (payload: JWTPayload): string => {
  return jwt.sign(payload as object, jwtConfig.secret, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
    issuer: jwtConfig.issuer,
  });
};

/**
 * Generate a refresh token
 */
export const generateRefreshToken = (payload: JWTPayload): string => {
  return jwt.sign(payload as object, jwtConfig.secret, {
    expiresIn: REFRESH_TOKEN_EXPIRY,
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
