/**
 * Database Configuration
 * 
 * Supports multiple database backends:
 * - SQLite (development)
 * - PostgreSQL (production)
 * 
 * Switch between databases using DATABASE_TYPE environment variable.
 */

export type DatabaseType = "sqlite" | "postgresql";

interface DatabaseConfig {
  type: DatabaseType;
  sqlite: {
    filename: string;
  };
  postgresql: {
    connectionString: string;
  };
}

// Default configuration
const config: DatabaseConfig = {
  type: (process.env.DATABASE_TYPE as DatabaseType) || "sqlite",
  sqlite: {
    filename: process.env.SQLITE_DB_PATH || "./data/app.db",
  },
  postgresql: {
    connectionString: process.env.DATABASE_URL || "",
  },
};

/**
 * Get the current database type
 */
export const getDatabaseType = (): DatabaseType => {
  return config.type;
};

/**
 * Check if using SQLite
 */
export const isSQLite = (): boolean => {
  return config.type === "sqlite";
};

/**
 * Check if using PostgreSQL
 */
export const isPostgreSQL = (): boolean => {
  return config.type === "postgresql";
};

/**
 * Get SQLite configuration
 */
export const getSQLiteConfig = () => {
  return config.sqlite;
};

/**
 * Get PostgreSQL configuration
 */
export const getPostgreSQLConfig = () => {
  return config.postgresql;
};

export default config;
