CREATE TABLE `website_layouts` (
	`scenario` text PRIMARY KEY NOT NULL,
	`site_ids` text DEFAULT '[]' NOT NULL,
	`group_ids` text DEFAULT '[]' NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL
);
