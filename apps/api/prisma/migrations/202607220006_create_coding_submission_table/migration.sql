-- One row per student submission to a question. `status` is the sandbox verdict; `results`
-- is the JSON per-test-case detail. No foreign keys — `taskId`/`questionId`/`userId` are
-- plain id columns.
CREATE TABLE `CodingSubmission` (
  `id` VARCHAR(191) NOT NULL,
  `taskId` VARCHAR(191) NOT NULL,
  `questionId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `language` VARCHAR(32) NOT NULL,
  `code` MEDIUMTEXT NOT NULL,
  `status` ENUM('passed', 'failed', 'error') NOT NULL,
  `passedCount` INT NOT NULL DEFAULT 0,
  `totalCount` INT NOT NULL DEFAULT 0,
  `percent` INT NOT NULL DEFAULT 0,
  `results` JSON NOT NULL,
  `aiFeedback` TEXT NULL,
  `aiModel` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
