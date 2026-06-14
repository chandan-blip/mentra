CREATE TABLE `StudentProfile` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,

  `avatarUrl` VARCHAR(512) NULL,
  `bio` VARCHAR(500) NULL,

  `country` VARCHAR(100) NULL,
  `city` VARCHAR(120) NULL,
  `timezone` VARCHAR(64) NOT NULL DEFAULT 'Asia/Kolkata',

  `educationLevel` ENUM('high_school', 'undergrad', 'postgrad', 'doctoral', 'working_professional', 'self_taught') NULL,
  `collegeName` VARCHAR(200) NULL,
  `graduationYear` INT NULL,

  `experienceLevel` ENUM('none', 'intern', 'under_one', 'one_to_three', 'three_to_five', 'five_plus') NULL,
  `currentRole` VARCHAR(150) NULL,
  `currentCompany` VARCHAR(150) NULL,

  `goal` ENUM('first_job', 'switch_company', 'fang_prep', 'startup_join', 'freelance', 'upskill') NULL,
  `preferredCompanyType` JSON NULL,
  `targetRoles` JSON NULL,
  `studyHoursPerDay` INT NULL,

  `techStack` JSON NULL,

  `githubUrl` VARCHAR(512) NULL,
  `linkedinUrl` VARCHAR(512) NULL,
  `portfolioUrl` VARCHAR(512) NULL,
  `twitterUrl` VARCHAR(512) NULL,

  `resumeFileKey` VARCHAR(512) NULL,
  `resumeUploadedAt` DATETIME(3) NULL,

  `onboardingStep` INT NOT NULL DEFAULT 0,
  `onboardingComplete` BOOLEAN NOT NULL DEFAULT false,

  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `StudentProfile_userId_key`(`userId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `StudentProfile_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
