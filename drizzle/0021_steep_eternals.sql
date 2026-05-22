CREATE TABLE IF NOT EXISTS `manual_shipments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`invoiceNo` varchar(50) NOT NULL,
	`sheetName` varchar(100) NOT NULL,
	`shippingDate` varchar(20) NOT NULL,
	`trackingNumber` varchar(100) NOT NULL,
	`itemsJson` text NOT NULL,
	`operatorName` varchar(200),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `manual_shipments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `partner_messages` ADD `replyText` text;--> statement-breakpoint
ALTER TABLE `partner_messages` ADD `repliedAt` timestamp;--> statement-breakpoint
ALTER TABLE `partner_messages` ADD `isDeleted` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `partner_messages` ADD `isDeletedByPartner` int DEFAULT 0 NOT NULL;