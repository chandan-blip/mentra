CREATE TABLE `RoadmapSubtopic` (
  `id` VARCHAR(191) NOT NULL,
  `roadmapId` VARCHAR(191) NOT NULL,
  `itemId` VARCHAR(191) NOT NULL,
  `order` INT NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT NULL,
  `estimatedMin` INT NULL,
  `generatedBy` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
