-- A one-line "what mastering this helps you do" benefit, shown on the topic card. AI-generated
-- alongside the category; null for categories created before this column existed.
ALTER TABLE `LearningCategory` ADD COLUMN `benefit` VARCHAR(240) NULL;
