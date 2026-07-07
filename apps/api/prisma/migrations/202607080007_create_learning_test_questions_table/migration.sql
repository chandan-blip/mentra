CREATE TABLE `LearningTestQuestion` (
  `id` VARCHAR(191) NOT NULL,
  `testId` VARCHAR(191) NOT NULL,
  `order` INT NOT NULL,
  `type` ENUM('single_choice', 'multi_choice') NOT NULL,
  `body` TEXT NOT NULL,
  `options` JSON NOT NULL,
  `correct` JSON NOT NULL,
  `explanation` TEXT NULL,
  `points` INT NOT NULL DEFAULT 1,

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
