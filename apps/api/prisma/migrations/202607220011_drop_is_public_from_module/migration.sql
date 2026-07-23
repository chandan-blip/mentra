-- Remove the public-module feature: modules are no longer browsable by logged-out
-- visitors (the guest shell + /api/v1/public/{access,learning,mentor} routes were removed).
-- Only logged-in users can access any module now.
ALTER TABLE `Module` DROP COLUMN `isPublic`;
