-- One question within a task (never a JSON blob of all questions). `languages` and
-- `testCases` are JSON. No foreign keys — `taskId` is a plain id column.
CREATE TABLE `CodingQuestion` (
  `id` VARCHAR(191) NOT NULL,
  `taskId` VARCHAR(191) NOT NULL,
  `sortOrder` INT NOT NULL DEFAULT 0,
  `title` VARCHAR(191) NOT NULL,
  `description` TEXT NOT NULL,
  `languages` JSON NOT NULL,
  `starterCode` TEXT NOT NULL,
  `testCases` JSON NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
