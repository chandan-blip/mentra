-- CreateTable
CREATE TABLE `SmmQueue` (
  `id` VARCHAR(191) NOT NULL,
  `postUrl` VARCHAR(500) NOT NULL,
  `contextLabel` VARCHAR(64) NOT NULL DEFAULT 'generic',
  `status` VARCHAR(16) NOT NULL DEFAULT 'pending',
  `attempts` INTEGER NOT NULL DEFAULT 0,
  `placed` INTEGER NOT NULL DEFAULT 0,
  `viewsOrderId` VARCHAR(64) NULL,
  `reactionsOrderId` VARCHAR(64) NULL,
  `lastError` TEXT NULL,
  `startedAt` DATETIME(3) NULL,
  `processedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `SmmQueue_postUrl_key`(`postUrl`),
  INDEX `SmmQueue_status_createdAt_idx`(`status`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
