-- Remove the RoadmapItem table (assignment/roadmap/assessment features removed; login required for all).
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS `RoadmapItem`;
SET FOREIGN_KEY_CHECKS = 1;
