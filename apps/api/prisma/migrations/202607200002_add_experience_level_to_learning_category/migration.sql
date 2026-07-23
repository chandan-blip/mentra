-- The 0–10 experience level a custom quiz was generated for (null for auto-generated
-- per-student ladders). Part of the topic+level cache key and shown on the topic card.
ALTER TABLE `LearningCategory` ADD COLUMN `experienceLevel` INT NULL;
