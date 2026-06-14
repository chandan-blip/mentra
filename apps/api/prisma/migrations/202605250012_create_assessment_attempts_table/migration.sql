CREATE TABLE `AssessmentAttempt` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `templateId` VARCHAR(191) NOT NULL,
  `status` ENUM('in_progress', 'completed', 'abandoned', 'auto_completed') NOT NULL,
  `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `expiresAt` DATETIME(3) NOT NULL,
  `completedAt` DATETIME(3) NULL,
  `totalScore` DOUBLE NULL,
  `durationSec` INT NULL,
  `questionsSnapshot` JSON NOT NULL,
  `metadata` JSON NULL,

  -- MySQL has no partial unique index; this generated column is non-null only
  -- while in progress, so a UNIQUE index on it enforces "one in-progress per
  -- (user, template)" while still allowing many completed/abandoned attempts.
  `inProgressKey` VARCHAR(400) GENERATED ALWAYS AS (
    IF(`status` = 'in_progress', CONCAT(`userId`, '|', `templateId`), NULL)
  ) STORED,

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
