CREATE TABLE `partner_message_threads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`parentMessageId` int NOT NULL,
	`senderType` varchar(20) NOT NULL,
	`senderName` varchar(200) NOT NULL,
	`content` text NOT NULL,
	`isReadByPartner` int NOT NULL DEFAULT 0,
	`isReadByAdmin` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `partner_message_threads_id` PRIMARY KEY(`id`)
);
