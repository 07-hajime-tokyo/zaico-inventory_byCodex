CREATE TABLE IF NOT EXISTS `local_inventories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`zaicoId` int,
	`title` varchar(500) NOT NULL,
	`category` varchar(200),
	`place` varchar(200),
	`quantity` int NOT NULL DEFAULT 0,
	`unit` varchar(50) DEFAULT '個',
	`unitPrice` decimal(10,2),
	`etc` text,
	`supplierUrl` text,
	`supplierName` varchar(200),
	`isDeleted` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `local_inventories_id` PRIMARY KEY(`id`),
	CONSTRAINT `local_inventories_zaicoId_unique` UNIQUE(`zaicoId`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `local_purchases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`zaicoId` int,
	`purchaseNum` varchar(100),
	`status` varchar(50) NOT NULL DEFAULT 'ordered',
	`itemsJson` text NOT NULL,
	`localInventoryId` int,
	`title` varchar(500),
	`category` varchar(200),
	`quantity` int NOT NULL DEFAULT 1,
	`unitPrice` decimal(10,2),
	`managementNo` varchar(200),
	`purchaseDate` varchar(20),
	`receivedDate` varchar(20),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `local_purchases_id` PRIMARY KEY(`id`),
	CONSTRAINT `local_purchases_zaicoId_unique` UNIQUE(`zaicoId`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `system_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(100) NOT NULL,
	`value` text NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `system_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `system_settings_key_unique` UNIQUE(`key`)
);
