-- The assignment & roadmap feature modules are removed. Drop their sidebar/module
-- registration + role-permission + plan-module rows so they stop appearing anywhere.
DELETE FROM `RolePermission` WHERE `moduleKey` IN ('assignment', 'roadmap');
DELETE FROM `PlanModule` WHERE `moduleKey` IN ('assignment', 'roadmap');
DELETE FROM `Module` WHERE `key` IN ('assignment', 'roadmap');
