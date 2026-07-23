-- Remove the AssessmentTemplate table (assignment/roadmap/assessment features removed; login required for all).
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS `AssessmentTemplate`;
SET FOREIGN_KEY_CHECKS = 1;
