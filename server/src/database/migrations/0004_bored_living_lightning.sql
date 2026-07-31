CREATE TABLE `failed_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`cursor_us` integer,
	`did` text,
	`collection` text,
	`rkey` text,
	`reason` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `failed_events_created_at_idx` ON `failed_events` (`created_at`);