# Migrations

Policy (architecture §7): **one DDL change per migration file. Never bundle.**

| Migration | Intent |
|---|---|
| `202605240001_auth_mysql` | Create `User`, `AuthIdentity`, `Session` + FKs (auth module) |
| `202605240002_session_remember_me` | Add `Session.rememberMe` column |
| `202605250001_create_student_profile_table` | Create `StudentProfile` (user-profile module) |
| `202605250002_add_index_student_profile_onboarding` | Add analytics index on `StudentProfile.onboardingComplete` |
| `202605250003_create_notification_preferences_table` | Create `NotificationPreferences` |
| `202605250004_create_feature_flag_table` | Create `FeatureFlag` (flags backing store) |
| `202605250005_create_skills_table` | Create `Skill` (assessment module; canonical skill taxonomy) |
| `202605250006_add_index_skills_category` | Index `Skill.category` |
| `202605250007_create_questions_table` | Create `Question` (MCQ/aptitude bank) |
| `202605250008_add_index_questions_type_active_difficulty` | Index for question selection |
| `202605250009_create_question_skills_table` | Create `QuestionSkill` join table |
| `202605250010_add_index_question_skills_skillid` | Index `QuestionSkill.skillId` |
| `202605250011_create_assessment_templates_table` | Create `AssessmentTemplate` |
| `202605250012_create_assessment_attempts_table` | Create `AssessmentAttempt` (+ generated `inProgressKey`) |
| `202605250013_add_unique_assessment_attempts_one_in_progress` | Unique on `inProgressKey` (one in-progress per user/template) |
| `202605250014_add_index_assessment_attempts_userid_status` | Index `(userId, status)` |
| `202605250015_add_index_assessment_attempts_expiresat_status` | Index for the expiry sweep job |
| `202605250016_create_assessment_answers_table` | Create `AssessmentAnswer` |
| `202605250017_add_unique_assessment_answers_attempt_question` | Unique `(attemptId, questionId)` |
| `202605250018_add_index_assessment_answers_questionid` | Index `AssessmentAnswer.questionId` |
| `202605250019_create_skill_scores_table` | Create `SkillScore` |
| `202605250020_add_unique_skill_scores_user_skill` | Unique `(userId, skillId)` |
| `202605250021_add_index_skill_scores_userid` | Index `SkillScore.userId` |
| `202605250022_create_skill_score_history_table` | Create `SkillScoreHistory` |
| `202605250023_add_index_skill_score_history_user_skill_recordedat` | Index for score time series |
| `202605260001_create_module_table` | Create `Module` (sidebar/feature catalog; RBAC) |
| `202605260002_create_role_table` | Create `Role` (flexible roles) |
| `202605260003_create_role_permission_table` | Create `RolePermission` (read/write per role per module) |
| `202605260004_create_plan_table` | Create `Plan` (admin-created subscriptions) |
| `202605260005_create_plan_module_table` | Create `PlanModule` (modules included in a plan) |
| `202605260006_add_roleid_to_user` | Add `User.roleId` (RBAC role) |
| `202605260007_add_planid_to_user` | Add `User.planId` (subscription) |
| `202605260008_create_recommendation_log_table` | Create `RecommendationLog` (dashboard recommender tracking) |
| `202605260009_add_index_recommendation_log_user_shownat` | Index `(userId, shownAt)` |
| `202605260010_add_index_recommendation_log_recid` | Index `RecommendationLog.recId` |
| `202605260011_create_roadmaps_table` | Create `Roadmap` (+ generated `activeKey`) |
| `202605260012_add_unique_roadmaps_one_active_per_user` | Unique on `activeKey` (one active roadmap/user) |
| `202605260013_add_index_roadmaps_userid` | Index `Roadmap.userId` |
| `202605260014_create_roadmap_weeks_table` | Create `RoadmapWeek` |
| `202605260015_add_unique_roadmap_weeks_roadmapid_weeknumber` | Unique `(roadmapId, weekNumber)` |
| `202605260016_add_index_roadmap_weeks_roadmapid` | Index `RoadmapWeek.roadmapId` |
| `202605260017_create_roadmap_items_table` | Create `RoadmapItem` |
| `202605260018_add_unique_roadmap_items_weekid_order` | Unique `(weekId, order)` |
| `202605260019_add_index_roadmap_items_weekid_status` | Index `(weekId, status)` |
| `202605280001_add_placement_to_module` | Add `Module.placement` (sidebar vs access-control-only) |
| `202605280002_add_role_to_module` | Add `Module.role` (informational target-audience tag) |
| `202606020001_create_assignment_table` | Create `Assignment` (AI onboarding assignment; + generated `openKey`) |
| `202606020002_add_unique_assignment_open_per_user` | Unique on `openKey` (one open assignment/user; AI-cache guard) |
| `202606020003_add_index_assignment_userid` | Index `Assignment.userId` |
| `202606030001_widen_module_description` | Widen `Module.description` to `TEXT` (detailed module descriptions) |

Note: per project rule, these tables use **no foreign keys** — relationships are by stored id and enforced in the app.
