-- CreateTable
CREATE TABLE `TelegramChannel` (
  `id` VARCHAR(191) NOT NULL,
  `label` VARCHAR(120) NOT NULL,
  `chatId` VARCHAR(120) NOT NULL,
  `purpose` VARCHAR(16) NOT NULL DEFAULT 'notify',
  `events` TEXT NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `TelegramChannel_chatId_key`(`chatId`),
  INDEX `TelegramChannel_active_sortOrder_idx`(`active`, `sortOrder`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
