-- Add average sprint completion rate column to board_metrics table
-- Following Clean Code: Clear schema evolution, proper naming convention

-- Add average sprint completion rate column
ALTER TABLE board_metrics ADD COLUMN average_sprint_completion_rate INTEGER DEFAULT 0;

-- Update existing records with default value (will be recalculated on next analysis)
UPDATE board_metrics SET average_sprint_completion_rate = 0 WHERE average_sprint_completion_rate IS NULL; 