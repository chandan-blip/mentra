-- CreateTable
CREATE TABLE `StudentReview` (
  `id` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `studentName` VARCHAR(120) NULL,
  `body` TEXT NULL,
  `mediaType` VARCHAR(16) NOT NULL,
  `mediaUrl` TEXT NULL,
  `thumbnailUrl` TEXT NULL,
  `visible` BOOLEAN NOT NULL DEFAULT true,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `createdBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `StudentReview_visible_sortOrder_idx`(`visible`, `sortOrder`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
