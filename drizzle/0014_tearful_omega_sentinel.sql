CREATE TABLE IF NOT EXISTS `invoice_manual_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`invoice_no` varchar(50) NOT NULL,
	`title` varchar(500) NOT NULL DEFAULT '',
	`quantity` int NOT NULL DEFAULT 1,
	`unit_price` decimal(10,2),
	`sort_order` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `invoice_manual_items_id` PRIMARY KEY(`id`)
);
