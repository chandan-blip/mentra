CREATE TABLE `LearningTest` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `categoryId` VARCHAR(191) NOT NULL,
  `difficulty` ENUM('beginner', 'intermediate', 'advanced') NOT NULL,
  `order` INT NOT NULL DEFAULT 0,
  `title` VARCHAR(191) NOT NULL,
  `model` VARCHAR(191) NULL,
  `totalQuestions` INT NOT NULL DEFAULT 0,
  `maxScore` INT NOT NULL DEFAULT 0,
  `passPercent` INT NOT NULL DEFAULT 70,
  `generatedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
