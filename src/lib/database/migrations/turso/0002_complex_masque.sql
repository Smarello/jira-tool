CREATE TABLE `board_metrics` (
	`board_id` text PRIMARY KEY NOT NULL,
	`board_name` text NOT NULL,
	`average_velocity` integer NOT NULL,
	`predictability` integer NOT NULL,
	`trend` text NOT NULL,
	`sprints_analyzed` integer NOT NULL,
	`last_calculated` text NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
DROP INDEX `idx_board_configurations_project_key`;--> statement-breakpoint
DROP INDEX `idx_board_configurations_type`;--> statement-breakpoint
DROP INDEX `idx_board_configurations_is_active`;--> statement-breakpoint
DROP INDEX `idx_closed_sprints_board_id`;--> statement-breakpoint
DROP INDEX `idx_closed_sprints_complete_date`;--> statement-breakpoint
DROP INDEX `idx_closed_sprints_state`;--> statement-breakpoint
DROP INDEX `idx_closed_sprints_origin_board_id`;--> statement-breakpoint
DROP INDEX `idx_closed_sprints_board_date`;--> statement-breakpoint
DROP INDEX `idx_sprint_issues_sprint_id`;--> statement-breakpoint
DROP INDEX `idx_sprint_issues_issue_key`;--> statement-breakpoint
DROP INDEX `idx_sprint_issues_status`;--> statement-breakpoint
DROP INDEX `idx_sprint_issues_issue_type`;--> statement-breakpoint
DROP INDEX `idx_sprint_issues_assignee`;--> statement-breakpoint
DROP INDEX `idx_sprint_issues_resolved`;--> statement-breakpoint
DROP INDEX `idx_sprint_issues_completion_date`;--> statement-breakpoint
DROP INDEX `idx_sprint_issues_sprint_status`;--> statement-breakpoint
DROP INDEX `idx_sprint_issues_sprint_type`;--> statement-breakpoint
DROP INDEX `idx_sprint_issues_sprint_completion`;