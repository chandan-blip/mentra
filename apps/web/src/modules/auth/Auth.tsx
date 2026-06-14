import { type FormEvent, useMemo, useState } from 'react';
import { ArrowRight, Github, GraduationCap, Lock, Mail, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getApiBaseUrl, storeAuthSession } from '../../lib/auth.js';

type AuthMode = 'signin' | 'signup';
type AuthPanel = AuthMode | 'forgot' | 'reset';

const passwordHelp = 'Minimum 8 characters';

export function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthPanel>('signin');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'error' | 'sent' | 'reset_done'>('idle');
  const [error, setError] = useState('');

  const isSignup = mode === 'signup';
  const isForgot = mode === 'forgot';
  const isReset = mode === 'reset';
  const title = getTitle(mode);
  const actionLabel = getActionLabel(mode);

  const canSubmit = useMemo(() => {
    if (isForgot) return email.trim().length > 0;
    if (isReset) return resetToken.trim().length > 0 && newPassword.length >= 8;
    const hasIdentity = email.trim().length > 0 && password.length >= 8;
    return isSignup ? hasIdentity && fullName.trim().length > 1 : hasIdentity;
  }, [email, fullName, isForgot, isReset, isSignup, newPassword, password, resetToken]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || status === 'submitting') return;

    setStatus('submitting');
    setError('');

    try {
      if (isForgot) {
        const response = await fetch(`${getApiBaseUrl()}/api/v1/auth/password/forgot`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email: email.trim() }),
        });

        const body = (await response.json()) as ForgotPasswordResponse;
        if (!response.ok || !body.data) {
          throw new Error(body.error?.message ?? 'Unable to send reset instructions');
        }

        if (body.data.resetToken) {
          setResetToken(body.data.resetToken);
          setMode('reset');
        }
        setStatus('sent');
        return;
      }

      if (isReset) {
        const response = await fetch(`${getApiBaseUrl()}/api/v1/auth/password/reset`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ token: resetToken.trim(), newPassword }),
        });

        const body = (await response.json()) as ResetPasswordResponse;
        if (!response.ok || !body.data?.reset) {
          throw new Error(body.error?.message ?? 'Unable to reset password');
        }

        setPassword('');
        setNewPassword('');
        setResetToken('');
        setMode('signin');
        setStatus('reset_done');
        return;
      }

      const endpoint = isSignup ? '/api/v1/auth/signup' : '/api/v1/auth/login';
      const response = await fetch(`${getApiBaseUrl()}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(
          isSignup
            ? { name: fullName.trim(), email: email.trim(), password }
            : { email: email.trim(), password, rememberMe: remember },
        ),
      });

      const body = (await response.json()) as AuthResponse;
      if (!response.ok || !body.data) {
        throw new Error(body.error?.message ?? 'Unable to continue');
      }

      storeAuthSession(body.data);
      navigate('/dashboard');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Unable to continue');
    }
  }

  return (
    <main className="min-h-full bg-canvas text-ink">
      <div className="grid min-h-screen lg:grid-cols-[minmax(420px,0.78fr)_1.22fr]">
        <section className="flex min-h-screen items-center px-5 py-8 sm:px-8 lg:px-12">
          <div className="mx-auto w-full max-w-[440px]">
            <div className="mb-10 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-md bg-surface-inverse text-ink-inverse">
                <GraduationCap className="size-5" />
              </div>
              <div>
                <div className="text-lg font-semibold">Mentra</div>
                <div className="text-sm text-ink-muted">Career OS for software engineers</div>
              </div>
            </div>

            <div className="mb-8">
              <div className="mb-4 inline-grid grid-cols-2 rounded-md bg-surface-sunken p-1 ring-1 ring-border-subtle">
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin');
                    setStatus('idle');
                    setError('');
                  }}
                  className={tabClass(mode === 'signin')}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup');
                    setStatus('idle');
                    setError('');
                  }}
                  className={tabClass(mode === 'signup')}
                >
                  Sign up
                </button>
              </div>
              <h1 className="text-display-md tracking-normal text-ink">{title}</h1>
              <p className="mt-3 max-w-sm text-sm leading-6 text-ink-muted">
                {getSubtitle(mode)}
              </p>
            </div>

            {!isForgot && !isReset ? (
              <>
                <div className="mb-5 grid grid-cols-2 gap-3">
                  <button type="button" className="auth-social-button">
                    <Github className="size-4" />
                    GitHub
                  </button>
                  <button type="button" className="auth-social-button">
                    <GoogleMark />
                    Google
                  </button>
                </div>

                <div className="mb-5 flex items-center gap-3 text-xs text-ink-faint">
                  <span className="h-px flex-1 bg-border-subtle" />
                  <span>Email</span>
                  <span className="h-px flex-1 bg-border-subtle" />
                </div>
              </>
            ) : null}

            <form onSubmit={handleSubmit} className="space-y-4">
              {isSignup ? (
                <label className="block">
                  <span className="mb-2 block text-sm text-ink-muted">Full name</span>
                  <span className="auth-input-wrap">
                    <UserRound className="size-4 text-ink-faint" />
                    <input
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      className="auth-input"
                      autoComplete="name"
                      placeholder="Aarav Sharma"
                    />
                  </span>
                </label>
              ) : null}

              {!isReset ? (
                <label className="block">
                <span className="mb-2 block text-sm text-ink-muted">Email</span>
                <span className="auth-input-wrap">
                  <Mail className="size-4 text-ink-faint" />
                  <input
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="auth-input"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                  />
                </span>
              </label>
              ) : null}

              {!isForgot && !isReset ? (
                <label className="block">
                <span className="mb-2 flex items-center justify-between text-sm text-ink-muted">
                  <span>Password</span>
                  <span className="text-xs text-ink-faint">{passwordHelp}</span>
                </span>
                <span className="auth-input-wrap">
                  <Lock className="size-4 text-ink-faint" />
                  <input
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="auth-input"
                    type="password"
                    autoComplete={isSignup ? 'new-password' : 'current-password'}
                    placeholder="********"
                  />
                </span>
              </label>
              ) : null}

              {isReset ? (
                <>
                  <label className="block">
                    <span className="mb-2 block text-sm text-ink-muted">Reset token</span>
                    <span className="auth-input-wrap">
                      <Lock className="size-4 text-ink-faint" />
                      <input
                        value={resetToken}
                        onChange={(event) => setResetToken(event.target.value)}
                        className="auth-input"
                        autoComplete="one-time-code"
                        placeholder="Paste reset token"
                      />
                    </span>
                  </label>
                  <label className="block">
                    <span className="mb-2 flex items-center justify-between text-sm text-ink-muted">
                      <span>New password</span>
                      <span className="text-xs text-ink-faint">{passwordHelp}</span>
                    </span>
                    <span className="auth-input-wrap">
                      <Lock className="size-4 text-ink-faint" />
                      <input
                        value={newPassword}
                        onChange={(event) => setNewPassword(event.target.value)}
                        className="auth-input"
                        type="password"
                        autoComplete="new-password"
                        placeholder="********"
                      />
                    </span>
                  </label>
                </>
              ) : null}

              {!isSignup ? (
                <div className="flex items-center justify-between text-sm">
                  {mode === 'signin' ? (
                    <label className="flex items-center gap-2 text-ink-muted">
                    <input
                      checked={remember}
                      onChange={(event) => setRemember(event.target.checked)}
                      type="checkbox"
                      className="h-4 w-4 rounded-sm border-border bg-surface-sunken text-ink focus:ring-border-strong"
                    />
                    Remember me
                  </label>
                  ) : <span />}
                  <button
                    type="button"
                    onClick={() => {
                      setMode(mode === 'signin' ? 'forgot' : 'signin');
                      setStatus('idle');
                      setError('');
                    }}
                    className="text-ink hover:text-ink-muted"
                  >
                    {mode === 'signin' ? 'Forgot password?' : 'Back to sign in'}
                  </button>
                </div>
              ) : null}

              {status === 'sent' && isReset ? (
                <div className="rounded-md bg-surface-raised px-4 py-3 text-sm text-ink-muted ring-1 ring-border-subtle">
                  Dev reset token has been generated. Set your new password below.
                </div>
              ) : null}

              {status === 'sent' && isForgot ? (
                <div className="rounded-md bg-surface-raised px-4 py-3 text-sm text-ink-muted ring-1 ring-border-subtle">
                  If this email exists, reset instructions have been prepared.
                </div>
              ) : null}

              {status === 'reset_done' ? (
                <div className="rounded-md bg-surface-raised px-4 py-3 text-sm text-accent-green ring-1 ring-border-subtle">
                  Password updated. Sign in with your new password.
                </div>
              ) : null}

              {status === 'error' ? (
                <div className="rounded-md bg-surface-raised px-4 py-3 text-sm text-accent-red ring-1 ring-border-subtle">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={!canSubmit || status === 'submitting'}
                className="group flex h-12 w-full items-center justify-center gap-2 rounded-md bg-surface-inverse px-4 text-sm font-semibold text-ink-inverse transition hover:bg-ink disabled:cursor-not-allowed disabled:opacity-45"
              >
                {status === 'submitting' ? 'Please wait...' : actionLabel}
                <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
              </button>
            </form>
          </div>
        </section>

        <section className="hidden min-h-screen border-l border-border-subtle bg-surface-sunken p-2 lg:block">
          <div className="relative h-full overflow-hidden rounded-lg bg-canvas-deep">
            <AuthMotionBackdrop />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,5,5,0.68),rgba(5,5,5,0.18)),linear-gradient(0deg,rgba(5,5,5,0.78),rgba(5,5,5,0.08)_45%)]" />
            <div className="absolute bottom-0 left-0 right-0 p-10">
              <div className="mb-5 flex w-fit items-center gap-2 rounded-md bg-surface/80 px-3 py-2 text-xs text-ink-muted ring-1 ring-border backdrop-blur">
                <span className="h-2 w-2 rounded-full bg-accent-green" />
                Phase 1: profile, assessment, dashboard
              </div>
              <div className="max-w-xl text-display-lg tracking-normal">
                Measure your skills. Build the next week from evidence.
              </div>
              <div className="mt-6 grid max-w-2xl grid-cols-3 gap-3">
                <Metric value="30" label="MCQ baseline" />
                <Metric value="8" label="core skills" />
                <Metric value="1" label="personal roadmap" />
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

const NEON_ROUTES = [
  { d: 'M120 240 H360 V360 H520 V200 H760 V440 H880', color: '#22d3ee', dur: '9s', pulse: '90 1500' },
  { d: 'M120 520 H280 V680 H520 V520 H680 V760 H880', color: '#a855f7', dur: '11s', pulse: '90 1500' },
  { d: 'M200 880 V640 H440 V480 H600 V320 H840 V120', color: '#34d399', dur: '13s', pulse: '90 1500' },
];

function AuthMotionBackdrop() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[radial-gradient(circle_at_15%_15%,rgba(34,211,238,0.14),transparent_40%),radial-gradient(circle_at_85%_85%,rgba(168,85,247,0.14),transparent_40%),linear-gradient(140deg,#04060a_0%,#070b14_55%,#04060a_100%)]">
      <svg
        viewBox="0 0 1000 1000"
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <pattern id="microGrid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M40 0 H0 V40" fill="none" stroke="#13202f" strokeWidth="0.5" />
          </pattern>
        </defs>

        <rect x="0" y="0" width="1000" height="1000" fill="url(#microGrid)" opacity="0.5" />

        {NEON_ROUTES.map((route) => (
          <g key={route.color} filter="url(#neonGlow)">
            <path
              d={route.d}
              stroke={route.color}
              strokeWidth="1"
              strokeLinecap="square"
              strokeLinejoin="miter"
              fill="none"
              opacity="0.28"
            />
            <path
              d={route.d}
              stroke={route.color}
              strokeWidth="1.6"
              strokeLinecap="square"
              strokeLinejoin="miter"
              fill="none"
              strokeDasharray={route.pulse}
            >
              <animate
                attributeName="stroke-dashoffset"
                from="0"
                to="-1590"
                dur={route.dur}
                repeatCount="indefinite"
              />
            </path>
          </g>
        ))}
      </svg>
    </div>
  );
}

type AuthResponse = {
  data?: {
    accessToken: string;
    user: {
      id: string;
      email: string;
      name: string;
      role: 'student' | 'mentor' | 'admin';
    };
  };
  error?: {
    code: string;
    message: string;
  };
};

type ForgotPasswordResponse = {
  data?: {
    sent: boolean;
    resetToken?: string;
    expiresInMinutes?: number;
  };
  error?: {
    code: string;
    message: string;
  };
};

type ResetPasswordResponse = {
  data?: {
    reset: boolean;
  };
  error?: {
    code: string;
    message: string;
  };
};

function getTitle(mode: AuthPanel) {
  if (mode === 'signup') return 'Create your Mentra account';
  if (mode === 'forgot') return 'Reset your password';
  if (mode === 'reset') return 'Set a new password';
  return 'Sign in to Mentra';
}

function getActionLabel(mode: AuthPanel) {
  if (mode === 'signup') return 'Create account';
  if (mode === 'forgot') return 'Send reset instructions';
  if (mode === 'reset') return 'Update password';
  return 'Sign in';
}

function getSubtitle(mode: AuthPanel) {
  if (mode === 'signup') {
    return 'Start with a profile, then take the initial assessment to build your skill matrix.';
  }
  if (mode === 'forgot') {
    return 'Enter your account email. In local dev, Mentra returns a reset token directly.';
  }
  if (mode === 'reset') {
    return 'Use the reset token and choose a new password for your account.';
  }
  return 'Continue to your assessment, roadmap, and progress dashboard.';
}

function tabClass(active: boolean) {
  return [
    'h-9 rounded-sm px-4 text-sm font-medium transition',
    active ? 'bg-surface-inverse text-ink-inverse' : 'text-ink-muted hover:text-ink',
  ].join(' ');
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-md bg-surface/80 p-4 ring-1 ring-border backdrop-blur">
      <div className="text-display-sm tracking-normal">{value}</div>
      <div className="mt-1 text-xs text-ink-muted">{label}</div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M21.6 12.23c0-.74-.07-1.45-.19-2.14H12v4.05h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.44Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.97-.9 6.62-2.43l-3.24-2.51c-.9.6-2.04.96-3.38.96-2.6 0-4.8-1.76-5.6-4.12H3.05v2.59A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.4 13.9a6.01 6.01 0 0 1 0-3.8V7.51H3.05a10 10 0 0 0 0 8.98L6.4 13.9Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.98c1.47 0 2.8.5 3.84 1.5l2.86-2.86A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.95 5.51L6.4 10.1c.8-2.36 3-4.12 5.6-4.12Z"
      />
    </svg>
  );
}
