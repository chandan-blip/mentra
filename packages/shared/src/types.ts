/**
 * Common discriminated unions and response envelopes used across FE + BE.
 * Per module specs, every API response uses this envelope shape.
 */

export type ApiOk<T> = {
  data: T;
  meta?: Record<string, unknown>;
  error?: never;
};

export type ApiErr = {
  data?: never;
  meta?: Record<string, unknown>;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export type ApiResponse<T> = ApiOk<T> | ApiErr;

export type Role = 'student' | 'mentor' | 'admin';

export type UserStatus = 'pending' | 'active' | 'suspended';

export type AuthProvider = 'email' | 'google' | 'github';

// --- User profile (module 02) ---

export type StudentProfileView = {
  id: string;
  userId: string;
  avatarUrl: string | null;
  bio: string | null;
  country: string | null;
  city: string | null;
  timezone: string;
  educationLevel: string | null;
  collegeName: string | null;
  graduationYear: number | null;
  experienceLevel: string | null;
  currentRole: string | null;
  currentCompany: string | null;
  goal: string | null;
  preferredCompanyType: string[];
  targetRoles: string[];
  studyHoursPerDay: number | null;
  techStack: string[];
  githubUrl: string | null;
  linkedinUrl: string | null;
  portfolioUrl: string | null;
  twitterUrl: string | null;
  resumeFileKey: string | null;
  resumeUploadedAt: string | null;
  onboardingStep: number;
  onboardingComplete: boolean;
  createdAt: string;
  updatedAt: string;
};

export type NotificationPreferencesView = {
  emailDailyTasks: boolean;
  emailWeeklyReview: boolean;
  emailSessionReminders: boolean;
  emailAnnouncements: boolean;
  inAppEnabled: boolean;
};

export type ProfileMeView = {
  profile: StudentProfileView;
  notifications: NotificationPreferencesView;
};

export type SkillCatalogueEntry = {
  id: string;
  label: string;
  category: 'language' | 'frontend' | 'backend' | 'database' | 'devops' | 'mobile' | 'concept' | 'tool';
};

// --- Assessment (module 03) ---

export type AssessmentSkillCategory =
  | 'language'
  | 'framework'
  | 'tool'
  | 'concept'
  | 'dsa'
  | 'system_design'
  | 'soft_skill'
  | 'domain';

export type SkillRef = {
  id: string;
  label: string;
  category: AssessmentSkillCategory;
  parentId: string | null;
};

export type QuestionOption = { id: string; label: string };

/** A question as served during an attempt — never includes the correct answer. */
export type QuestionView = {
  id: string;
  type: 'single_choice' | 'multi_choice' | 'numeric' | 'short_text';
  body: string;
  options: QuestionOption[] | null;
  difficulty: number;
};

export type TemplateView = {
  id: string;
  name: string;
  description: string | null;
  type: 'initial' | 'periodic' | 'topic';
  questionCount: number;
  timeLimitSec: number;
};

export type SavedAnswer = {
  questionId: string;
  selected: { optionIds?: string[]; value?: number; text?: string };
};

export type AttemptView = {
  id: string;
  templateId: string;
  status: 'in_progress' | 'completed' | 'abandoned' | 'auto_completed';
  startedAt: string;
  expiresAt: string;
  remainingSec: number;
  questions: QuestionView[];
  answers: SavedAnswer[];
};

export type StartAssessmentResult = {
  attemptId: string;
  questions: QuestionView[];
  expiresAt: string;
};

export type CompleteAssessmentResult = {
  status: 'completed' | 'auto_completed';
  totalScore: number;
  redirectTo: string;
};

export type SkillScoreView = {
  skillId: string;
  label: string;
  category: AssessmentSkillCategory;
  score: number;
  confidence: number;
};

export type QuestionResult = {
  questionId: string;
  type: 'single_choice' | 'multi_choice' | 'numeric' | 'short_text';
  body: string;
  options: QuestionOption[] | null;
  selected: { optionIds?: string[]; value?: number; text?: string } | null;
  correct: unknown;
  isCorrect: boolean | null;
  explanation: string | null;
  skills: string[];
};

export type AssessmentResultView = {
  attemptId: string;
  status: 'completed' | 'auto_completed';
  totalScore: number;
  durationSec: number | null;
  completedAt: string | null;
  skillMatrix: SkillScoreView[];
  breakdown: QuestionResult[];
};

export type SkillHistoryPoint = {
  score: number;
  confidence: number;
  source: string;
  recordedAt: string;
};

export type AssessmentOverview = {
  activeAttemptId: string | null;
  completedCount: number;
  skillsAssessed: number;
  latest: {
    attemptId: string;
    status: 'completed' | 'auto_completed';
    totalScore: number;
    completedAt: string | null;
  } | null;
};

// --- Roadmap (module 05) ---

export type RoadmapItemView = {
  id: string;
  weekId: string;
  order: number;
  type: 'topic' | 'project' | 'assessment' | 'session' | 'reading' | 'practice';
  title: string;
  description: string | null;
  skillIds: string[];
  estimatedMin: number | null;
  dependsOnIds: string[];
  status: 'locked' | 'available' | 'in_progress' | 'completed' | 'skipped';
  completedAt: string | null;
};

export type RoadmapWeekView = {
  id: string;
  weekNumber: number;
  title: string;
  theme: string | null;
  items: RoadmapItemView[];
};

export type RoadmapView = {
  id: string;
  status: 'active' | 'archived' | 'superseded';
  generatedBy: string;
  totalWeeks: number;
  startedOn: string;
  currentWeek: number;
  completedItems: number;
  totalItems: number;
  percentComplete: number;
  weeks: RoadmapWeekView[];
};

export type RoadmapSummary = {
  hasRoadmap: boolean;
  totalWeeks: number;
  completedItems: number;
  totalItems: number;
  percentComplete: number;
  currentWeek: number;
};

export type RoadmapHistoryEntry = {
  id: string;
  status: 'active' | 'archived' | 'superseded';
  generatedBy: string;
  totalWeeks: number;
  startedOn: string;
  archivedAt: string | null;
};

export type RoadmapItemActionResult = {
  status: RoadmapItemView['status'];
  unlocked: string[];
};

// --- Topic subtopics + completion test ---

export type RoadmapSubtopicView = {
  id: string;
  itemId: string;
  order: number;
  title: string;
  description: string | null;
  estimatedMin: number | null;
};

/** A test question as shown to the student — never includes the correct answers. */
export type RoadmapTestQuestionView = {
  id: string;
  subtopicId: string | null;
  order: number;
  type: 'single_choice' | 'multi_choice';
  body: string;
  options: string[];
  points: number;
};

export type RoadmapTestView = {
  id: string;
  itemId: string;
  roadmapId: string;
  status: 'ready' | 'in_progress' | 'completed';
  totalQuestions: number;
  maxScore: number;
  passPercent: number;
  questions: RoadmapTestQuestionView[];
};

/** Marks for one topic-test attempt (mirrors a RoadmapTestResult row). */
export type RoadmapTestResultView = {
  id: string;
  testId: string;
  itemId: string;
  roadmapId: string;
  attemptNumber: number;
  score: number;
  maxScore: number;
  percent: number;
  correctCount: number;
  totalQuestions: number;
  passed: boolean;
  createdAt: string;
};

/** Per-question grading detail returned right after a submission. */
export type RoadmapTestGradedQuestion = {
  questionId: string;
  correct: number[];
  selected: number[];
  isCorrect: boolean;
  pointsAwarded: number;
  points: number;
  explanation: string | null;
};

export type RoadmapTestSubmitResult = {
  result: RoadmapTestResultView;
  graded: RoadmapTestGradedQuestion[];
  itemStatus: RoadmapItemView['status'];
  unlocked: string[];
};

/** Aggregated topic drilldown: the subtopics to learn + test state + best marks. */
export type RoadmapTopicView = {
  itemId: string;
  subtopics: RoadmapSubtopicView[];
  bestResult: RoadmapTestResultView | null;
  lastResult: RoadmapTestResultView | null;
  attempts: number;
  openTestId: string | null;
  passPercent: number;
};

// --- Dashboard (module 04) ---

export type DashboardRecommendation = {
  recId: string;
  title: string;
  body: string;
  cta: { label: string; href: string } | null;
  priority: number;
};

export type DashboardWidgets = Record<string, { enabled: boolean; lockReason?: string }>;

export type DashboardOverview = {
  profile: {
    name: string;
    avatarUrl: string | null;
    onboardingComplete: boolean;
    memberSince: string;
  };
  assignment: {
    exists: boolean;
    status: 'ready' | 'completed' | null;
    score: number | null;
  };
  nextSteps: DashboardRecommendation[];
  stats: {
    joinedAt: string;
  };
  widgets: DashboardWidgets;
};

// --- Access control (RBAC + subscriptions) ---

/** Where a module surfaces: `sidebar` shows in the nav rail; `other` is access-control only. */
export type ModulePlacement = 'sidebar' | 'other';

export type ModuleEntitlement = {
  key: string;
  label: string;
  description: string | null; // admin-authored; shown on the locked-module screen
  icon: string | null;
  route: string | null;
  parentKey: string | null;
  placement: ModulePlacement;
  sortOrder: number;
  canRead: boolean;
  canWrite: boolean;
  unlocked: boolean; // included in the user's subscription plan
};

export type MeAccess = {
  roleId: string;
  isAdmin: boolean;
  planId: string | null;
  modules: ModuleEntitlement[];
};

export type AdminModule = {
  key: string;
  label: string;
  description: string | null;
  icon: string | null;
  route: string | null;
  placement: ModulePlacement;
  /** Informational target-audience tag (a role id), or null for all/none. Does not affect access. */
  role: string | null;
  parentKey: string | null;
  sortOrder: number;
  active: boolean;
};

export type AdminRole = {
  id: string;
  label: string;
  description: string | null;
  isAdmin: boolean;
  isSystem: boolean;
};

export type AdminRolePermission = {
  roleId: string;
  moduleKey: string;
  canRead: boolean;
  canWrite: boolean;
};

export type AdminPlan = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  active: boolean;
  isDefault: boolean;
  /** Target role (AccessRole.id) this plan is offered to; null = all roles. */
  roleId: string | null;
  moduleKeys: string[];
};

export type AdminUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  roleId: string | null;
  planId: string | null;
  createdAt: string;
};

