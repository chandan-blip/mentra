CREATE TABLE `RoadmapItem` (
  `id` VARCHAR(191) NOT NULL,
  `weekId` VARCHAR(191) NOT NULL,
  `order` INT NOT NULL,
  `type` ENUM('topic', 'project', 'assessment', 'session', 'reading', 'practice') NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT NULL,
  `skillIds` JSON NULL,
  `estimatedMin` INT NULL,
  `contentRef` JSON NULL,
  `dependsOnIds` JSON NULL,
  `status` ENUM('locked', 'available', 'in_progress', 'completed', 'skipped') NOT NULL DEFAULT 'locked',
  `completedAt` DATETIME(3) NULL,

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
