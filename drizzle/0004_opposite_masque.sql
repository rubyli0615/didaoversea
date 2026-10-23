ALTER TABLE `resources` ADD `implementation` text;--> statement-breakpoint
ALTER TABLE `resources` ADD `case_url` text;--> statement-breakpoint
ALTER TABLE `resources` ADD `contact` text;--> statement-breakpoint
ALTER TABLE `resources` ADD `installation_mode` text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `resources` ADD `repository_access` text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `resources` ADD `repository_instructions` text;--> statement-breakpoint
ALTER TABLE `resources` ADD `mcp_requirements` text;--> statement-breakpoint
ALTER TABLE `resources` ADD `data_permissions` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `resources` ADD `content_revision` integer DEFAULT 0 NOT NULL;