CREATE TABLE IF NOT EXISTS `invoice_memos` (
`id` int AUTO_INCREMENT NOT NULL,
`invoice_key` varchar(50) NOT NULL,
`color_key` varchar(200) NOT NULL,
`memo` text NOT NULL,
`createdAt` timestamp NOT NULL DEFAULT (now()),
`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
CONSTRAINT `invoice_memos_id` PRIMARY KEY(`id`)
);
