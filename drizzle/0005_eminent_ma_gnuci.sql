CREATE TABLE IF NOT EXISTS `deleted_inventories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`zaicoId` int NOT NULL,
	`title` varchar(500) NOT NULL,
	`category` varchar(200),
	`place` varchar(200),
	`quantity` varchar(50),
	`unit` varchar(50),
	`unitPrice` varchar(50),
	`etc` text,
	`snapshotJson` text NOT NULL,
	`deletedBy` varchar(200),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `deleted_inventories_id` PRIMARY KEY(`id`)
);
