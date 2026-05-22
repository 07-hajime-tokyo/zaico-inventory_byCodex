CREATE TABLE IF NOT EXISTS `purchase_histories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`zaicoId` int NOT NULL,
	`kanriNo` varchar(200),
	`title` varchar(500) NOT NULL,
	`category` varchar(200),
	`supplier` varchar(200),
	`quantity` varchar(50) NOT NULL,
	`unitPrice` varchar(50),
	`purchaseDate` varchar(20) NOT NULL,
	`inventoryId` int,
	`cancelled` int NOT NULL DEFAULT 0,
	`operatorName` varchar(200),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `purchase_histories_id` PRIMARY KEY(`id`)
);
