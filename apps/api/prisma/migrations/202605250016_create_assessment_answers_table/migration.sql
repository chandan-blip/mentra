CREATE TABLE `AssessmentAnswer` (
  `id` VARCHAR(191) NOT NULL,
  `attemptId` VARCHAR(191) NOT NULL,
  `questionId` VARCHAR(191) NOT NULL,
  `selected` JSON NOT NULL,
  `isCorrect` BOOLEAN NULL,
  `timeSpentMs` INT NOT NULL DEFAULT 0,
  `answeredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
