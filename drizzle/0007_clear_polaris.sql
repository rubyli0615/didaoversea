CREATE TABLE `app_state` (
	`key` text PRIMARY KEY NOT NULL,
	`version` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `website_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`scenario` text NOT NULL,
	`name` text NOT NULL,
	`name_key` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `website_categories_scenario_name_unique` ON `website_categories` (`scenario`,`name_key`);--> statement-breakpoint
ALTER TABLE `resources` ADD `reference_url` text;--> statement-breakpoint
ALTER TABLE `resources` ADD `common_qa` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `resources` ADD `website_category_id` text REFERENCES website_categories(id);