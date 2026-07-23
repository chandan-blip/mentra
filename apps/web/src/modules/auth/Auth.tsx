import { type FormEvent, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Check, Github, GraduationCap, Linkedin, Lock, Mail, UserRound } from 'lucide-react';
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
    <main className="relative min-h-dvh bg-canvas text-ink">
      {/* Full-screen animated routes; the form floats on top as a frosted card. */}
      <AuthMotionBackdrop />
      <div className="absolute inset-0 bg-white/20" />
      <div className="relative mx-auto flex min-h-dvh max-w-[560px] items-center px-4 py-6">
        <div className="w-full rounded-2xl bg-surface/95 p-6 shadow-card-hover ring-1 ring-border-subtle backdrop-blur-md sm:p-7">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-md bg-surface-inverse text-ink-inverse">
                <GraduationCap className="size-5" />
              </div>
              <div>
                <div className="text-lg font-semibold">Mentra</div>
                <div className="text-sm text-ink-muted">Career OS for software engineers</div>
              </div>
            </div>

            <div className="mb-5">
              <div className="mb-3 grid w-full grid-cols-2 rounded-md bg-surface-sunken p-1 ring-1 ring-border-subtle sm:inline-grid sm:w-auto">
                {(['signin', 'signup'] as const).map((tab) => {
                  const active = mode === tab;
                  return (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => {
                        setMode(tab);
                        setStatus('idle');
                        setError('');
                      }}
                      className="relative h-9 rounded-sm px-4 text-sm font-medium"
                    >
                      {/* Shared indicator: framer animates it across tabs (layoutId), so the
                          highlight glides left↔right like water instead of snapping. */}
                      {active ? (
                        <motion.span
                          layoutId="auth-tab-indicator"
                          className="absolute inset-0 rounded-sm bg-surface-inverse"
                          transition={{ type: 'spring', stiffness: 260, damping: 26, mass: 0.9 }}
                        />
                      ) : null}
                      <span
                        className={`relative z-10 transition-colors ${
                          active ? 'text-ink-inverse' : 'text-ink-muted hover:text-ink'
                        }`}
                      >
                        {tab === 'signin' ? 'Sign in' : 'Sign up'}
                      </span>
                    </button>
                  );
                })}
              </div>
              <h1 className="text-display-md tracking-normal text-ink">{title}</h1>
              <p className="mt-2 max-w-sm text-sm leading-6 text-ink-muted">
                {getSubtitle(mode)}
              </p>
            </div>

            {!isForgot && !isReset ? (
              <>
                {/* Social sign-in isn't wired up yet — disabled + dimmed until implemented. */}
                <div className="mb-4 grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    disabled
                    title="Coming soon"
                    aria-label="Continue with GitHub (coming soon)"
                    className="auth-social-button cursor-not-allowed opacity-40"
                  >
                    <Github className="size-4" />
                    GitHub
                  </button>
                  <button
                    type="button"
                    disabled
                    title="Coming soon"
                    aria-label="Continue with Google (coming soon)"
                    className="auth-social-button cursor-not-allowed opacity-40"
                  >
                    <GoogleMark />
                    Google
                  </button>
                  <button
                    type="button"
                    disabled
                    title="Coming soon"
                    aria-label="Continue with LinkedIn (coming soon)"
                    className="auth-social-button cursor-not-allowed opacity-40"
                  >
                    <Linkedin className="size-4 text-[#0A66C2]" />
                    LinkedIn
                  </button>
                </div>

                <div className="mb-4 flex items-center gap-3 text-xs text-ink-faint">
                  <span className="h-px flex-1 bg-border-subtle" />
                  <span>Email</span>
                  <span className="h-px flex-1 bg-border-subtle" />
                </div>
              </>
            ) : null}

            <form onSubmit={handleSubmit} className="space-y-3">
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
                    <label className="group inline-flex cursor-pointer select-none items-center gap-2.5 text-ink-muted">
                      <input
                        checked={remember}
                        onChange={(event) => setRemember(event.target.checked)}
                        type="checkbox"
                        className="peer sr-only"
                      />
                      <span
                        aria-hidden
                        className={`grid size-5 place-items-center rounded-md ring-1 transition-all peer-focus-visible:ring-2 peer-focus-visible:ring-ink peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface ${
                          remember
                            ? 'bg-surface-inverse ring-surface-inverse'
                            : 'bg-surface-sunken ring-border group-hover:ring-border-strong'
                        }`}
                      >
                        <Check
                          className={`size-3.5 text-ink-inverse transition-all duration-150 ${
                            remember ? 'scale-100 opacity-100' : 'scale-50 opacity-0'
                          }`}
                          strokeWidth={3}
                        />
                      </span>
                      <span className="transition-colors group-hover:text-ink">Remember me</span>
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
        </div>
      </main>
  );
}

/** Flowing "data routes" — a faint base line + a bright travelling segment along it. */
const FLOW_LINES = [
  { d: 'M-40 220 H340 V360 H520 V210 H820 V440 H1040', color: '#2563eb', dur: '7s' },
  { d: 'M-40 520 H260 V680 H520 V520 H700 V760 H1040', color: '#7c3aed', dur: '9s' },
  { d: 'M220 1040 V640 H440 V470 H640 V320 H860 V-40', color: '#16a34a', dur: '11s' },
  { d: 'M-40 820 H160 V900 H470 V820 H1040', color: '#0891b2', dur: '8.5s' },
];

/** Pulsing junction nodes on the network. */
const FLOW_NODES = [
  { cx: 340, cy: 360, color: '#2563eb', dur: '3s' },
  { cx: 520, cy: 520, color: '#7c3aed', dur: '3.6s' },
  { cx: 640, cy: 320, color: '#16a34a', dur: '3.2s' },
  { cx: 820, cy: 440, color: '#0891b2', dur: '4s' },
  { cx: 470, cy: 820, color: '#2563eb', dur: '3.4s' },
  { cx: 700, cy: 760, color: '#7c3aed', dur: '4.2s' },
];

/** A large, slowly drifting blurred colour blob — the "aurora" that makes the page breathe. */
function AuroraBlob({
  className,
  color,
  x,
  y,
  duration,
}: {
  className: string;
  color: string;
  x: number[];
  y: number[];
  duration: number;
}) {
  return (
    <motion.div
      aria-hidden
      className={`pointer-events-none absolute rounded-full blur-3xl ${className}`}
      style={{ background: `radial-gradient(circle, ${color}, transparent 62%)` }}
      animate={{ x, y, scale: [1, 1.12, 0.95, 1] }}
      transition={{ duration, repeat: Infinity, ease: 'easeInOut' }}
    />
  );
}

function AuthMotionBackdrop() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-gradient-to-b from-white to-[#f2f6fc]">
      {/* Drifting aurora */}
      <AuroraBlob className="-left-40 -top-40 h-[46rem] w-[46rem]" color="rgba(37,99,235,0.18)" x={[0, 70, -30, 0]} y={[0, 50, 90, 0]} duration={26} />
      <AuroraBlob className="-right-40 top-1/4 h-[42rem] w-[42rem]" color="rgba(22,163,74,0.16)" x={[0, -60, 20, 0]} y={[0, 40, -30, 0]} duration={30} />
      <AuroraBlob className="bottom-[-14rem] left-1/4 h-[40rem] w-[40rem]" color="rgba(124,58,237,0.16)" x={[0, 45, -45, 0]} y={[0, -30, 25, 0]} duration={34} />

      <svg
        viewBox="0 0 1000 1000"
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <filter id="softGlow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="2.6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <pattern id="microGrid" width="44" height="44" patternUnits="userSpaceOnUse">
            <path d="M44 0 H0 V44" fill="none" stroke="#e6eaf0" strokeWidth="0.6" />
          </pattern>
        </defs>

        <rect x="0" y="0" width="1000" height="1000" fill="url(#microGrid)" opacity="0.6" />

        {FLOW_LINES.map((r) => (
          <g key={r.d} filter="url(#softGlow)">
            <path d={r.d} stroke={r.color} strokeWidth="1" fill="none" opacity="0.18" />
            <path
              d={r.d}
              stroke={r.color}
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
              opacity="0.7"
              strokeDasharray="70 1400"
            >
              <animate attributeName="stroke-dashoffset" from="0" to="-1470" dur={r.dur} repeatCount="indefinite" />
            </path>
          </g>
        ))}

        {FLOW_NODES.map((n) => (
          <circle key={`${n.cx}-${n.cy}`} cx={n.cx} cy={n.cy} r="3" fill={n.color} filter="url(#softGlow)">
            <animate attributeName="r" values="2.5;5.5;2.5" dur={n.dur} repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.35;1;0.35" dur={n.dur} repeatCount="indefinite" />
          </circle>
        ))}
      </svg>

      {/* Gentle vignette so the network fades toward the edges and stays clean behind the card. */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_50%,rgba(255,255,255,0.55))]" />
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
    return 'Create your account, then set up your profile to personalize your learning.';
  }
  if (mode === 'forgot') {
    return 'Enter your account email. In local dev, Mentra returns a reset token directly.';
  }
  if (mode === 'reset') {
    return 'Use the reset token and choose a new password for your account.';
  }
  return 'Continue to your learning, live sessions, and progress dashboard.';
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
