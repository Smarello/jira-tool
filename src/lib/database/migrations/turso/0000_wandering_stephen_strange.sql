CREATE TABLE `board_configurations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`project_key` text,
	`done_status_ids` text,
	`story_points_field` text,
	`custom_fields` text,
	`last_fetched` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `closed_sprints` (
	`id` text PRIMARY KEY NOT NULL,
	`board_id` text NOT NULL,
	`name` text NOT NULL,
	`state` text NOT NULL,
	`start_date` text,
	`end_date` text,
	`complete_date` text,
	`goal` text,
	`origin_board_id` text NOT NULL,
	`velocity_data` text,
	`issues_data` text,
	`metrics_data` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sprint_issues` (
	`id` text PRIMARY KEY NOT NULL,
	`sprint_id` text NOT NULL,
	`issue_key` text NOT NULL,
	`issue_id` text NOT NULL,
	`summary` text NOT NULL,
	`status` text NOT NULL,
	`issue_type` text NOT NULL,
	`story_points` integer,
	`assignee` text,
	`created` text NOT NULL,
	`updated` text NOT NULL,
	`resolved` text,
	`custom_fields` text,
	`status_history` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_board_configurations_project_key` ON `board_configurations` (`project_key`);--> statement-breakpoint
CREATE INDEX `idx_board_configurations_type` ON `board_configurations` (`type`);--> statement-breakpoint
CREATE INDEX `idx_board_configurations_is_active` ON `board_configurations` (`is_active`);--> statement-breakpoint
CREATE INDEX `idx_closed_sprints_board_id` ON `closed_sprints` (`board_id`);--> statement-breakpoint
CREATE INDEX `idx_closed_sprints_complete_date` ON `closed_sprints` (`complete_date`);--> statement-breakpoint
CREATE INDEX `idx_closed_sprints_state` ON `closed_sprints` (`state`);--> statement-breakpoint
CREATE INDEX `idx_closed_sprints_origin_board_id` ON `closed_sprints` (`origin_board_id`);--> statement-breakpoint
CREATE INDEX `idx_closed_sprints_board_date` ON `closed_sprints` (`board_id`,`complete_date`);--> statement-breakpoint
CREATE INDEX `idx_sprint_issues_sprint_id` ON `sprint_issues` (`sprint_id`);--> statement-breakpoint
CREATE INDEX `idx_sprint_issues_issue_key` ON `sprint_issues` (`issue_key`);--> statement-breakpoint
CREATE INDEX `idx_sprint_issues_status` ON `sprint_issues` (`status`);--> statement-breakpoint
CREATE INDEX `idx_sprint_issues_issue_type` ON `sprint_issues` (`issue_type`);--> statement-breakpoint
CREATE INDEX `idx_sprint_issues_assignee` ON `sprint_issues` (`assignee`);--> statement-breakpoint
CREATE INDEX `idx_sprint_issues_resolved` ON `sprint_issues` (`resolved`);--> statement-breakpoint
CREATE INDEX `idx_sprint_issues_sprint_status` ON `sprint_issues` (`sprint_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_sprint_issues_sprint_type` ON `sprint_issues` (`sprint_id`,`issue_type`);