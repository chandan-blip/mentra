CREATE TABLE `Job` (
  `id` VARCHAR(191) NOT NULL,
  `title` VARCHAR(200) NOT NULL,
  `company` VARCHAR(200) NOT NULL,
  `location` VARCHAR(200) NULL,
  `locationType` VARCHAR(16) NOT NULL DEFAULT 'onsite',
  `employmentType` VARCHAR(16) NOT NULL DEFAULT 'full-time',
  `experienceLevel` VARCHAR(16) NOT NULL DEFAULT 'entry',
  `description` TEXT NOT NULL,
  `skills` JSON NULL,
  `targetRole` VARCHAR(120) NULL,
  `salary` VARCHAR(120) NULL,
  `applyUrl` VARCHAR(500) NULL,
  `source` VARCHAR(16) NOT NULL DEFAULT 'ai',
  `createdBy` VARCHAR(191) NULL,
  `status` VARCHAR(16) NOT NULL DEFAULT 'open',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
