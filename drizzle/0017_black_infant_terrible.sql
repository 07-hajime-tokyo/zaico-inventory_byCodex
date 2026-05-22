CREATE TABLE IF NOT EXISTS `customers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`displayName` varchar(100) NOT NULL,
	`code` varchar(100) NOT NULL,
	`keywords` varchar(500) NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customers_id` PRIMARY KEY(`id`)
);
