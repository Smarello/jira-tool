/**
 * Database connection factory with multiple provider support
 * Following Clean Architecture: Infrastructure layer, dependency injection
 * Following Clean Code: Factory pattern, single responsibility
 */

import { drizzle as drizzleTurso } from 'drizzle-orm/libsql';
import { createTursoConnection, validateTursoConfig } from './utils/turso-connection';

// Note: Other database imports will be added when implementing other providers
// import { drizzle as drizzleD1 } from 'drizzle-orm/d1';
// import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';

/**
 * Database configuration interface
 * Following Clean Code: Express intent, configuration object
 */
export interface DatabaseConfig {
  readonly provider: 'turso' | 'cloudflare-d1' | 'local-sqlite' | 'postgres' | 'mysql';
  readonly connectionString?: string;
  readonly authToken?: string;
  readonly databasePath?: string;
  readonly host?: string;
  readonly port?: number;
  readonly database?: string;
  readonly username?: string;
  readonly password?: string;
  readonly ssl?: boolean;
}

/**
 * Database connection type
 * Following Clean Code: Express intent, type abstraction
 */
export type DatabaseConnection = ReturnType<typeof drizzleTurso>;

/**
 * Database connection factory
 * Following Clean Architecture: Abstract factory for infrastructure
 */
export class DatabaseConnectionFactory {
  /**
   * Creates database connection based on configuration
   * Following Clean Code: Factory method, dependency injection
   */
  static async createConnection(config: DatabaseConfig): Promise<DatabaseConnection> {
    switch (config.provider) {
      case 'turso':
        return await this.createTursoConnection(config);

      case 'cloudflare-d1':
        return this.createCloudflareD1Connection(config);

      case 'local-sqlite':
        return await this.createLocalSQLiteConnection(config);

      case 'postgres':
        return this.createPostgresConnection(config);

      case 'mysql':
        return this.createMySQLConnection(config);

      default:
        throw new Error(`Unsupported database provider: ${config.provider}`);
    }
  }

  /**
   * Creates Turso connection
   * Following Clean Code: Single responsibility, error handling
   */
  private static async createTursoConnection(config: DatabaseConfig): Promise<DatabaseConnection> {
    if (!config.connectionString || !config.authToken) {
      throw new Error('Turso requires connectionString and authToken');
    }

    try {
      const tursoConfig = {
        url: config.connectionString,
        authToken: config.authToken,
      };

      // Validate configuration
      validateTursoConfig(tursoConfig);

      // Create connection with retry logic
      return await createTursoConnection(tursoConfig);
    } catch (error) {
      throw new Error(`Failed to create Turso connection: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Creates Cloudflare D1 connection
   * Following Clean Code: Single responsibility
   */
  private static createCloudflareD1Connection(_config: DatabaseConfig): DatabaseConnection {
    // Implementation will be added when concrete database is chosen
    throw new Error('Cloudflare D1 connection not implemented yet - will be added when database is selected');
  }

  /**
   * Creates local SQLite connection for development
   * Following Clean Code: Single responsibility, development support
   */
  private static async createLocalSQLiteConnection(config: DatabaseConfig): Promise<DatabaseConnection> {
    if (!config.databasePath) {
      throw new Error('Local SQLite requires databasePath');
    }

    try {
      const tursoConfig = {
        url: `file:${config.databasePath}`,
        authToken: '', // Not needed for local files
      };

      return await createTursoConnection(tursoConfig);
    } catch (error) {
      throw new Error(`Failed to create local SQLite connection: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Creates PostgreSQL connection
   * Following Clean Code: Single responsibility
   */
  private static createPostgresConnection(config: DatabaseConfig): DatabaseConnection {
    if (!config.connectionString && (!config.host || !config.database)) {
      throw new Error('PostgreSQL requires connectionString or host/database configuration');
    }

    // Implementation will be added when concrete database is chosen
    throw new Error('PostgreSQL connection not implemented yet - will be added when database is selected');
  }

  /**
   * Creates MySQL connection
   * Following Clean Code: Single responsibility
   */
  private static createMySQLConnection(config: DatabaseConfig): DatabaseConnection {
    if (!config.connectionString && (!config.host || !config.database)) {
      throw new Error('MySQL requires connectionString or host/database configuration');
    }

    // Implementation will be added when concrete database is chosen
    throw new Error('MySQL connection not implemented yet - will be added when database is selected');
  }
}

/**
 * Environment-based configuration factory
 * Following Clean Code: Environment abstraction, configuration management
 */
export class DatabaseConfigFactory {
  /**
   * Creates configuration from environment variables
   * Following Clean Code: Environment variable abstraction
   */
  static fromEnvironment(): DatabaseConfig {
    // In Astro API endpoints, use import.meta.env instead of process.env
    const provider = (import.meta.env?.DATABASE_PROVIDER || process.env.DATABASE_PROVIDER) as DatabaseConfig['provider'] || 'turso';

    switch (provider) {
      case 'turso':
        return {
          provider: 'turso',
          connectionString: import.meta.env?.TURSO_DATABASE_URL || process.env.TURSO_DATABASE_URL,
          authToken: import.meta.env?.TURSO_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN,
        };
      
      case 'cloudflare-d1':
        return {
          provider: 'cloudflare-d1',
        };
      
      case 'local-sqlite':
        return {
          provider: 'local-sqlite',
          databasePath: import.meta.env?.SQLITE_DATABASE_PATH || process.env.SQLITE_DATABASE_PATH || './dev.db',
        };
      
      default:
        throw new Error(`Invalid DATABASE_PROVIDER: ${provider}`);
    }
  }

  /**
   * Creates development configuration
   * Following Clean Code: Development environment support
   */
  static forDevelopment(): DatabaseConfig {
    return {
      provider: 'local-sqlite',
      databasePath: './dev.db',
    };
  }

  /**
   * Creates test configuration
   * Following Clean Code: Test environment support
   */
  static forTesting(): DatabaseConfig {
    return {
      provider: 'local-sqlite',
      databasePath: ':memory:',
    };
  }
}
