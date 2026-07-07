CREATE TABLE `LearningTestResult` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `testId` VARCHAR(191) NOT NULL,
  `categoryId` VARCHAR(191) NOT NULL,
  `attemptNumber` INT NOT NULL DEFAULT 1,
  `score` INT NOT NULL,
  `maxScore` INT NOT NULL,
  `percent` INT NOT NULL,
  `correctCount` INT NOT NULL,
  `totalQuestions` INT NOT NULL,
  `passed` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
