-- The learning landing unions each student's own categories with all shared topics
-- (WHERE userId = :userId OR isShared = 1); index the shared flag for that scan.
CREATE INDEX `LearningCategory_isShared_idx` ON `LearningCategory` (`isShared`);
