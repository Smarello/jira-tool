# Database Layer

Database abstraction layer following Clean Architecture principles with Repository Pattern implementation.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                        │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │           Sprint Persistence Service                    │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Domain Layer                            │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │   Interfaces    │  │  Domain Models  │  │ Value Objects│ │
│  │                 │  │                 │  │              │ │
│  │ IRepository     │  │ SprintEntity    │  │ SprintVelocity│ │
│  │ Interfaces      │  │ SprintMetrics   │  │ SprintMetrics │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                Infrastructure Layer                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │   Repositories  │  │   Connections   │  │   Schemas    │ │
│  │                 │  │                 │  │              │ │
│  │ Concrete Impls  │  │ Database        │  │ Entity       │ │
│  │ (To be added)   │  │ Factories       │  │ Definitions  │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Key Components

### Domain Layer (`domain/`)
- **SprintEntity**: Rich domain entity with business logic
- **SprintVelocity**: Value object for velocity calculations
- **SprintMetrics**: Value object for comprehensive metrics

### Repository Interfaces (`repositories/interfaces.ts`)
- **IClosedSprintsRepository**: Main sprint data persistence
- **IBoardConfigurationRepository**: Board metadata caching
- **ISprintIssuesRepository**: Issues data management

### Services (`services/`)
- **SprintPersistenceService**: Application service coordinating repositories

### Infrastructure (`connection-factory.ts`, `repository-factory.ts`)
- **DatabaseConnectionFactory**: Multi-provider database connections
- **RepositoryFactory**: Dependency injection for repositories

## Database Schema

### Closed Sprints
```typescript
interface ClosedSprintEntity {
  id: string;                    // Sprint ID
  boardId: string;              // Board ID
  name: string;                 // Sprint name
  state: 'closed';              // Always closed for this table
  startDate: string | null;     // Sprint start date
  endDate: string | null;       // Sprint end date
  completeDate: string | null;  // Sprint completion date
  goal: string | null;          // Sprint goal
  originBoardId: string;        // Original board ID
  velocityData: string | null;  // JSON: SprintVelocityData
  issuesData: string | null;    // JSON: JiraIssueWithPoints[]
  metricsData: string | null;   // JSON: SprintMetricsData
  createdAt: string;            // Record creation timestamp
  updatedAt: string;            // Record update timestamp
}
```

### Board Configurations
```typescript
interface BoardConfigurationEntity {
  id: string;                   // Board ID
  name: string;                 // Board name
  type: 'scrum' | 'kanban';     // Board type
  projectKey: string | null;    // Project key
  doneStatusIds: string | null; // JSON: string[] of done status IDs
  storyPointsField: string | null; // Story points field name
  customFields: string | null;  // JSON: additional field mappings
  lastFetched: string | null;   // Last API fetch timestamp
  isActive: boolean;            // Board active status
  createdAt: string;            // Record creation timestamp
  updatedAt: string;            // Record update timestamp
}
```

### Sprint Issues
```typescript
interface SprintIssuesEntity {
  id: string;                   // Composite: sprintId-issueKey
  sprintId: string;             // Sprint ID
  issueKey: string;             // Issue key (e.g., PROJ-123)
  issueId: string;              // Issue ID
  summary: string;              // Issue summary
  status: string;               // Current status
  issueType: string;            // Issue type
  storyPoints: number | null;   // Story points
  assignee: string | null;      // Assignee
  created: string;              // Issue creation date
  updated: string;              // Issue last update
  resolved: string | null;      // Issue resolution date
  customFields: string | null;  // JSON: additional fields
  statusHistory: string | null; // JSON: status change history
  createdAt: string;            // Record creation timestamp
  updatedAt: string;            // Record update timestamp
}
```

## Usage Examples

### Basic Sprint Persistence
```typescript
import { getRepositoryFactory } from './repository-factory';
import { SprintPersistenceService } from './services/sprint-persistence-service';

// Get repositories
const factory = getRepositoryFactory();
const sprintsRepo = factory.createClosedSprintsRepository();
const issuesRepo = factory.createSprintIssuesRepository();
const boardRepo = factory.createBoardConfigurationRepository();

// Create service
const persistenceService = new SprintPersistenceService(
  sprintsRepo,
  issuesRepo,
  boardRepo,
  {
    enableIssuesStorage: true,
    enableMetricsCalculation: true,
    retentionDays: 365,
    batchSize: 10
  }
);

// Persist a closed sprint
const result = await persistenceService.persistClosedSprint(
  closedSprint,
  sprintIssues,
  velocityData
);
```

### Querying Sprint Data
```typescript
// Get recent sprints
const recentSprints = await persistenceService.getRecentClosedSprints('board-123', 5);

// Get sprints with filters
const sprints = await sprintsRepo.getClosedSprints({
  boardId: 'board-123',
  fromDate: '2024-01-01',
  toDate: '2024-12-31',
  includeVelocityData: true,
  includeMetricsData: true,
  limit: 20
});
```

### Batch Operations
```typescript
// Batch persist multiple sprints
const batchResult = await persistenceService.persistClosedSprintsBatch(
  sprintsWithIssues,
  velocityDataMap
);

console.log(`Processed: ${batchResult.totalProcessed}`);
console.log(`Successful: ${batchResult.successful}`);
console.log(`Failed: ${batchResult.failed}`);
```

## Database Provider Support

The layer is designed to support multiple database providers:

- **SQLite** (Turso, local, Cloudflare D1)
- **PostgreSQL** (Supabase, Neon, local)
- **MySQL** (PlanetScale, local)

### Adding a New Database Provider

1. **Install provider dependencies**:
   ```bash
   npm install drizzle-orm @libsql/client  # For Turso
   # or
   npm install drizzle-orm postgres        # For PostgreSQL
   ```

2. **Implement connection factory method**:
   ```typescript
   // In connection-factory.ts
   private static createTursoConnection(config: DatabaseConfig) {
     const client = createClient({
       url: config.connectionString!,
       authToken: config.authToken!,
     });
     return drizzle(client);
   }
   ```

3. **Create concrete repository implementations**:
   ```typescript
   // repositories/drizzle-closed-sprints-repository.ts
   export class DrizzleClosedSprintsRepository implements IClosedSprintsRepository {
     constructor(private readonly db: DatabaseConnection) {}
     // Implement all interface methods...
   }
   ```

4. **Add to repository factory**:
   ```typescript
   // In repository-factory.ts
   export class DrizzleRepositoryFactory extends BaseRepositoryFactory {
     createClosedSprintsRepository(): IClosedSprintsRepository {
       return new DrizzleClosedSprintsRepository(this.dbConnection);
     }
   }
   ```

## Environment Configuration

```env
# Database provider selection
DATABASE_PROVIDER=turso  # turso | postgres | mysql | local-sqlite

# Turso configuration
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-auth-token

# PostgreSQL configuration
POSTGRES_CONNECTION_STRING=postgresql://user:pass@host:5432/db

# MySQL configuration
MYSQL_CONNECTION_STRING=mysql://user:pass@host:3306/db

# Local SQLite
SQLITE_DATABASE_PATH=./data/jira-tool.db
```

## Testing

The repository pattern makes testing straightforward:

```typescript
// Create mock factory for tests
const mockFactory = new MockRepositoryFactory();
setRepositoryFactory(mockFactory);

// Test your application logic without database
```

## Migration Strategy

When switching databases:

1. **Data Export**: Use repository interfaces to export data
2. **Schema Migration**: Apply schema to new database
3. **Data Import**: Use repository interfaces to import data
4. **Configuration Update**: Change database provider in config
5. **Validation**: Verify data integrity

This design ensures your application logic remains unchanged when switching database providers.
