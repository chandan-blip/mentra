
Object.defineProperty(exports, "__esModule", { value: true });

const {
  Decimal,
  objectEnumValues,
  makeStrictEnum,
  Public,
  getRuntime,
  skip
} = require('./runtime/index-browser.js')


const Prisma = {}

exports.Prisma = Prisma
exports.$Enums = {}

/**
 * Prisma Client JS version: 5.22.0
 * Query Engine version: 605197351a3c8bdd595af2d2a9bc3025bca48ea2
 */
Prisma.prismaVersion = {
  client: "5.22.0",
  engine: "605197351a3c8bdd595af2d2a9bc3025bca48ea2"
}

Prisma.PrismaClientKnownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientKnownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)};
Prisma.PrismaClientUnknownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientUnknownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientRustPanicError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientRustPanicError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientInitializationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientInitializationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientValidationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientValidationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.NotFoundError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`NotFoundError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`sqltag is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.empty = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`empty is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.join = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`join is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.raw = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`raw is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.getExtensionContext is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.defineExtension = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.defineExtension is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull
Prisma.JsonNull = objectEnumValues.instances.JsonNull
Prisma.AnyNull = objectEnumValues.instances.AnyNull

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull
}



/**
 * Enums
 */

exports.Prisma.TransactionIsolationLevel = makeStrictEnum({
  ReadUncommitted: 'ReadUncommitted',
  ReadCommitted: 'ReadCommitted',
  RepeatableRead: 'RepeatableRead',
  Serializable: 'Serializable'
});

exports.Prisma.UserScalarFieldEnum = {
  id: 'id',
  email: 'email',
  passwordHash: 'passwordHash',
  name: 'name',
  role: 'role',
  roleId: 'roleId',
  planId: 'planId',
  status: 'status',
  emailVerified: 'emailVerified',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ModuleScalarFieldEnum = {
  key: 'key',
  label: 'label',
  description: 'description',
  icon: 'icon',
  route: 'route',
  placement: 'placement',
  role: 'role',
  parentKey: 'parentKey',
  sortOrder: 'sortOrder',
  active: 'active',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AccessRoleScalarFieldEnum = {
  id: 'id',
  label: 'label',
  description: 'description',
  isAdmin: 'isAdmin',
  isSystem: 'isSystem',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.RolePermissionScalarFieldEnum = {
  roleId: 'roleId',
  moduleKey: 'moduleKey',
  canRead: 'canRead',
  canWrite: 'canWrite'
};

exports.Prisma.PlanScalarFieldEnum = {
  id: 'id',
  name: 'name',
  description: 'description',
  priceCents: 'priceCents',
  active: 'active',
  isDefault: 'isDefault',
  roleId: 'roleId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PlanModuleScalarFieldEnum = {
  planId: 'planId',
  moduleKey: 'moduleKey'
};

exports.Prisma.RecommendationLogScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  shownAt: 'shownAt',
  source: 'source',
  recId: 'recId',
  payload: 'payload',
  shownIn: 'shownIn',
  actedOn: 'actedOn',
  actedAt: 'actedAt',
  dismissedAt: 'dismissedAt'
};

exports.Prisma.RoadmapScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  status: 'status',
  generatedBy: 'generatedBy',
  basisAttemptId: 'basisAttemptId',
  basisProfileVersion: 'basisProfileVersion',
  totalWeeks: 'totalWeeks',
  startedOn: 'startedOn',
  archivedAt: 'archivedAt',
  notes: 'notes'
};

exports.Prisma.RoadmapWeekScalarFieldEnum = {
  id: 'id',
  roadmapId: 'roadmapId',
  weekNumber: 'weekNumber',
  title: 'title',
  theme: 'theme',
  startsOn: 'startsOn',
  endsOn: 'endsOn'
};

exports.Prisma.RoadmapItemScalarFieldEnum = {
  id: 'id',
  weekId: 'weekId',
  order: 'order',
  type: 'type',
  title: 'title',
  description: 'description',
  skillIds: 'skillIds',
  estimatedMin: 'estimatedMin',
  contentRef: 'contentRef',
  dependsOnIds: 'dependsOnIds',
  status: 'status',
  completedAt: 'completedAt'
};

exports.Prisma.RoadmapSubtopicScalarFieldEnum = {
  id: 'id',
  roadmapId: 'roadmapId',
  itemId: 'itemId',
  order: 'order',
  title: 'title',
  description: 'description',
  estimatedMin: 'estimatedMin',
  generatedBy: 'generatedBy',
  createdAt: 'createdAt'
};

exports.Prisma.RoadmapTestScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  roadmapId: 'roadmapId',
  itemId: 'itemId',
  status: 'status',
  model: 'model',
  totalQuestions: 'totalQuestions',
  maxScore: 'maxScore',
  passPercent: 'passPercent',
  startedAt: 'startedAt',
  completedAt: 'completedAt',
  createdAt: 'createdAt'
};

exports.Prisma.RoadmapTestQuestionScalarFieldEnum = {
  id: 'id',
  testId: 'testId',
  subtopicId: 'subtopicId',
  order: 'order',
  type: 'type',
  body: 'body',
  options: 'options',
  correct: 'correct',
  explanation: 'explanation',
  points: 'points'
};

exports.Prisma.RoadmapTestAnswerScalarFieldEnum = {
  id: 'id',
  testId: 'testId',
  questionId: 'questionId',
  selected: 'selected',
  isCorrect: 'isCorrect',
  pointsAwarded: 'pointsAwarded',
  answeredAt: 'answeredAt'
};

exports.Prisma.RoadmapTestResultScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  testId: 'testId',
  roadmapId: 'roadmapId',
  itemId: 'itemId',
  attemptNumber: 'attemptNumber',
  score: 'score',
  maxScore: 'maxScore',
  percent: 'percent',
  correctCount: 'correctCount',
  totalQuestions: 'totalQuestions',
  passed: 'passed',
  createdAt: 'createdAt'
};

exports.Prisma.AssignmentScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  status: 'status',
  model: 'model',
  spec: 'spec',
  responses: 'responses',
  score: 'score',
  createdAt: 'createdAt',
  completedAt: 'completedAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.StudentProfileScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  avatarUrl: 'avatarUrl',
  bio: 'bio',
  country: 'country',
  city: 'city',
  timezone: 'timezone',
  educationLevel: 'educationLevel',
  collegeName: 'collegeName',
  graduationYear: 'graduationYear',
  experienceLevel: 'experienceLevel',
  currentRole: 'currentRole',
  currentCompany: 'currentCompany',
  goal: 'goal',
  preferredCompanyType: 'preferredCompanyType',
  targetRoles: 'targetRoles',
  studyHoursPerDay: 'studyHoursPerDay',
  techStack: 'techStack',
  githubUrl: 'githubUrl',
  linkedinUrl: 'linkedinUrl',
  portfolioUrl: 'portfolioUrl',
  twitterUrl: 'twitterUrl',
  resumeFileKey: 'resumeFileKey',
  resumeUploadedAt: 'resumeUploadedAt',
  avatarFileKey: 'avatarFileKey',
  onboardingStep: 'onboardingStep',
  onboardingComplete: 'onboardingComplete',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.NotificationPreferencesScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  emailDailyTasks: 'emailDailyTasks',
  emailWeeklyReview: 'emailWeeklyReview',
  emailSessionReminders: 'emailSessionReminders',
  emailAnnouncements: 'emailAnnouncements',
  inAppEnabled: 'inAppEnabled',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.FeatureFlagScalarFieldEnum = {
  key: 'key',
  enabled: 'enabled',
  description: 'description',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SkillScalarFieldEnum = {
  id: 'id',
  label: 'label',
  category: 'category',
  parentId: 'parentId',
  active: 'active',
  createdAt: 'createdAt'
};

exports.Prisma.QuestionScalarFieldEnum = {
  id: 'id',
  type: 'type',
  body: 'body',
  options: 'options',
  correct: 'correct',
  explanation: 'explanation',
  difficulty: 'difficulty',
  active: 'active',
  authoredBy: 'authoredBy',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.QuestionSkillScalarFieldEnum = {
  questionId: 'questionId',
  skillId: 'skillId',
  weight: 'weight'
};

exports.Prisma.AssessmentTemplateScalarFieldEnum = {
  id: 'id',
  name: 'name',
  description: 'description',
  type: 'type',
  questionCount: 'questionCount',
  timeLimitSec: 'timeLimitSec',
  selectionRules: 'selectionRules',
  active: 'active',
  createdAt: 'createdAt'
};

exports.Prisma.AssessmentAttemptScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  templateId: 'templateId',
  status: 'status',
  startedAt: 'startedAt',
  expiresAt: 'expiresAt',
  completedAt: 'completedAt',
  totalScore: 'totalScore',
  durationSec: 'durationSec',
  questionsSnapshot: 'questionsSnapshot',
  metadata: 'metadata'
};

exports.Prisma.AssessmentAnswerScalarFieldEnum = {
  id: 'id',
  attemptId: 'attemptId',
  questionId: 'questionId',
  selected: 'selected',
  isCorrect: 'isCorrect',
  timeSpentMs: 'timeSpentMs',
  answeredAt: 'answeredAt'
};

exports.Prisma.SkillScoreScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  skillId: 'skillId',
  score: 'score',
  confidence: 'confidence',
  lastAttemptId: 'lastAttemptId',
  updatedAt: 'updatedAt'
};

exports.Prisma.SkillScoreHistoryScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  skillId: 'skillId',
  score: 'score',
  confidence: 'confidence',
  source: 'source',
  recordedAt: 'recordedAt'
};

exports.Prisma.AuthIdentityScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  provider: 'provider',
  providerId: 'providerId',
  createdAt: 'createdAt'
};

exports.Prisma.SessionScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  refreshTokenHash: 'refreshTokenHash',
  familyId: 'familyId',
  rememberMe: 'rememberMe',
  userAgent: 'userAgent',
  ip: 'ip',
  revokedAt: 'revokedAt',
  expiresAt: 'expiresAt',
  createdAt: 'createdAt'
};

exports.Prisma.LiveSessionScalarFieldEnum = {
  id: 'id',
  mentorId: 'mentorId',
  title: 'title',
  topic: 'topic',
  status: 'status',
  scheduledFor: 'scheduledFor',
  startedAt: 'startedAt',
  endedAt: 'endedAt',
  livekitRoom: 'livekitRoom',
  currentViewers: 'currentViewers',
  peakViewers: 'peakViewers',
  source: 'source',
  recordingStatus: 'recordingStatus',
  recordingUrl: 'recordingUrl',
  egressId: 'egressId',
  durationSeconds: 'durationSeconds',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SessionParticipantScalarFieldEnum = {
  id: 'id',
  sessionId: 'sessionId',
  userId: 'userId',
  roleAtJoin: 'roleAtJoin',
  joinedAt: 'joinedAt',
  leftAt: 'leftAt',
  attendedSeconds: 'attendedSeconds',
  createdAt: 'createdAt'
};

exports.Prisma.ChatMessageScalarFieldEnum = {
  id: 'id',
  sessionId: 'sessionId',
  authorUserId: 'authorUserId',
  authorName: 'authorName',
  body: 'body',
  createdAt: 'createdAt'
};

exports.Prisma.WatchProgressScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  sessionId: 'sessionId',
  positionSeconds: 'positionSeconds',
  updatedAt: 'updatedAt'
};

exports.Prisma.JobScalarFieldEnum = {
  id: 'id',
  title: 'title',
  company: 'company',
  location: 'location',
  locationType: 'locationType',
  employmentType: 'employmentType',
  experienceLevel: 'experienceLevel',
  description: 'description',
  skills: 'skills',
  targetRole: 'targetRole',
  salary: 'salary',
  applyUrl: 'applyUrl',
  source: 'source',
  createdBy: 'createdBy',
  status: 'status',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.LeadScalarFieldEnum = {
  id: 'id',
  ownerId: 'ownerId',
  firstName: 'firstName',
  lastName: 'lastName',
  email: 'email',
  phone: 'phone',
  company: 'company',
  jobTitle: 'jobTitle',
  status: 'status',
  source: 'source',
  value: 'value',
  website: 'website',
  linkedinUrl: 'linkedinUrl',
  city: 'city',
  country: 'country',
  timezone: 'timezone',
  notes: 'notes',
  tags: 'tags',
  lastContactedAt: 'lastContactedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.LeadListScalarFieldEnum = {
  id: 'id',
  ownerId: 'ownerId',
  name: 'name',
  description: 'description',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.LeadListMemberScalarFieldEnum = {
  id: 'id',
  listId: 'listId',
  leadId: 'leadId',
  addedAt: 'addedAt'
};

exports.Prisma.LeadCallScalarFieldEnum = {
  id: 'id',
  ownerId: 'ownerId',
  leadId: 'leadId',
  listId: 'listId',
  vapiCallId: 'vapiCallId',
  status: 'status',
  endedReason: 'endedReason',
  summary: 'summary',
  transcript: 'transcript',
  recordingUrl: 'recordingUrl',
  startedAt: 'startedAt',
  endedAt: 'endedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.JsonNullValueInput = {
  JsonNull: Prisma.JsonNull
};

exports.Prisma.NullableJsonNullValueInput = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last'
};

exports.Prisma.JsonNullValueFilter = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull,
  AnyNull: Prisma.AnyNull
};
exports.Role = exports.$Enums.Role = {
  student: 'student',
  mentor: 'mentor',
  admin: 'admin'
};

exports.UserStatus = exports.$Enums.UserStatus = {
  pending: 'pending',
  active: 'active',
  suspended: 'suspended'
};

exports.RoadmapStatus = exports.$Enums.RoadmapStatus = {
  active: 'active',
  archived: 'archived',
  superseded: 'superseded'
};

exports.RoadmapItemType = exports.$Enums.RoadmapItemType = {
  topic: 'topic',
  project: 'project',
  assessment: 'assessment',
  session: 'session',
  reading: 'reading',
  practice: 'practice'
};

exports.RoadmapItemStatus = exports.$Enums.RoadmapItemStatus = {
  locked: 'locked',
  available: 'available',
  in_progress: 'in_progress',
  completed: 'completed',
  skipped: 'skipped'
};

exports.RoadmapTestStatus = exports.$Enums.RoadmapTestStatus = {
  ready: 'ready',
  in_progress: 'in_progress',
  completed: 'completed'
};

exports.RoadmapTestQuestionType = exports.$Enums.RoadmapTestQuestionType = {
  single_choice: 'single_choice',
  multi_choice: 'multi_choice'
};

exports.AssignmentStatus = exports.$Enums.AssignmentStatus = {
  ready: 'ready',
  completed: 'completed'
};

exports.EducationLevel = exports.$Enums.EducationLevel = {
  high_school: 'high_school',
  undergrad: 'undergrad',
  postgrad: 'postgrad',
  doctoral: 'doctoral',
  working_professional: 'working_professional',
  self_taught: 'self_taught'
};

exports.ExperienceLevel = exports.$Enums.ExperienceLevel = {
  none: 'none',
  intern: 'intern',
  under_one: 'under_one',
  one_to_three: 'one_to_three',
  three_to_five: 'three_to_five',
  five_plus: 'five_plus'
};

exports.CareerGoal = exports.$Enums.CareerGoal = {
  first_job: 'first_job',
  switch_company: 'switch_company',
  fang_prep: 'fang_prep',
  startup_join: 'startup_join',
  freelance: 'freelance',
  upskill: 'upskill'
};

exports.SkillCategory = exports.$Enums.SkillCategory = {
  language: 'language',
  framework: 'framework',
  tool: 'tool',
  concept: 'concept',
  dsa: 'dsa',
  system_design: 'system_design',
  soft_skill: 'soft_skill',
  domain: 'domain'
};

exports.QuestionType = exports.$Enums.QuestionType = {
  single_choice: 'single_choice',
  multi_choice: 'multi_choice',
  numeric: 'numeric',
  short_text: 'short_text'
};

exports.TemplateType = exports.$Enums.TemplateType = {
  initial: 'initial',
  periodic: 'periodic',
  topic: 'topic'
};

exports.AttemptStatus = exports.$Enums.AttemptStatus = {
  in_progress: 'in_progress',
  completed: 'completed',
  abandoned: 'abandoned',
  auto_completed: 'auto_completed'
};

exports.AuthProvider = exports.$Enums.AuthProvider = {
  email: 'email',
  google: 'google',
  github: 'github'
};

exports.Prisma.ModelName = {
  User: 'User',
  Module: 'Module',
  AccessRole: 'AccessRole',
  RolePermission: 'RolePermission',
  Plan: 'Plan',
  PlanModule: 'PlanModule',
  RecommendationLog: 'RecommendationLog',
  Roadmap: 'Roadmap',
  RoadmapWeek: 'RoadmapWeek',
  RoadmapItem: 'RoadmapItem',
  RoadmapSubtopic: 'RoadmapSubtopic',
  RoadmapTest: 'RoadmapTest',
  RoadmapTestQuestion: 'RoadmapTestQuestion',
  RoadmapTestAnswer: 'RoadmapTestAnswer',
  RoadmapTestResult: 'RoadmapTestResult',
  Assignment: 'Assignment',
  StudentProfile: 'StudentProfile',
  NotificationPreferences: 'NotificationPreferences',
  FeatureFlag: 'FeatureFlag',
  Skill: 'Skill',
  Question: 'Question',
  QuestionSkill: 'QuestionSkill',
  AssessmentTemplate: 'AssessmentTemplate',
  AssessmentAttempt: 'AssessmentAttempt',
  AssessmentAnswer: 'AssessmentAnswer',
  SkillScore: 'SkillScore',
  SkillScoreHistory: 'SkillScoreHistory',
  AuthIdentity: 'AuthIdentity',
  Session: 'Session',
  LiveSession: 'LiveSession',
  SessionParticipant: 'SessionParticipant',
  ChatMessage: 'ChatMessage',
  WatchProgress: 'WatchProgress',
  Job: 'Job',
  Lead: 'Lead',
  LeadList: 'LeadList',
  LeadListMember: 'LeadListMember',
  LeadCall: 'LeadCall'
};

/**
 * This is a stub Prisma Client that will error at runtime if called.
 */
class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        let message
        const runtime = getRuntime()
        if (runtime.isEdge) {
          message = `PrismaClient is not configured to run in ${runtime.prettyName}. In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate: https://pris.ly/d/accelerate
- Use Driver Adapters: https://pris.ly/d/driver-adapters
`;
        } else {
          message = 'PrismaClient is unable to run in this browser environment, or has been bundled for the browser (running in `' + runtime.prettyName + '`).'
        }
        
        message += `
If this is unexpected, please open an issue: https://pris.ly/prisma-prisma-bug-report`

        throw new Error(message)
      }
    })
  }
}

exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)
