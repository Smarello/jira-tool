-- Add board metrics table for storing calculated velocity metrics
-- Following Clean Code: Clear schema definition, proper indexing

-- Board metrics table
CREATE TABLE IF NOT EXISTS board_metrics (
  board_id TEXT PRIMARY KEY,
  board_name TEXT NOT NULL,
  
  -- Calculated velocity metrics
  average_velocity INTEGER NOT NULL,
  predictability INTEGER NOT NULL,
  trend TEXT NOT NULL CHECK (trend IN ('up', 'down', 'stable', 'no-data')),
  sprints_analyzed INTEGER NOT NULL,
  
  -- Audit fields
  last_calculated TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Index for performance optimization
CREATE INDEX IF NOT EXISTS idx_board_metrics_last_calculated ON board_metrics(last_calculated);
