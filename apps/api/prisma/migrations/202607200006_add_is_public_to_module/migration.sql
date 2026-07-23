-- Admin-configurable flag: when true, this module's content is browsable by logged-out
-- visitors (served via the un-authed /api/v1/public/* routers). Default off; only content
-- modules (learning, mentors, live-sessions, about) are wired for public rendering.
ALTER TABLE `Module` ADD COLUMN `isPublic` TINYINT(1) NOT NULL DEFAULT 0;
