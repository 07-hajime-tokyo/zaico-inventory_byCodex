ALTER TABLE `local_purchases` ADD `shipDate` varchar(20);--> statement-breakpoint
ALTER TABLE `local_purchases` ADD `trackingNumber` varchar(200);--> statement-breakpoint
ALTER TABLE `local_purchases` ADD `carrier` varchar(50);--> statement-breakpoint
ALTER TABLE `local_purchases` ADD `note` text;