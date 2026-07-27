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
CREATE TABLE `labels` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`src` text NOT NULL,
	`uri` text NOT NULL,
	`val` text NOT NULL,
	`neg` integer DEFAULT false NOT NULL,
	`cts` text NOT NULL,
	`cid` text,
	`exp` text,
	`sig` blob NOT NULL,
	`domain` text NOT NULL,
	`author_did` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `labels_uri_unique` ON `labels` (`uri`);--> statement-breakpoint
CREATE INDEX `labels_cts_idx` ON `labels` (`cts`);--> statement-breakpoint
CREATE INDEX `labels_domain_idx` ON `labels` (`domain`);