/**
 * Database layer main exports
 * Following Clean Code: Single point of entry, clear exports
 */

// Main integration service
export {
  DatabaseIntegrationService,
  getDatabaseService,
  initializeDatabaseService,
  resetDatabaseService
} from './integration-example';

// Repository interfaces (for advanced usage)
export type { 
  IClosedSprintsRepository, 
  IBoardConfigurationRepository,
  SprintVelocityData,
  SprintMetricsData,
  PersistedSprint,
  CreateSprintData,
  SprintQueryFilters,
  SprintStatistics
} from './repositories/interfaces';

export type { 
  ISprintIssuesRepository,
  SprintIssueQueryFilters,
  SprintIssueStatistics
} from './repositories/sprint-issues-repository';

// Domain models (for type safety)
export { 
  SprintEntity, 
  SprintVelocity, 
  SprintMetrics,
  SprintState,
  IssueType,
  StatusCategory
} from './domain/sprint-domain';

// Configuration types
export type { 
  SprintPersistenceConfig,
  SprintPersistenceResult,
  BatchPersistenceResult
} from './services/sprint-persistence-service';

// Database configuration (for advanced setup)
export type { 
  DatabaseConfig,
  DatabaseConnection
} from './connection-factory';

export { 
  DatabaseConnectionFactory,
  DatabaseConfigFactory
} from './connection-factory';

// Repository factory (for dependency injection)
export {
  getRepositoryFactory,
  initializeRepositoryFactory,
  setRepositoryFactory,
  resetRepositoryFactory,
  createRepositoryFactory
} from './repository-factory';

export type { IRepositoryFactory } from './repository-factory';

// Turso-specific exports
export { TursoRepositoryFactory } from './factories/turso-repository-factory';
export {
  createTursoConnection,
  createTursoConfigFromEnv,
  validateTursoConfig,
  getTursoDatabaseInfo,
  performTursoHealthCheck
} from './utils/turso-connection';
