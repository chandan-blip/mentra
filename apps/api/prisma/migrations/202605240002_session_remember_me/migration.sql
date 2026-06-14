ALTER TABLE `Session`
  ADD COLUMN `rememberMe` BOOLEAN NOT NULL DEFAULT true AFTER `familyId`;
