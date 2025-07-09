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
CREATE TABLE `board_metrics` (
	`board_id` text PRIMARY KEY NOT NULL,
	`board_name` text NOT NULL,
	`average_velocity` integer NOT NULL,
	`predictability` integer NOT NULL,
	`trend` text NOT NULL,
	`sprints_analyzed` integer NOT NULL,
	`average_sprint_completion_rate` integer DEFAULT 0 NOT NULL,
	`last_calculated` text NOT NULL,
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
CREATE TABLE `kanban_board_configs` (
	`board_id` text PRIMARY KEY NOT NULL,
	`board_name` text NOT NULL,
	`project_key` text NOT NULL,
	`column_mappings` text NOT NULL,
	`done_columns` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `kanban_issues` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`summary` text NOT NULL,
	`issue_type` text NOT NULL,
	`status` text NOT NULL,
	`assignee` text,
	`board_id` text NOT NULL,
	`board_name` text NOT NULL,
	`board_entry_date` text,
	`last_done_date` text,
	`cycle_time_days` integer,
	`created` text NOT NULL,
	`resolved` text,
	`is_reopened` integer DEFAULT false NOT NULL,
	`exclude_from_metrics` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `kanban_issues_key_unique` ON `kanban_issues` (`key`);--> statement-breakpoint
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
	`completion_date` text,
	`custom_fields` text,
	`status_history` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
