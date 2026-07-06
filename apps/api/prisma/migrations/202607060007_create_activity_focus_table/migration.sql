CREATE TABLE `ActivityFocus` (
  `userId` VARCHAR(191) NOT NULL,
  `payload` JSON NOT NULL,
  `signalsHash` VARCHAR(64) NOT NULL,
  `generatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
