CREATE TABLE IF NOT EXISTS `delivery_histories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`deliveryNo` varchar(200) NOT NULL,
	`zaicoDeliveryId` int,
	`itemsJson` text NOT NULL,
	`status` enum('success','error') NOT NULL,
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `delivery_histories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `purchase_extras` (
	`id` int AUTO_INCREMENT NOT NULL,
	`zaicoId` int NOT NULL,
	`shipDate` varchar(20),
	`trackingNumber` varchar(200),
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `purchase_extras_id` PRIMARY KEY(`id`),
	CONSTRAINT `purchase_extras_zaicoId_unique` UNIQUE(`zaicoId`)
);
