-- Initial database schema for JIRA Tool
-- Following Clean Code: Clear schema definition, proper indexing

-- Closed sprints table
CREATE TABLE IF NOT EXISTS closed_sprints (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL,
  name TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state = 'closed'),
  start_date TEXT,
  end_date TEXT,
  complete_date TEXT,
  goal TEXT,
  origin_board_id TEXT NOT NULL,
  
  -- JSON data columns
  velocity_data TEXT, -- JSON: SprintVelocityData
  issues_data TEXT,   -- JSON: JiraIssueWithPoints[]
  metrics_data TEXT,  -- JSON: SprintMetricsData
  
  -- Audit fields
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Board configurations table
CREATE TABLE IF NOT EXISTS board_configurations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('scrum', 'kanban')),
  project_key TEXT,
  
  -- Configuration data as JSON
  done_status_ids TEXT,    -- JSON: string[]
  story_points_field TEXT, -- Story points field name
  custom_fields TEXT,      -- JSON: additional field mappings
  
  -- Cache metadata
  last_fetched TEXT,
  is_active BOOLEAN NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Sprint issues table (detailed issues data)
CREATE TABLE IF NOT EXISTS sprint_issues (
  id TEXT PRIMARY KEY, -- Composite: sprintId-issueKey
  sprint_id TEXT NOT NULL,
  issue_key TEXT NOT NULL,
  issue_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  status TEXT NOT NULL,
  issue_type TEXT NOT NULL,
  story_points INTEGER,
  assignee TEXT,
  
  -- Timestamps
  created TEXT NOT NULL,
  updated TEXT NOT NULL,
  resolved TEXT,
  
  -- Additional data as JSON
  custom_fields TEXT,   -- JSON: additional fields
  status_history TEXT,  -- JSON: status change history
  
  -- Audit fields
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  
  -- Foreign key constraint
  FOREIGN KEY (sprint_id) REFERENCES closed_sprints(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_closed_sprints_board_id ON closed_sprints(board_id);
CREATE INDEX IF NOT EXISTS idx_closed_sprints_complete_date ON closed_sprints(complete_date);
CREATE INDEX IF NOT EXISTS idx_closed_sprints_state ON closed_sprints(state);
CREATE INDEX IF NOT EXISTS idx_closed_sprints_origin_board_id ON closed_sprints(origin_board_id);

CREATE INDEX IF NOT EXISTS idx_board_configurations_project_key ON board_configurations(project_key);
CREATE INDEX IF NOT EXISTS idx_board_configurations_type ON board_configurations(type);
CREATE INDEX IF NOT EXISTS idx_board_configurations_is_active ON board_configurations(is_active);

CREATE INDEX IF NOT EXISTS idx_sprint_issues_sprint_id ON sprint_issues(sprint_id);
CREATE INDEX IF NOT EXISTS idx_sprint_issues_issue_key ON sprint_issues(issue_key);
CREATE INDEX IF NOT EXISTS idx_sprint_issues_status ON sprint_issues(status);
CREATE INDEX IF NOT EXISTS idx_sprint_issues_issue_type ON sprint_issues(issue_type);
CREATE INDEX IF NOT EXISTS idx_sprint_issues_assignee ON sprint_issues(assignee);
CREATE INDEX IF NOT EXISTS idx_sprint_issues_resolved ON sprint_issues(resolved);

-- Triggers for updated_at timestamps
CREATE TRIGGER IF NOT EXISTS update_closed_sprints_updated_at
  AFTER UPDATE ON closed_sprints
  FOR EACH ROW
  BEGIN
    UPDATE closed_sprints SET updated_at = datetime('now') WHERE id = NEW.id;
  END;

CREATE TRIGGER IF NOT EXISTS update_board_configurations_updated_at
  AFTER UPDATE ON board_configurations
  FOR EACH ROW
  BEGIN
    UPDATE board_configurations SET updated_at = datetime('now') WHERE id = NEW.id;
  END;

CREATE TRIGGER IF NOT EXISTS update_sprint_issues_updated_at
  AFTER UPDATE ON sprint_issues
  FOR EACH ROW
  BEGIN
    UPDATE sprint_issues SET updated_at = datetime('now') WHERE id = NEW.id;
  END;
