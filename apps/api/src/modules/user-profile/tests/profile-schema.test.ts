import { describe, expect, it } from 'vitest';
import {
  notificationPrefsPatchSchema,
  onboardingStepSchemas,
  profilePatchSchema,
} from '@mentra/shared';

describe('profilePatchSchema', () => {
  it('accepts a valid partial patch', () => {
    const result = profilePatchSchema.safeParse({ city: 'Pune', studyHoursPerDay: 4 });
    expect(result.success).toBe(true);
  });

  it('rejects studyHoursPerDay outside 1..16', () => {
    expect(profilePatchSchema.safeParse({ studyHoursPerDay: 0 }).success).toBe(false);
    expect(profilePatchSchema.safeParse({ studyHoursPerDay: 17 }).success).toBe(false);
  });

  it('rejects a github URL on a non-allowlisted host', () => {
    expect(profilePatchSchema.safeParse({ githubUrl: 'https://evil.com/u' }).success).toBe(false);
  });

  it('rejects non-https links', () => {
    expect(profilePatchSchema.safeParse({ githubUrl: 'http://github.com/u' }).success).toBe(false);
  });

  it('accepts a valid github URL and x.com twitter URL', () => {
    expect(profilePatchSchema.safeParse({ githubUrl: 'https://github.com/octocat' }).success).toBe(true);
    expect(profilePatchSchema.safeParse({ twitterUrl: 'https://x.com/jack' }).success).toBe(true);
  });

  it('caps techStack at 30 entries', () => {
    const tags = Array.from({ length: 31 }, (_, i) => `skill-${i}`);
    expect(profilePatchSchema.safeParse({ techStack: tags }).success).toBe(false);
  });

  it('rejects graduationYear before 1970', () => {
    expect(profilePatchSchema.safeParse({ graduationYear: 1969 }).success).toBe(false);
  });
});

describe('onboardingStepSchemas', () => {
  it('step 1 requires timezone', () => {
    expect(onboardingStepSchemas[1].safeParse({}).success).toBe(false);
    expect(onboardingStepSchemas[1].safeParse({ timezone: 'Asia/Kolkata' }).success).toBe(true);
  });

  it('step 2 requires education + experience level', () => {
    expect(onboardingStepSchemas[2].safeParse({ educationLevel: 'undergrad' }).success).toBe(false);
    expect(
      onboardingStepSchemas[2].safeParse({ educationLevel: 'undergrad', experienceLevel: 'none' }).success,
    ).toBe(true);
  });

  it('step 3 requires goal + at least one target role', () => {
    expect(onboardingStepSchemas[3].safeParse({ goal: 'first_job', targetRoles: [] }).success).toBe(false);
    expect(
      onboardingStepSchemas[3].safeParse({ goal: 'first_job', targetRoles: ['frontend'] }).success,
    ).toBe(true);
  });

  it('step 4 requires at least one skill', () => {
    expect(onboardingStepSchemas[4].safeParse({ techStack: [] }).success).toBe(false);
    expect(onboardingStepSchemas[4].safeParse({ techStack: ['react'] }).success).toBe(true);
  });
});

describe('notificationPrefsPatchSchema', () => {
  it('accepts partial boolean flags', () => {
    expect(notificationPrefsPatchSchema.safeParse({ emailDailyTasks: false }).success).toBe(true);
  });

  it('rejects non-boolean values', () => {
    expect(notificationPrefsPatchSchema.safeParse({ emailDailyTasks: 'yes' }).success).toBe(false);
  });
});
