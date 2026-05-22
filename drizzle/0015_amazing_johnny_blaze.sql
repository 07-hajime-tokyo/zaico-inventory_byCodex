CREATE TABLE IF NOT EXISTS `domestic_products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(500) NOT NULL,
	`unit_price` decimal(10,2),
	`supplier_name` varchar(200),
	`note` text,
	`sort_order` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `domestic_products_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `monthly_domestic_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`year_month` varchar(7) NOT NULL,
	`domestic_product_id` int,
	`title` varchar(500) NOT NULL DEFAULT '',
	`quantity` int NOT NULL DEFAULT 1,
	`unit_price` decimal(10,2),
	`supplier_name` varchar(200),
	`note` text,
	`sort_order` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `monthly_domestic_items_id` PRIMARY KEY(`id`)
);
