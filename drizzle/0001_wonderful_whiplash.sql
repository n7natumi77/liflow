CREATE TABLE `core_entities` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`payload` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`updated_by` text NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_core_entities_user_type` ON `core_entities` (`user_id`,`type`);--> statement-breakpoint
CREATE INDEX `idx_core_entities_user_deleted` ON `core_entities` (`user_id`,`deleted_at`);