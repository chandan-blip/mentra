import {
  ONBOARDING_TOTAL_STEPS,
  type OnboardingStepNumber,
  onboardingStepSchemas,
} from '@mentra/shared';
import { emit } from '../../core/events.js';
import { logger } from '../../logger.js';
import { unknownSkillIds } from './skills.service.js';
import { ProfileError, ensureProfile } from './user-profile.service.js';
import { findProfileByUserId, setOnboarding, updateProfileFields } from './user-profile.repository.js';

export type OnboardingResult = { onboardingStep: number; onboardingComplete: boolean };

/**
 * Apply one onboarding step: validate the step's fields, persist them, advance
 * the step counter (never regresses), and complete on the final step.
 */
export async function submitOnboardingStep(
  userId: string,
  step: OnboardingStepNumber,
  fields: Record<string, unknown>,
): Promise<OnboardingResult> {
  const current = await ensureProfile(userId);
  if (current.onboardingComplete) {
    return { onboardingStep: current.onboardingStep, onboardingComplete: true };
  }

  const schema = onboardingStepSchemas[step];
  const parsed = schema.parse(fields);

  if (step === ONBOARDING_TOTAL_STEPS) {
    const unknown = unknownSkillIds((parsed as { techStack: string[] }).techStack);
    if (unknown.length > 0) {
      throw new ProfileError('UNKNOWN_SKILLS', `Unknown skill ids: ${unknown.join(', ')}`, 400);
    }
  }

  await updateProfileFields(userId, parsed as Record<string, unknown>);

  const nextStep = Math.max(current.onboardingStep, step);
  const complete = step === ONBOARDING_TOTAL_STEPS;
  await setOnboarding(userId, nextStep, complete);

  logger.info({ userId, step, complete }, 'profile.onboarding.step_completed');

  if (complete) {
    const completedAt = new Date().toISOString();
    logger.info({ userId, completedAt }, 'profile.onboarding.completed');
    emit('student-profile.onboarding-completed', { userId, completedAt });
  }

  const refreshed = await findProfileByUserId(userId);
  return {
    onboardingStep: refreshed?.onboardingStep ?? nextStep,
    onboardingComplete: refreshed ? refreshed.onboardingComplete === true || refreshed.onboardingComplete === 1 : complete,
  };
}
