CREATE TABLE `cursor` (
	`id` integer PRIMARY KEY NOT NULL,
	`cursor_us` integer NOT NULL,
	`posts_scanned` integer DEFAULT 0 NOT NULL,
	CONSTRAINT "cursor_single_row_check" CHECK("cursor"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE `domains` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`pattern` text NOT NULL,
	`added_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `domains_pattern_unique` ON `domains` (`pattern`);--> statement-breakpoint
CREATE TABLE `labels_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`post_uri` text NOT NULL,
	`author_did` text NOT NULL,
	`domain` text NOT NULL,
	`labeled_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `labels_log_post_uri_unique` ON `labels_log` (`post_uri`);--> statement-breakpoint
CREATE INDEX `labels_log_labeled_at_idx` ON `labels_log` (`labeled_at`);--> statement-breakpoint
CREATE INDEX `labels_log_domain_idx` ON `labels_log` (`domain`);
