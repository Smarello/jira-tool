/**
 * Turso repository factory implementation
 * Following Clean Architecture: Concrete factory in infrastructure layer
 * Following Clean Code: Factory pattern, dependency injection
 */

import type { DatabaseConnection } from '../connection-factory';
import type { IRepositoryFactory } from '../repository-factory';
import type {
  IClosedSprintsRepository,
  IBoardConfigurationRepository
} from '../repositories/interfaces';
import type { ISprintIssuesRepository } from '../repositories/sprint-issues-repository';
import { TursoClosedSprintsRepository } from '../repositories/turso-closed-sprints-repository';
import { TursoBoardConfigurationRepository } from '../repositories/turso-board-configuration-repository';
import { TursoSprintIssuesRepository } from '../repositories/turso-sprint-issues-repository';

/**
 * Turso-specific repository factory
 * Following Clean Architecture: Concrete factory implementation
 */
export class TursoRepositoryFactory implements IRepositoryFactory {
  private readonly dbConnection: DatabaseConnection;

  constructor(dbConnection?: DatabaseConnection) {
    if (!dbConnection) {
      throw new Error('Database connection is required for TursoRepositoryFactory');
    }
    this.dbConnection = dbConnection;
  }

  /**
   * Creates Turso-based closed sprints repository
   * Following Clean Code: Factory method, dependency injection
   */
  createClosedSprintsRepository(): IClosedSprintsRepository {
    return new TursoClosedSprintsRepository(this.dbConnection);
  }

  /**
   * Creates Turso-based board configuration repository
   * Following Clean Code: Factory method, dependency injection
   */
  createBoardConfigurationRepository(): IBoardConfigurationRepository {
    return new TursoBoardConfigurationRepository(this.dbConnection);
  }

  /**
   * Creates Turso-based sprint issues repository
   * Following Clean Code: Factory method, dependency injection
   */
  createSprintIssuesRepository(): ISprintIssuesRepository {
    return new TursoSprintIssuesRepository(this.dbConnection);
  }
}
