import { motion } from 'framer-motion';
import { Boxes, CreditCard, ShieldCheck, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge, Card, StatCard } from '@mentra/ui';
import { useAdminModules, useAdminPlans, useAdminRoles, useAdminUsers } from '../../lib/admin.js';

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 320, damping: 28 } },
};

export function AdminDashboard() {
  const navigate = useNavigate();
  const { data: users } = useAdminUsers();
  const { data: roles } = useAdminRoles();
  const { data: plans } = useAdminPlans();
  const { data: modules } = useAdminModules();

  const recent = (users ?? []).slice(0, 6);

  const manage = [
    { label: 'Roles & permissions', desc: 'Read/write access per role', icon: <ShieldCheck className="size-4" />, href: '/admin/roles' },
    { label: 'Subscriptions', desc: 'Plans and included modules', icon: <CreditCard className="size-4" />, href: '/admin/subscriptions' },
    { label: 'Modules', desc: 'Enable / hide platform modules', icon: <Boxes className="size-4" />, href: '/admin/modules' },
    { label: 'Users', desc: 'Assign roles and plans', icon: <Users className="size-4" />, href: '/admin/users' },
  ];

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05 } } }}
      className="mx-auto max-w-8xl space-y-5"
    >
      <motion.div variants={fadeUp}>
        <h1 className="text-display-md tracking-normal">Admin overview</h1>
        <p className="mt-1 text-sm text-ink-muted">Manage users, roles, subscriptions, and platform modules.</p>
      </motion.div>

      {/* Platform stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <motion.div variants={fadeUp}><StatCard inverse value={String(users?.length ?? 0)} label="Users" /></motion.div>
        <motion.div variants={fadeUp}><StatCard value={String(roles?.length ?? 0)} label="Roles" /></motion.div>
        <motion.div variants={fadeUp}><StatCard value={String(plans?.length ?? 0)} label="Subscriptions" /></motion.div>
        <motion.div variants={fadeUp}><StatCard value={String(modules?.length ?? 0)} label="Modules" /></motion.div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Management quick links */}
        <motion.div className="col-span-12 lg:col-span-7" variants={fadeUp}>
          <Card className="h-full">
            <h3 className="mb-4 text-sm font-medium text-ink">Manage</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {manage.map((m) => (
                <button
                  key={m.href}
                  type="button"
                  onClick={() => navigate(m.href)}
                  className="flex items-center gap-3 rounded-md bg-surface-sunken p-4 text-left ring-1 ring-border-subtle transition hover:ring-border-strong"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-md bg-surface-raised text-ink">{m.icon}</span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-ink">{m.label}</span>
                    <span className="block text-xs text-ink-faint">{m.desc}</span>
                  </span>
                </button>
              ))}
            </div>
          </Card>
        </motion.div>

        {/* Recent signups */}
        <motion.div className="col-span-12 lg:col-span-5" variants={fadeUp}>
          <Card className="h-full">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-medium text-ink">Recent signups</h3>
              <Badge variant="outline" size="md">{users?.length ?? 0} total</Badge>
            </div>
            <div className="space-y-2">
              {recent.length === 0 ? (
                <p className="text-sm text-ink-muted">No users yet.</p>
              ) : (
                recent.map((u) => (
                  <div key={u.id} className="flex items-center justify-between gap-3 rounded-md bg-surface-sunken p-3 ring-1 ring-border-subtle">
                    <div className="min-w-0">
                      <div className="truncate text-sm text-ink">{u.name}</div>
                      <div className="truncate text-xs text-ink-faint">{u.email}</div>
                    </div>
                    <span className="shrink-0 rounded-sm bg-surface-raised px-2 py-0.5 text-[10px] text-ink-muted ring-1 ring-border-subtle">
                      {u.roleId ?? u.role}
                    </span>
                  </div>
                ))
              )}
            </div>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}
