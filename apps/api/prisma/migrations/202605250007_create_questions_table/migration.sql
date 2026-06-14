CREATE TABLE `Question` (
  `id` VARCHAR(191) NOT NULL,
  `type` ENUM('single_choice', 'multi_choice', 'numeric', 'short_text') NOT NULL,
  `body` TEXT NOT NULL,
  `options` JSON NULL,
  `correct` JSON NOT NULL,
  `explanation` TEXT NULL,
  `difficulty` INT NOT NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `authoredBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
