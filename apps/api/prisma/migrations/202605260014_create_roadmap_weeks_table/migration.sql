CREATE TABLE `RoadmapWeek` (
  `id` VARCHAR(191) NOT NULL,
  `roadmapId` VARCHAR(191) NOT NULL,
  `weekNumber` INT NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `theme` VARCHAR(191) NULL,
  `startsOn` DATETIME(3) NULL,
  `endsOn` DATETIME(3) NULL,

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
