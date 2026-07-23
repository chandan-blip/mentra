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
  /** Display name, sourced from the User record (not the profile row). */
  name: string;
  avatarUrl: string | null;
  bio: string | null;
  country: string | null;
  city: string | null;
  timezone: string;
  educationLevel: string | null;
  academicProgram: string | null;
  academicSemester: number | null;
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

/** Computed "achievements" — derived from real activity, not self-claimed. */
export type PublicProfileStats = {
  /** ISO date the student joined (StudentProfile.createdAt). */
  memberSince: string;
  /** Number of skills on the tech stack. */
  skillCount: number;
  /** Number of community posts authored. */
  communityPosts: number;
};

/**
 * Public-facing profile — the safe subset of StudentProfileView shown to OTHER
 * students (no resume, notification prefs, or onboarding internals), plus computed
 * achievement stats.
 */
export type PublicProfileView = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  bio: string | null;
  city: string | null;
  country: string | null;
  currentRole: string | null;
  currentCompany: string | null;
  experienceLevel: string | null;
  goal: string | null;
  targetRoles: string[];
  techStack: string[];
  githubUrl: string | null;
  linkedinUrl: string | null;
  portfolioUrl: string | null;
  twitterUrl: string | null;
  stats: PublicProfileStats;
  /** Total followers / following (social graph). */
  followers: number;
  following: number;
  /** Whether the requesting user follows this profile. */
  isFollowedByViewer: boolean;
  /** Whether this profile belongs to the requesting user. */
  isSelf: boolean;
};

/** Compact profile shown in the discovery directory grid. */
export type PublicProfileCardView = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  /** Role · company, or the career goal if no role is set. */
  headline: string | null;
  location: string | null;
  techStack: string[];
  followers: number;
  isFollowedByViewer: boolean;
  githubUrl: string | null;
  linkedinUrl: string | null;
  portfolioUrl: string | null;
  twitterUrl: string | null;
};

/** Returned by follow / unfollow — lets the client update the button + count in place. */
export type FollowResultView = {
  following: boolean;
  followers: number;
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

// --- Learning (test series) ---
// `LearningDifficulty` / `LearningTestQuestionType` are exported from schemas/learning
// (derived from their Zod enums); the view types below reference the unions inline to
// avoid a duplicate export.

/** One test in a category's ladder, summarized for the category/list views. */
export type LearningTestSummary = {
  id: string;
  categoryId: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  order: number;
  title: string;
  totalQuestions: number;
  passPercent: number;
  /** True once the questions have been AI-generated (first start). */
  generated: boolean;
  attempts: number;
  bestPercent: number | null;
  passed: boolean;
};

export type LearningCategoryView = {
  id: string;
  slug: string;
  title: string;
  description: string;
  skillTags: string[];
  icon: string | null;
  order: number;
  /** True for shared "build your own" custom-quiz topics (vs the student's own ladder). */
  isShared: boolean;
  /** The 0–10 level a custom quiz targets; null for auto-generated ladders. */
  experienceLevel: number | null;
  /** One-line "what this helps you do"; null on categories generated before this existed. */
  benefit: string | null;
  /** Short example projects where the topic applies (may be empty). */
  projects: string[];
  tests: LearningTestSummary[];
  /** True when every test in the ladder has a passing attempt. */
  seriesCompleted: boolean;
};

/** Result of a custom-quiz request: where to go, and whether it was served from cache. */
export type CustomLearningResult = {
  categoryId: string;
  testId: string;
  /** True when an existing shared quiz matched (no AI call); false when freshly generated. */
  cached: boolean;
};

/** A question as sent to the client — never includes the correct answer. */
export type LearningTestQuestionView = {
  id: string;
  order: number;
  type: 'single_choice' | 'multi_choice';
  body: string;
  options: string[];
  points: number;
};

export type LearningTestView = {
  id: string;
  categoryId: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  title: string;
  totalQuestions: number;
  maxScore: number;
  passPercent: number;
  questions: LearningTestQuestionView[];
};

/** Marks for one learning-test attempt. */
export type LearningTestResultView = {
  id: string;
  testId: string;
  categoryId: string;
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
export type LearningTestGradedQuestion = {
  questionId: string;
  correct: number[];
  selected: number[];
  isCorrect: boolean;
  pointsAwarded: number;
  points: number;
  explanation: string | null;
};

export type LearningTestSubmitResult = {
  result: LearningTestResultView;
  graded: LearningTestGradedQuestion[];
  /** True if this attempt just completed the whole category ladder. */
  seriesCompleted: boolean;
};

/** Aggregate learning stats for a student — surfaced in progress / achievements. */
export type LearningProgressView = {
  categoriesCount: number;
  testsPassed: number;
  seriesCompleted: number;
  averageBestPercent: number;
};

