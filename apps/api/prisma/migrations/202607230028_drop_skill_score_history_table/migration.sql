-- Remove the SkillScoreHistory table (assignment/roadmap/assessment features removed; login required for all).
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS `SkillScoreHistory`;
SET FOREIGN_KEY_CHECKS = 1;
