CREATE TABLE `jetstream_cursors` (
	`source` text PRIMARY KEY NOT NULL,
	`cursor_us` integer NOT NULL,
	`posts_scanned` integer DEFAULT 0 NOT NULL
);
