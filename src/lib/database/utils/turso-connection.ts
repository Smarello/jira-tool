/**
 * Turso connection utilities
 * Following Clean Code: Utility functions, connection management
 */

import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { sql } from 'drizzle-orm';
import { tursoSchema } from '../schemas/turso-schema';
import type { DatabaseConnection } from '../connection-factory';

/**
 * Turso connection configuration
 * Following Clean Code: Configuration object pattern
 */
export interface TursoConnectionConfig {
  readonly url: string;
  readonly authToken: string;
  readonly syncUrl?: string;
  readonly syncInterval?: number;
  readonly encryptionKey?: string;
}

/**
 * Creates a Turso database connection with retry logic
 * Following Clean Code: Error handling, retry mechanism
 */
export async function createTursoConnection(config: TursoConnectionConfig): Promise<DatabaseConnection> {
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const client = createClient({
        url: config.url,
        authToken: config.authToken,
        syncUrl: config.syncUrl,
        syncInterval: config.syncInterval,
        encryptionKey: config.encryptionKey,
      });

      // Create Drizzle instance
      const db = drizzle(client, { schema: tursoSchema });

      // Test the connection
      await testConnection(db);
      
      console.log(`✅ Turso connection established (attempt ${attempt})`);
      return db;

    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown connection error');
      console.warn(`⚠️  Turso connection attempt ${attempt} failed:`, lastError.message);
      
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
        console.log(`🔄 Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error(`Failed to connect to Turso after ${maxRetries} attempts. Last error: ${lastError?.message}`);
}

/**
 * Tests database connection
 * Following Clean Code: Single responsibility, connection validation
 */
async function testConnection(db: DatabaseConnection): Promise<void> {
  try {
    // Simple query to test connection using Drizzle ORM
    await db.run(sql`SELECT 1`);
  } catch (error) {
    throw new Error(`Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Creates Turso configuration from environment variables
 * Following Clean Code: Environment abstraction
 */
export function createTursoConfigFromEnv(): TursoConnectionConfig {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url || !authToken) {
    throw new Error('Missing required Turso environment variables: TURSO_DATABASE_URL and TURSO_AUTH_TOKEN');
  }

  return {
    url,
    authToken,
    syncUrl: process.env.TURSO_SYNC_URL,
    syncInterval: process.env.TURSO_SYNC_INTERVAL ? parseInt(process.env.TURSO_SYNC_INTERVAL) : undefined,
    encryptionKey: process.env.TURSO_ENCRYPTION_KEY,
  };
}

/**
 * Validates Turso configuration
 * Following Clean Code: Input validation, early return
 */
export function validateTursoConfig(config: TursoConnectionConfig): void {
  if (!config.url) {
    throw new Error('Turso URL is required');
  }

  if (!config.authToken) {
    throw new Error('Turso auth token is required');
  }

  if (!config.url.startsWith('libsql://') && !config.url.startsWith('file:')) {
    throw new Error('Invalid Turso URL format. Must start with libsql:// or file:');
  }

  if (config.syncInterval && (config.syncInterval < 1000 || config.syncInterval > 3600000)) {
    throw new Error('Sync interval must be between 1000ms and 3600000ms (1 hour)');
  }
}

/**
 * Gets Turso database info
 * Following Clean Code: Information retrieval, debugging support
 */
export async function getTursoDatabaseInfo(db: DatabaseConnection): Promise<{
  version: string;
  tableCount: number;
  indexCount: number;
}> {
  try {
    // Get SQLite version using Drizzle ORM
    const versionResult = await db.run(sql`SELECT sqlite_version() as version`);
    const version = versionResult.rows[0]?.version as string || 'unknown';

    // Get table count using Drizzle ORM
    const tablesResult = await db.run(sql`
      SELECT COUNT(*) as count
      FROM sqlite_master
      WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
    `);
    const tableCount = tablesResult.rows[0]?.count as number || 0;

    // Get index count using Drizzle ORM
    const indexesResult = await db.run(sql`
      SELECT COUNT(*) as count
      FROM sqlite_master
      WHERE type = 'index' AND name NOT LIKE 'sqlite_%'
    `);
    const indexCount = indexesResult.rows[0]?.count as number || 0;

    return {
      version,
      tableCount,
      indexCount
    };
  } catch (error) {
    throw new Error(`Failed to get database info: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Performs database health check
 * Following Clean Code: Health monitoring, system diagnostics
 */
export async function performTursoHealthCheck(db: DatabaseConnection): Promise<{
  healthy: boolean;
  latency: number;
  error?: string;
}> {
  const startTime = Date.now();
  
  try {
    // Simple query to test responsiveness using Drizzle ORM
    await db.run(sql`SELECT 1`);
    
    const latency = Date.now() - startTime;
    
    return {
      healthy: true,
      latency
    };
  } catch (error) {
    const latency = Date.now() - startTime;
    
    return {
      healthy: false,
      latency,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
