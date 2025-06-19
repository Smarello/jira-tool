/**
 * Drizzle Kit configuration for database migrations
 * Following Clean Code: Configuration management, environment-based setup
 */

import { defineConfig } from 'drizzle-kit';
import { config } from 'dotenv';

// Load environment variables
config();

/**
 * Gets database configuration based on provider
 * Following Clean Code: Environment abstraction, configuration factory
 */
function getDatabaseConfig() {
  const provider = process.env.DATABASE_PROVIDER || 'mock';

  switch (provider) {
    case 'turso':
      if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
        throw new Error('Missing required Turso environment variables: TURSO_DATABASE_URL and TURSO_AUTH_TOKEN');
      }
      return {
        schema: './src/lib/database/schemas/turso-schema.ts',
        out: './src/lib/database/migrations/turso',
        dialect: 'turso',
        dbCredentials: {
          url: process.env.TURSO_DATABASE_URL,
          authToken: process.env.TURSO_AUTH_TOKEN,
        },
        verbose: true,
        strict: true,
      };

    case 'postgres':
      if (!process.env.POSTGRES_CONNECTION_STRING) {
        throw new Error('Missing required PostgreSQL environment variable: POSTGRES_CONNECTION_STRING');
      }
      return {
        schema: './src/lib/database/schemas/postgres-schema.ts', // Future implementation
        out: './src/lib/database/migrations/postgres',
        dialect: 'postgresql',
        dbCredentials: {
          connectionString: process.env.POSTGRES_CONNECTION_STRING,
        },
        verbose: true,
        strict: true,
      };

    case 'mysql':
      if (!process.env.MYSQL_CONNECTION_STRING) {
        throw new Error('Missing required MySQL environment variable: MYSQL_CONNECTION_STRING');
      }
      return {
        schema: './src/lib/database/schemas/mysql-schema.ts', // Future implementation
        out: './src/lib/database/migrations/mysql',
        dialect: 'mysql',
        dbCredentials: {
          connectionString: process.env.MYSQL_CONNECTION_STRING,
        },
        verbose: true,
        strict: true,
      };

    case 'local-sqlite':
      return {
        schema: './src/lib/database/schemas/turso-schema.ts', // Same as Turso (SQLite)
        out: './src/lib/database/migrations/sqlite',
        dialect: 'sqlite',
        dbCredentials: {
          url: process.env.SQLITE_DATABASE_PATH || './data/jira-tool.db',
        },
        verbose: true,
        strict: true,
      };

    default:
      throw new Error(`Unsupported database provider: ${provider}. Please set DATABASE_PROVIDER environment variable.`);
  }
}

export default defineConfig(getDatabaseConfig());
