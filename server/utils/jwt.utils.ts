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

// Token type claim to differentiate access vs refresh tokens
const TOKEN_TYPE_ACCESS = "access";
const TOKEN_TYPE_REFRESH = "refresh";

interface TokenPayload extends JWTPayload {
  tokenType: string;
}

/**
 * Generate an access token
 */
export const generateAccessToken = (payload: JWTPayload): string => {
  const tokenPayload: TokenPayload = { ...payload, tokenType: TOKEN_TYPE_ACCESS };
  return jwt.sign(tokenPayload as object, jwtConfig.secret, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
    issuer: jwtConfig.issuer,
  });
};

/**
 * Generate a refresh token
 */
export const generateRefreshToken = (payload: JWTPayload): string => {
  const tokenPayload: TokenPayload = { ...payload, tokenType: TOKEN_TYPE_REFRESH };
  return jwt.sign(tokenPayload as object, jwtConfig.secret, {
    expiresIn: REFRESH_TOKEN_EXPIRY,
    issuer: jwtConfig.issuer,
  });
};

/**
 * Verify and decode an access token
 * Rejects refresh tokens to prevent token type confusion
 */
export const verifyToken = (token: string): JWTPayload | null => {
  try {
    const decoded = jwt.verify(token, jwtConfig.secret, {
      issuer: jwtConfig.issuer,
    }) as TokenPayload;
    
    // Reject if this is a refresh token being used as access token
    if (decoded.tokenType === TOKEN_TYPE_REFRESH) {
      return null;
    }
    
    return decoded;
  } catch (error) {
    return null;
  }
};

/**
 * Verify and decode a refresh token
 * Rejects access tokens to prevent token type confusion
 */
export const verifyRefreshToken = (token: string): JWTPayload | null => {
  try {
    const decoded = jwt.verify(token, jwtConfig.secret, {
      issuer: jwtConfig.issuer,
    }) as TokenPayload;
    
    // Only accept refresh tokens
    if (decoded.tokenType !== TOKEN_TYPE_REFRESH) {
      return null;
    }
    
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
