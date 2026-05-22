CREATE TABLE IF NOT EXISTS `fedex_shipments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`deliveryNo` varchar(200) NOT NULL,
	`sheetName` varchar(100) NOT NULL,
	`shippingDate` varchar(20) NOT NULL,
	`trackingNumber` varchar(100) NOT NULL,
	`itemsJson` text NOT NULL,
	`spreadsheetStatus` enum('pending','success','error') NOT NULL DEFAULT 'pending',
	`spreadsheetError` text,
	`operatorName` varchar(200),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `fedex_shipments_id` PRIMARY KEY(`id`)
);
