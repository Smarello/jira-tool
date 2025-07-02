/**
 * Repository factory for dependency injection
 * Following Clean Architecture: Dependency injection, factory pattern
 * Following Clean Code: Single responsibility, interface segregation
 */

import type { IClosedSprintsRepository, IBoardConfigurationRepository, IBoardMetricsRepository, BoardMetrics } from './repositories/interfaces';
import type { ISprintIssuesRepository } from './repositories/sprint-issues-repository';
import type { DatabaseConnection } from './connection-factory';
import { DatabaseConnectionFactory, DatabaseConfigFactory } from './connection-factory';

// Note: Other concrete repository implementations will be imported when implemented
// import { PostgresRepositoryFactory } from './factories/postgres-repository-factory';
// import { MySQLRepositoryFactory } from './factories/mysql-repository-factory';

/**
 * Repository factory interface
 * Following Clean Architecture: Abstract factory in domain layer
 */
export interface IRepositoryFactory {
  createClosedSprintsRepository(): IClosedSprintsRepository;
  createBoardConfigurationRepository(): IBoardConfigurationRepository;
  createBoardMetricsRepository(): IBoardMetricsRepository;
  createSprintIssuesRepository(): ISprintIssuesRepository;
}

/**
 * Abstract repository factory base class
 * Following Clean Architecture: Abstract factory in infrastructure layer
 */
export abstract class BaseRepositoryFactory implements IRepositoryFactory {
  protected readonly dbConnection: DatabaseConnection;

  constructor(dbConnection?: DatabaseConnection) {
    if (dbConnection) {
      this.dbConnection = dbConnection;
    } else {
      throw new Error('Database connection must be provided to BaseRepositoryFactory');
    }
  }

  abstract createClosedSprintsRepository(): IClosedSprintsRepository;
  abstract createBoardConfigurationRepository(): IBoardConfigurationRepository;
  abstract createBoardMetricsRepository(): IBoardMetricsRepository;
  abstract createSprintIssuesRepository(): ISprintIssuesRepository;
}

/**
 * Mock repository factory for development/testing
 * Following Clean Architecture: Test doubles in infrastructure layer
 */
export class MockRepositoryFactory implements IRepositoryFactory {
  createClosedSprintsRepository(): IClosedSprintsRepository {
    throw new Error('Mock repository not implemented yet - will be added when needed');
  }

  createBoardConfigurationRepository(): IBoardConfigurationRepository {
    throw new Error('Mock repository not implemented yet - will be added when needed');
  }

  createBoardMetricsRepository(): IBoardMetricsRepository {
    return new MockBoardMetricsRepository();
  }

  createSprintIssuesRepository(): ISprintIssuesRepository {
    throw new Error('Mock repository not implemented yet - will be added when needed');
  }
}

/**
 * Singleton repository factory instance
 * Following Clean Code: Singleton pattern for shared resources
 */
let repositoryFactoryInstance: IRepositoryFactory | null = null;

/**
 * Gets repository factory instance
 * Following Clean Code: Singleton access, lazy initialization
 */
export function getRepositoryFactory(): IRepositoryFactory {
  if (!repositoryFactoryInstance) {
    // For synchronous access, default to mock
    repositoryFactoryInstance = new MockRepositoryFactory();
  }
  return repositoryFactoryInstance;
}

/**
 * Initializes repository factory with database connection
 * Following Clean Code: Async initialization, dependency injection
 */
export async function initializeRepositoryFactory(): Promise<IRepositoryFactory> {
  // In Astro API endpoints, use import.meta.env instead of process.env
  const provider = import.meta.env?.DATABASE_PROVIDER || process.env.DATABASE_PROVIDER || 'mock';

  if (provider === 'mock') {
    repositoryFactoryInstance = new MockRepositoryFactory();
  } else {
    const config = DatabaseConfigFactory.fromEnvironment();
    const dbConnection = await DatabaseConnectionFactory.createConnection(config);
    repositoryFactoryInstance = await createRepositoryFactory(provider, dbConnection);
  }

  return repositoryFactoryInstance;
}

/**
 * Sets repository factory instance (for testing and configuration)
 * Following Clean Code: Dependency injection for testing
 */
export function setRepositoryFactory(factory: IRepositoryFactory): void {
  repositoryFactoryInstance = factory;
}

/**
 * Resets repository factory (for testing)
 * Following Clean Code: Test isolation
 */
export function resetRepositoryFactory(): void {
  repositoryFactoryInstance = null;
}

/**
 * Creates repository factory for specific database provider
 * Following Clean Code: Factory method for different providers
 */
export async function createRepositoryFactory(provider: string, dbConnection?: DatabaseConnection): Promise<IRepositoryFactory> {
  switch (provider.toLowerCase()) {
    case 'mock':
      return new MockRepositoryFactory();

    case 'turso':
    case 'local-sqlite': {
      const { TursoRepositoryFactory } = await import('./factories/turso-repository-factory');
      return new TursoRepositoryFactory(dbConnection);
    }

    // Will add other concrete factories when implemented
    // case 'postgres': {
    //   const { PostgresRepositoryFactory } = await import('./factories/postgres-repository-factory');
    //   return new PostgresRepositoryFactory(dbConnection);
    // }
    // case 'mysql': {
    //   const { MySQLRepositoryFactory } = await import('./factories/mysql-repository-factory');
    //   return new MySQLRepositoryFactory(dbConnection);
    // }

    default:
      throw new Error(`Unsupported repository provider: ${provider}`);
  }
}

/**
 * Mock implementation of board metrics repository for development/testing
 * Following Clean Architecture: Test doubles in infrastructure layer
 */
class MockBoardMetricsRepository implements IBoardMetricsRepository {
  private metrics: Map<string, BoardMetrics> = new Map();

  async saveBoardMetrics(metrics: BoardMetrics): Promise<void> {
    this.metrics.set(metrics.boardId, metrics);
  }

  async getBoardMetrics(boardId: string): Promise<BoardMetrics | null> {
    return this.metrics.get(boardId) || null;
  }

  async deleteBoardMetrics(boardId: string): Promise<void> {
    this.metrics.delete(boardId);
  }

  async listAllBoardMetrics(): Promise<readonly BoardMetrics[]> {
    return Array.from(this.metrics.values());
  }

  async getAllBoardMetrics(): Promise<BoardMetrics[]> {
    return Array.from(this.metrics.values());
  }
}
