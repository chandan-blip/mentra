-- Remove the Assignment table (assignment/roadmap/assessment features removed; login required for all).
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS `Assignment`;
SET FOREIGN_KEY_CHECKS = 1;
