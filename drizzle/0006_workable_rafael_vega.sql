CREATE TABLE IF NOT EXISTS `inventory_extras` (
	`id` int AUTO_INCREMENT NOT NULL,
	`zaicoInventoryId` int NOT NULL,
	`supplierUrl` text,
	`supplierName` varchar(200),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `inventory_extras_id` PRIMARY KEY(`id`),
	CONSTRAINT `inventory_extras_zaicoInventoryId_unique` UNIQUE(`zaicoInventoryId`)
);
