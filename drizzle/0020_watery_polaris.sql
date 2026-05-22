CREATE TABLE IF NOT EXISTS `partner_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`partnerCode` varchar(100) NOT NULL,
	`partnerName` varchar(200) NOT NULL,
	`fedexShipmentId` int,
	`message` text NOT NULL,
	`isRead` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `partner_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `partner_portals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`partnerCode` varchar(100) NOT NULL,
	`partnerName` varchar(200) NOT NULL,
	`sheetName` varchar(100) NOT NULL,
	`password` varchar(200) NOT NULL,
	`sessionToken` varchar(200),
	`sessionExpiresAt` timestamp,
	`isActive` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `partner_portals_id` PRIMARY KEY(`id`),
	CONSTRAINT `partner_portals_partnerCode_unique` UNIQUE(`partnerCode`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `shipment_checks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`fedexShipmentId` int NOT NULL,
	`itemIndex` int NOT NULL,
	`isChecked` int NOT NULL DEFAULT 0,
	`partnerCode` varchar(100) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `shipment_checks_id` PRIMARY KEY(`id`)
);
