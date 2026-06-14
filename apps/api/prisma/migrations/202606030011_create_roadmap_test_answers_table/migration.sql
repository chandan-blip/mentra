CREATE TABLE `RoadmapTestAnswer` (
  `id` VARCHAR(191) NOT NULL,
  `testId` VARCHAR(191) NOT NULL,
  `questionId` VARCHAR(191) NOT NULL,
  `selected` JSON NOT NULL,
  `isCorrect` BOOLEAN NOT NULL DEFAULT false,
  `pointsAwarded` INT NOT NULL DEFAULT 0,
  `answeredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
