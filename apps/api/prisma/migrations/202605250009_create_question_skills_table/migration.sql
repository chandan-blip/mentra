CREATE TABLE `QuestionSkill` (
  `questionId` VARCHAR(191) NOT NULL,
  `skillId` VARCHAR(191) NOT NULL,
  `weight` INT NOT NULL DEFAULT 1,

  PRIMARY KEY (`questionId`, `skillId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
