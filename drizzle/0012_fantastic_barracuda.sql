CREATE TABLE IF NOT EXISTS `monthly_report_costs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`report_id` int NOT NULL,
	`invoice_key` varchar(50) NOT NULL,
	`item_key` varchar(500) NOT NULL,
	`title` varchar(500),
	`quantity` int NOT NULL DEFAULT 0,
	`unit_price` decimal(10,2),
	`subtotal` decimal(12,2),
	`item_type` varchar(20) NOT NULL DEFAULT 'ordered',
	`is_manual` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `monthly_report_costs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `monthly_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`year_month` varchar(7) NOT NULL,
	`label` varchar(200),
	`inventory_summary_json` text,
	`invoice_list_json` text,
	`created_by` varchar(200),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `monthly_reports_id` PRIMARY KEY(`id`)
);
