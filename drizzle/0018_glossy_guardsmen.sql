CREATE TABLE IF NOT EXISTS `authorized_users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `authorized_users_id` PRIMARY KEY(`id`),
	CONSTRAINT `authorized_users_openId_unique` UNIQUE(`openId`)
);
