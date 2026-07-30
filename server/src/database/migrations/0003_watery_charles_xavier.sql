CREATE TABLE `admin_session` (
	`id` integer PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	CONSTRAINT "admin_session_single_row_check" CHECK("admin_session"."id" = 1)
);
