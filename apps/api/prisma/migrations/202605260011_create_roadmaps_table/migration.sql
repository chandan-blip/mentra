CREATE TABLE `Roadmap` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `status` ENUM('active', 'archived', 'superseded') NOT NULL DEFAULT 'active',
  `generatedBy` VARCHAR(191) NOT NULL,
  `basisAttemptId` VARCHAR(191) NULL,
  `basisProfileVersion` INT NULL,
  `totalWeeks` INT NOT NULL,
  `startedOn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `archivedAt` DATETIME(3) NULL,
  `notes` TEXT NULL,

  -- MySQL has no partial unique index; this is non-null only while active, so a
  -- UNIQUE index on it enforces "one active roadmap per user".
  `activeKey` VARCHAR(191) GENERATED ALWAYS AS (IF(`status` = 'active', `userId`, NULL)) STORED,

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
