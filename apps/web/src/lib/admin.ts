import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AdminModule,
  AdminPlan,
  AdminRole,
  AdminRolePermission,
  AdminUser,
} from '@mentra/shared';
import { apiFetch } from './api.js';

const base = '/api/v1/admin';

export function useAdminModules() {
  return useQuery({ queryKey: ['admin', 'modules'], queryFn: () => apiFetch<AdminModule[]>(`${base}/modules`) });
}

export function useSaveModule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (m: AdminModule) => apiFetch(`${base}/modules`, { method: 'POST', body: JSON.stringify(m) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'modules'] });
      qc.invalidateQueries({ queryKey: ['me', 'modules'] });
    },
  });
}

export function useDeleteModule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (key: string) =>
      apiFetch(`${base}/modules/${encodeURIComponent(key)}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'modules'] });
      qc.invalidateQueries({ queryKey: ['me', 'modules'] });
    },
  });
}

export function useAdminRoles() {
  return useQuery({ queryKey: ['admin', 'roles'], queryFn: () => apiFetch<AdminRole[]>(`${base}/roles`) });
}

export function useSaveRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (r: { id: string; label: string; description: string | null; isAdmin: boolean }) =>
      apiFetch(`${base}/roles`, { method: 'POST', body: JSON.stringify(r) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'roles'] }),
  });
}

export function useRolePermissions(roleId: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'role-permissions', roleId],
    queryFn: () => apiFetch<AdminRolePermission[]>(`${base}/role-permissions?roleId=${encodeURIComponent(roleId!)}`),
    enabled: Boolean(roleId),
  });
}

export function useSetRolePermission(roleId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: { moduleKey: string; canRead: boolean; canWrite: boolean }) =>
      apiFetch(`${base}/role-permissions`, { method: 'POST', body: JSON.stringify({ roleId, ...p }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'role-permissions', roleId] });
      qc.invalidateQueries({ queryKey: ['me', 'modules'] });
    },
  });
}

export function useAdminPlans() {
  return useQuery({ queryKey: ['admin', 'plans'], queryFn: () => apiFetch<AdminPlan[]>(`${base}/plans`) });
}

export function useSavePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: {
      id: string;
      name: string;
      description: string | null;
      priceCents: number;
      active: boolean;
      roleId: string | null;
      moduleKeys: string[];
    }) => apiFetch(`${base}/plans`, { method: 'POST', body: JSON.stringify(p) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'plans'] });
      qc.invalidateQueries({ queryKey: ['me', 'modules'] });
    },
  });
}

export function useAdminUsers() {
  return useQuery({ queryKey: ['admin', 'users'], queryFn: () => apiFetch<AdminUser[]>(`${base}/users`) });
}

export function useAssignUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (a: { userId: string; roleId: string | null; planId: string | null }) =>
      apiFetch(`${base}/users/assign`, { method: 'POST', body: JSON.stringify(a) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
}
