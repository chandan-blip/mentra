import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  NotificationPreferencesView,
  NotificationPrefsPatchInput,
  ProfileMeView,
  ProfilePatchInput,
  SkillCatalogueEntry,
  StudentProfileView,
} from '@mentra/shared';
import { apiFetch } from './api.js';

const profileKey = ['profile', 'me'] as const;

export function useProfile() {
  return useQuery({
    queryKey: profileKey,
    queryFn: () => apiFetch<ProfileMeView>('/api/v1/profile/me'),
  });
}

export function usePatchProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ProfilePatchInput) =>
      apiFetch<StudentProfileView>('/api/v1/profile/me', {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    onSuccess: (profile) => {
      qc.setQueryData<ProfileMeView>(profileKey, (prev) =>
        prev ? { ...prev, profile } : prev,
      );
    },
  });
}

export type OnboardingResult = { onboardingStep: number; onboardingComplete: boolean };

export function useSubmitOnboardingStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { step: 1 | 2 | 3 | 4; fields: Record<string, unknown> }) =>
      apiFetch<OnboardingResult>('/api/v1/profile/me/onboarding/step', {
        method: 'POST',
        body: JSON.stringify(args),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: profileKey }),
  });
}

export function useNotificationPrefs() {
  return useQuery({
    queryKey: ['profile', 'notifications'],
    queryFn: () => apiFetch<NotificationPreferencesView>('/api/v1/profile/me/notifications'),
  });
}

export function usePatchNotificationPrefs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NotificationPrefsPatchInput) =>
      apiFetch<NotificationPreferencesView>('/api/v1/profile/me/notifications', {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    onSuccess: (data) => qc.setQueryData(['profile', 'notifications'], data),
  });
}

export function useSkillSearch(query: string) {
  return useQuery({
    queryKey: ['skills', query],
    queryFn: () =>
      apiFetch<SkillCatalogueEntry[]>(
        `/api/v1/profile/skills/catalogue${query ? `?q=${encodeURIComponent(query)}` : ''}`,
      ),
    staleTime: 5 * 60_000,
  });
}

// --- Resume upload (PDF bytes posted straight to the API) ---

type StoreResult = { resumeFileKey: string; resumeUploadedAt: string };

export function useUploadResume() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File): Promise<StoreResult> =>
      apiFetch<StoreResult>('/api/v1/profile/me/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/pdf' },
        body: file,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: profileKey }),
  });
}

export function useDeleteResume() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<void>('/api/v1/profile/me/resume', { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: profileKey }),
  });
}

// --- Profile picture (image bytes posted straight to the API) ---

type AvatarResult = { avatarUrl: string };

/** Invalidate the surfaces that render the user's avatar after an upload/remove. */
function invalidateAvatar(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: profileKey });
  qc.invalidateQueries({ queryKey: ['mentor', 'my-profile'] });
}

export function useUploadAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File): Promise<AvatarResult> =>
      apiFetch<AvatarResult>('/api/v1/profile/me/avatar', {
        method: 'POST',
        headers: { 'Content-Type': file.type },
        body: file,
      }),
    onSuccess: () => invalidateAvatar(qc),
  });
}

export function useDeleteAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<void>('/api/v1/profile/me/avatar', { method: 'DELETE' }),
    onSuccess: () => invalidateAvatar(qc),
  });
}
