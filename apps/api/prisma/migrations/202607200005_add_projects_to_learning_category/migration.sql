-- Short example projects where this topic applies (JSON array of strings), shown as chips on
-- the topic card. AI-generated alongside the category; null for pre-existing categories.
ALTER TABLE `LearningCategory` ADD COLUMN `projects` JSON NULL;
