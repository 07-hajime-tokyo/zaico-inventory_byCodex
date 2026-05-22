ALTER TABLE `partner_messages` ADD COLUMN `replyText` text;
ALTER TABLE `partner_messages` ADD COLUMN `repliedAt` timestamp;
ALTER TABLE `partner_messages` ADD COLUMN `isDeleted` int NOT NULL DEFAULT 0;
ALTER TABLE `partner_messages` ADD COLUMN `isDeletedByPartner` int NOT NULL DEFAULT 0;

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
