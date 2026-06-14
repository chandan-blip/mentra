CREATE TABLE `Assignment` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `status` ENUM('ready', 'completed') NOT NULL DEFAULT 'ready',
  `model` VARCHAR(191) NOT NULL,
  `spec` JSON NOT NULL,
  `responses` JSON NULL,
  `score` INT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `completedAt` DATETIME(3) NULL,
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  -- MySQL has no partial unique index; this is non-null only while open (not yet
  -- completed), so a UNIQUE index on it enforces "one open assignment per user".
  -- That existence check is also the AI-cache guard: never regenerate if one exists.
  `openKey` VARCHAR(191) GENERATED ALWAYS AS (IF(`status` = 'ready', `userId`, NULL)) STORED,

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
