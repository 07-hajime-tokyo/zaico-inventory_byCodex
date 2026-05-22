CREATE TABLE IF NOT EXISTS `inventory_memos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`zaicoInventoryId` int NOT NULL,
	`title` varchar(500),
	`changeType` varchar(20) NOT NULL,
	`quantityBefore` int,
	`quantityAfter` int,
	`quantityDelta` int,
	`memo` text,
	`operatorName` varchar(200),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `inventory_memos_id` PRIMARY KEY(`id`)
);
