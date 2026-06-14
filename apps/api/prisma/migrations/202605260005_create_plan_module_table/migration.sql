CREATE TABLE `PlanModule` (
  `planId` VARCHAR(191) NOT NULL,
  `moduleKey` VARCHAR(191) NOT NULL,

  PRIMARY KEY (`planId`, `moduleKey`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
