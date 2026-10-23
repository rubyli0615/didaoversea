CREATE TABLE `resource_reads` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`resource_id` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`read_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`resource_id`) REFERENCES `resources`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `resource_reads_user_resource_unique` ON `resource_reads` (`user_id`,`resource_id`);--> statement-breakpoint
ALTER TABLE `resources` ADD `notification_revision` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `resources` ADD `notification_kind` text DEFAULT 'updated' NOT NULL;--> statement-breakpoint
ALTER TABLE `resources` ADD `notification_at` integer;