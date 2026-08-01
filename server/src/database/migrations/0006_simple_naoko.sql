CREATE TABLE `label_events` (
	`seq` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`src` text NOT NULL,
	`uri` text NOT NULL,
	`val` text NOT NULL,
	`neg` integer DEFAULT false NOT NULL,
	`cts` text NOT NULL,
	`cid` text,
	`exp` text,
	`sig` blob NOT NULL
);
--> statement-breakpoint
INSERT INTO `label_events` (`seq`, `src`, `uri`, `val`, `neg`, `cts`, `cid`, `exp`, `sig`)
SELECT `id`, `src`, `uri`, `val`, `neg`, `cts`, `cid`, `exp`, `sig`
FROM `labels`
ORDER BY `id`;
