import { z } from 'zod';

// --- Enums (mirror DB enums in apps/api/prisma/schema.prisma) ---

export const EducationLevelSchema = z.enum([
  'high_school',
  'undergrad',
  'postgrad',
  'doctoral',
  'working_professional',
  'self_taught',
]);
export type EducationLevel = z.infer<typeof EducationLevelSchema>;

export const ExperienceLevelSchema = z.enum([
  'none',
  'intern',
  'under_one',
  'one_to_three',
  'three_to_five',
  'five_plus',
]);
export type ExperienceLevel = z.infer<typeof ExperienceLevelSchema>;

export const CareerGoalSchema = z.enum([
  'first_job',
  'switch_company',
  'fang_prep',
  'startup_join',
  'freelance',
  'upskill',
]);
export type CareerGoal = z.infer<typeof CareerGoalSchema>;

export const CompanyTypeSchema = z.enum([
  'startup',
  'mnc',
  'product',
  'service',
  'government',
  'remote',
]);
export type CompanyType = z.infer<typeof CompanyTypeSchema>;

// --- URL validation helpers ---

const currentYear = new Date().getUTCFullYear();

/** https-only URL, optionally pinned to an allowlist of hostnames (incl. subdomains). */
function urlField(allowHosts?: string[]) {
  return z
    .string()
    .trim()
    .max(512)
    .url()
    .refine((value) => {
      let parsed: URL;
      try {
        parsed = new URL(value);
      } catch {
        return false;
      }
      if (parsed.protocol !== 'https:') return false;
      if (!allowHosts) return true;
      const host = parsed.hostname.toLowerCase();
      return allowHosts.some((h) => host === h || host.endsWith(`.${h}`));
    }, 'Must be an https URL on an allowed domain');
}

export const githubUrlSchema = urlField(['github.com']);
export const linkedinUrlSchema = urlField(['linkedin.com']);
export const twitterUrlSchema = urlField(['twitter.com', 'x.com']);
export const portfolioUrlSchema = urlField(); // any https host
export const avatarUrlSchema = urlField();

// --- Field schemas reused by profile + onboarding ---

const techStackSchema = z.array(z.string().trim().min(1).max(60)).max(30);
const targetRolesSchema = z.array(z.string().trim().min(1).max(60)).min(1).max(5);
const preferredCompanyTypeSchema = z.array(CompanyTypeSchema).max(6);

/** Full set of editable profile fields. All optional; PATCH applies partials. */
export const profilePatchSchema = z
  .object({
    avatarUrl: avatarUrlSchema.nullable(),
    bio: z.string().trim().max(500).nullable(),

    country: z.string().trim().max(100).nullable(),
    city: z.string().trim().max(120).nullable(),
    timezone: z.string().trim().min(1).max(64),

    educationLevel: EducationLevelSchema.nullable(),
    collegeName: z.string().trim().max(200).nullable(),
    graduationYear: z.number().int().min(1970).max(currentYear + 10).nullable(),

    experienceLevel: ExperienceLevelSchema.nullable(),
    currentRole: z.string().trim().max(150).nullable(),
    currentCompany: z.string().trim().max(150).nullable(),

    goal: CareerGoalSchema.nullable(),
    preferredCompanyType: preferredCompanyTypeSchema,
    targetRoles: targetRolesSchema,
    studyHoursPerDay: z.number().int().min(1).max(16).nullable(),

    techStack: techStackSchema,

    githubUrl: githubUrlSchema.nullable(),
    linkedinUrl: linkedinUrlSchema.nullable(),
    portfolioUrl: portfolioUrlSchema.nullable(),
    twitterUrl: twitterUrlSchema.nullable(),
  })
  .partial();
export type ProfilePatchInput = z.infer<typeof profilePatchSchema>;

// --- Onboarding step state machine (4 steps) ---

export const onboardingStepSchemas = {
  1: z.object({
    avatarUrl: avatarUrlSchema.nullable().optional(),
    city: z.string().trim().max(120).optional(),
    country: z.string().trim().max(100).optional(),
    timezone: z.string().trim().min(1).max(64),
  }),
  2: z.object({
    educationLevel: EducationLevelSchema,
    collegeName: z.string().trim().max(200).optional(),
    graduationYear: z.number().int().min(1970).max(currentYear + 10).optional(),
    experienceLevel: ExperienceLevelSchema,
    currentRole: z.string().trim().max(150).optional(),
    currentCompany: z.string().trim().max(150).optional(),
  }),
  3: z.object({
    goal: CareerGoalSchema,
    targetRoles: targetRolesSchema,
    preferredCompanyType: preferredCompanyTypeSchema.optional(),
    studyHoursPerDay: z.number().int().min(1).max(16).optional(),
  }),
  4: z.object({
    techStack: techStackSchema.refine((tags) => tags.length >= 1, 'Pick at least one skill'),
  }),
} as const;

export type OnboardingStepNumber = 1 | 2 | 3 | 4;
export const ONBOARDING_TOTAL_STEPS = 4 as const;

export const onboardingStepRequestSchema = z.object({
  step: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  fields: z.record(z.unknown()),
});
export type OnboardingStepRequest = z.infer<typeof onboardingStepRequestSchema>;

// --- Notification preferences ---

export const notificationPrefsPatchSchema = z
  .object({
    emailDailyTasks: z.boolean(),
    emailWeeklyReview: z.boolean(),
    emailSessionReminders: z.boolean(),
    emailAnnouncements: z.boolean(),
    inAppEnabled: z.boolean(),
  })
  .partial();
export type NotificationPrefsPatchInput = z.infer<typeof notificationPrefsPatchSchema>;
