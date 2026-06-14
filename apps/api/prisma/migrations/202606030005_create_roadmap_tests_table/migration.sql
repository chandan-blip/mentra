CREATE TABLE `RoadmapTest` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `roadmapId` VARCHAR(191) NOT NULL,
  `itemId` VARCHAR(191) NOT NULL,
  `status` ENUM('ready', 'in_progress', 'completed') NOT NULL DEFAULT 'ready',
  `model` VARCHAR(191) NOT NULL,
  `totalQuestions` INT NOT NULL DEFAULT 0,
  `maxScore` INT NOT NULL DEFAULT 0,
  `passPercent` INT NOT NULL,
  `startedAt` DATETIME(3) NULL,
  `completedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  -- MySQL has no partial unique index; this generated column is non-null only
  -- while the test is not yet completed, so a UNIQUE index on it enforces "one
  -- open test per (user, topic)" while still allowing many completed retakes.
  `openKey` VARCHAR(400) GENERATED ALWAYS AS (
    IF(`status` <> 'completed', CONCAT(`userId`, '|', `itemId`), NULL)
  ) STORED,

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
