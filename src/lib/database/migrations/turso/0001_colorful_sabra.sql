ALTER TABLE `sprint_issues` ADD `completion_date` text;--> statement-breakpoint
CREATE INDEX `idx_sprint_issues_completion_date` ON `sprint_issues` (`completion_date`);--> statement-breakpoint
CREATE INDEX `idx_sprint_issues_sprint_completion` ON `sprint_issues` (`sprint_id`,`completion_date`);