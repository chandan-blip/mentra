CREATE TABLE `AssessmentTemplate` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `description` VARCHAR(500) NULL,
  `type` ENUM('initial', 'periodic', 'topic') NOT NULL,
  `questionCount` INT NOT NULL,
  `timeLimitSec` INT NOT NULL,
  `selectionRules` JSON NOT NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
