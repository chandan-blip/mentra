-- Remove the AssessmentAttempt table (assignment/roadmap/assessment features removed; login required for all).
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS `AssessmentAttempt`;
SET FOREIGN_KEY_CHECKS = 1;
