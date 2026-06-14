CREATE TABLE `RolePermission` (
  `roleId` VARCHAR(191) NOT NULL,
  `moduleKey` VARCHAR(191) NOT NULL,
  `canRead` BOOLEAN NOT NULL DEFAULT true,
  `canWrite` BOOLEAN NOT NULL DEFAULT false,

  PRIMARY KEY (`roleId`, `moduleKey`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
