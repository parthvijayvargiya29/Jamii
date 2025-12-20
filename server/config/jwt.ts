/**
 * JWT Configuration
 * 
 * Configuration for JSON Web Token authentication.
 */

export interface JWTConfig {
  secret: string;
  expiresIn: string;
  refreshExpiresIn: string;
  issuer: string;
}

const config: JWTConfig = {
  // Secret should be set via environment variable in production
  secret: process.env.JWT_SECRET || "your-secret-key-change-in-production",
  expiresIn: process.env.JWT_EXPIRES_IN || "1h",
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  issuer: process.env.JWT_ISSUER || "my-app",
};

export default config;
