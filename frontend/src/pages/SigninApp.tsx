import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  CheckCircle2,
  KeyRound,
  LogOut,
  Mail,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { loadCatalog, type EndpointSpec, type OperatorApiState } from '../lib/api-bridge';
import { CelestialNavbar } from '../components/CelestialNavbar';
import { CommandModal } from '../components/CommandModal';
import { AnimeCanvasFX } from '../components/AnimeCanvasFX';
import { AnimeOperator } from '../components/AnimeOperator';

function resolveSafeReturnTo(): string {
  if (typeof window === 'undefined') return '/explorer.html';
  const raw = new URLSearchParams(window.location.search).get('returnTo') || '';
  if (raw.startsWith('/') && !raw.startsWith('//') && !raw.includes('\\')) {
    return raw;
  }
  return '/explorer.html';
}

type GateStage = 'loading' | 'email' | 'otp' | 'signed_in' | 'reauth_otp';

export const SigninApp: React.FC = () => {
  const [endpoints, setEndpoints] = useState<EndpointSpec[]>([]);
  const [commandOpen, setCommandOpen] = useState(false);

  const [stage, setStage] = useState<GateStage>('loading');
  const [csrfToken, setCsrfToken] = useState('');
  const [email, setEmail] = useState('');
  const [accountEmail, setAccountEmail] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  const [apiState, setApiState] = useState<OperatorApiState>('idle');
  const [operatorNote, setOperatorNote] = useState('');
  const [burstSignal, setBurstSignal] = useState(0);

  const safeReturnTo = useMemo(() => resolveSafeReturnTo(), []);

  useEffect(() => {
    loadCatalog()
      .then((items) => setEndpoints(items || []))
      .catch(() => {});
  }, []);

  // Cooldown ticker for OTP resend
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setInterval(() => {
      setResendCooldown((n) => Math.max(0, n - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [resendCooldown]);

  const syncSession = useCallback(async () => {
    setApiState('loading');
    setOperatorNote('Checking active session token via GET /api/v1/auth/session ...');
    try {
      const res = await fetch('/api/v1/auth/session', {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      const payload = await res.json().catch(() => ({}));
      const result = payload?.result || payload || {};
      if (result.csrf) setCsrfToken(result.csrf);

      if (result.authenticated) {
        setAccountEmail(result.account?.email || 'Authenticated Developer');
        setStage('signed_in');
        setApiState('success');
        setOperatorNote('Active developer session verified.');
      } else {
        setStage('email');
        setApiState('idle');
        setOperatorNote('Session gate ready. Enter your developer email for an 8-digit code.');
      }
    } catch {
      setStage('email');
      setApiState('error');
      setOperatorNote('Could not reach /api/v1/auth/session.');
    }
  }, []);

  useEffect(() => {
    syncSession();
  }, [syncSession]);

  const postAuthJson = async (url: string, body: Record<string, unknown>) => {
    const res = await fetch(url, {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-CSRF-Token': csrfToken,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    const nextCsrf = data?.result?.csrf || data?.csrf;
    if (nextCsrf) setCsrfToken(nextCsrf);
    return { res, data };
  };

  // Start Email OTP Challenge
  const handleStartEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');
    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMsg('Please enter a valid developer email address.');
      setApiState('error');
      return;
    }

    setApiState('loading');
    setBurstSignal((n) => n + 1);
    setOperatorNote('Requesting 8-digit verification code from /api/v1/auth/email/start ...');

    try {
      const { res, data } = await postAuthJson('/api/v1/auth/email/start', {
        email: cleanEmail,
      });
      if (!res.ok || data?.status === false) {
        const msg =
          data?.error?.message ||
          data?.message ||
          data?.error ||
          `Verification start failed (HTTP ${res.status}).`;
        setErrorMsg(String(msg));
        setApiState('error');
        setOperatorNote('Email verification challenge was rejected.');
        return;
      }

      const result = data?.result || data || {};
      setChallengeId(result.challenge_id || '');
      setResendCooldown(Number(result.resend_after || 30));
      setOtpCode('');
      setStage('otp');
      setInfoMsg('If this email is eligible, an 8-digit verification code has been dispatched.');
      setApiState('focus');
      setOperatorNote('Challenge active. Enter the 8-digit verification code.');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Network error starting verification.');
      setApiState('error');
    }
  };

  // Verify 8-Digit Email OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const cleanCode = otpCode.replace(/\s+/g, '');
    if (!/^\d{8}$/.test(cleanCode)) {
      setErrorMsg('Enter the exact 8-digit numeric code.');
      setApiState('error');
      return;
    }

    const isReauth = stage === 'reauth_otp';
    const targetUrl = isReauth
      ? '/api/v1/auth/reauth/verify'
      : '/api/v1/auth/email/verify';

    setApiState('loading');
    setBurstSignal((n) => n + 1);
    setOperatorNote(`Verifying 8-digit code via ${targetUrl} ...`);

    try {
      const { res, data } = await postAuthJson(targetUrl, {
        challenge_id: challengeId,
        code: cleanCode,
      });
      const result = data?.result || data || {};

      if (!res.ok || data?.status === false) {
        const msg =
          data?.error?.message ||
          data?.message ||
          data?.error ||
          `Verification failed (HTTP ${res.status}).`;
        setErrorMsg(String(msg));
        setApiState('error');
        setOperatorNote('Invalid or expired 8-digit verification code.');
        return;
      }

      if (result.state === 'registration_closed') {
        setErrorMsg('New account registration is currently closed for this address.');
        setApiState('error');
        return;
      }

      setAccountEmail(result.account?.email || email || accountEmail);
      setStage('signed_in');
      setInfoMsg(
        isReauth
          ? 'Step-up re-authentication confirmed.'
          : 'Session established. Redirecting or manage session below.'
      );
      setApiState('success');
      setBurstSignal((n) => n + 1);
      setOperatorNote('Session authenticated! Welcome aboard Celestial Relay.');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Network error during code verification.');
      setApiState('error');
    }
  };

  const handleCancelChallenge = async () => {
    setErrorMsg('');
    setInfoMsg('');
    try {
      if (stage === 'otp') {
        await postAuthJson('/api/v1/auth/email/cancel', {});
      }
    } catch {}
    setChallengeId('');
    setOtpCode('');
    setStage(accountEmail ? 'signed_in' : 'email');
    setApiState('cancelled');
    setOperatorNote('Verification challenge cancelled cleanly.');
  };

  const handleStartReauth = async () => {
    setErrorMsg('');
    setInfoMsg('');
    setApiState('loading');
    setOperatorNote('Starting step-up re-authentication challenge...');
    try {
      const { res, data } = await postAuthJson('/api/v1/auth/reauth/start', {});
      if (!res.ok || data?.status === false) {
        setErrorMsg(data?.error?.message || data?.message || 'Could not start re-authentication.');
        setApiState('error');
        return;
      }
      const result = data?.result || data || {};
      setChallengeId(result.challenge_id || '');
      setOtpCode('');
      setStage('reauth_otp');
      setInfoMsg('An 8-digit step-up verification code was sent to your account email.');
      setApiState('focus');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Re-auth request failed.');
      setApiState('error');
    }
  };

  const handleLogout = async (allDevices: boolean) => {
    setErrorMsg('');
    setInfoMsg('');
    setApiState('loading');
    const endpoint = allDevices ? '/api/v1/auth/logout-all' : '/api/v1/auth/logout';
    try {
      await postAuthJson(endpoint, {});
      setAccountEmail('');
      setEmail('');
      setChallengeId('');
      setOtpCode('');
      await syncSession();
      setInfoMsg(
        allDevices
          ? 'All active sessions across devices have been revoked.'
          : 'Current session signed out cleanly.'
      );
      setApiState('cancelled');
    } catch {
      setErrorMsg('Failed to sign out cleanly.');
      setApiState('error');
    }
  };

  return (
    <div className="celestial-atmosphere relative min-h-screen overflow-x-clip pb-16">
      <AnimeCanvasFX apiState={apiState} burstSignal={burstSignal} />

      <CelestialNavbar
        activeRoute="signin"
        onOpenCommand={() => setCommandOpen(true)}
        endpointCount={endpoints.length || 42}
      />

      <CommandModal
        open={commandOpen}
        onClose={() => setCommandOpen(false)}
        endpoints={endpoints}
      />

      <main className="relative z-10 mx-auto max-w-5xl px-5 pt-28 sm:px-8 sm:pt-32">
        <div className="grid items-center gap-8 lg:grid-cols-12">
          {/* Left 7 Cols: Passwordless Auth Gate Card */}
          <div className="celestial-card space-y-6 p-6 sm:p-8 lg:col-span-7">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-celestial-lilac">
                <Sparkles className="h-3.5 w-3.5" strokeWidth={1.5} />
                <span>DEVELOPER SESSION GATE</span>
              </div>
              <h1 className="font-display text-2xl font-semibold tracking-tight text-celestial-primary sm:text-3xl">
                Passwordless Astral Access
              </h1>
              <p className="text-xs leading-relaxed text-celestial-secondary sm:text-sm">
                Protected by CSRF-bound session cookies and one-time 8-digit email verification.
              </p>
            </div>

            {errorMsg && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-xl border border-rose-500/45 bg-rose-500/10 p-3.5 text-xs text-rose-600 dark:text-rose-300"
              >
                <XCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.5} />
                <span>{errorMsg}</span>
              </div>
            )}

            {infoMsg && (
              <div className="flex items-start gap-2.5 rounded-xl border border-celestial-sky/45 bg-celestial-sky/10 p-3.5 text-xs text-celestial-primary">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-celestial-sky" strokeWidth={1.5} />
                <span>{infoMsg}</span>
              </div>
            )}

            {stage === 'loading' && (
              <div className="py-10 text-center font-mono text-xs text-celestial-muted">
                Synchronizing CSRF handshake &amp; session state...
              </div>
            )}

            {stage === 'email' && (
              <form onSubmit={handleStartEmail} className="space-y-4">
                <label className="block space-y-1.5">
                  <span className="font-mono text-xs font-medium text-celestial-secondary">
                    Developer Email Address
                  </span>
                  <div className="relative">
                    <Mail
                      className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-celestial-muted"
                      strokeWidth={1.5}
                    />
                    <input
                      type="email"
                      required
                      value={email}
                      onFocus={() => setApiState('focus')}
                      onBlur={() => setApiState('idle')}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@domain.com"
                      className="w-full rounded-xl border border-celestial-border/55 bg-celestial-canvas/75 py-3 pl-10 pr-4 text-base text-celestial-primary placeholder:text-celestial-muted focus:border-celestial-sky focus:outline-none sm:text-sm"
                    />
                  </div>
                </label>

                <motion.button
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  className="btn-celestial-primary inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold"
                >
                  <span>Send 8-Digit Verification Code</span>
                  <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
                </motion.button>
              </form>
            )}

            {(stage === 'otp' || stage === 'reauth_otp') && (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <label className="block space-y-1.5">
                  <span className="flex items-center justify-between font-mono text-xs text-celestial-secondary">
                    <span>8-Digit One-Time Code</span>
                    <span className="text-celestial-muted">
                      {stage === 'reauth_otp' ? 'Step-Up Re-Auth' : email}
                    </span>
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="\d{8}"
                    maxLength={8}
                    required
                    value={otpCode}
                    onFocus={() => setApiState('focus')}
                    onChange={(e) => setOtpCode(e.target.value.replace(/[^\d]/g, '').slice(0, 8))}
                    placeholder="00000000"
                    className="w-full rounded-xl border border-celestial-border/55 bg-celestial-canvas/75 px-4 py-3 text-center font-mono text-xl tracking-[0.35em] text-celestial-primary placeholder:text-celestial-muted focus:border-celestial-sky focus:outline-none"
                  />
                </label>

                <div className="flex flex-wrap gap-2.5">
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    className="btn-celestial-primary inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold"
                  >
                    <ShieldCheck className="h-4 w-4" strokeWidth={1.75} />
                    <span>Verify Code</span>
                  </motion.button>

                  <button
                    type="button"
                    onClick={handleCancelChallenge}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-celestial-border/55 bg-celestial-canvas/60 px-4 py-2.5 font-mono text-xs text-celestial-secondary hover:text-celestial-primary"
                  >
                    Cancel
                  </button>
                </div>

                {stage === 'otp' && (
                  <div className="flex items-center justify-between pt-1 font-mono text-[11px] text-celestial-muted">
                    <span>Didn&apos;t receive the code?</span>
                    <button
                      type="button"
                      disabled={resendCooldown > 0}
                      onClick={(e) => handleStartEmail(e as unknown as React.FormEvent)}
                      className="text-celestial-sky hover:underline disabled:opacity-45"
                    >
                      {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
                    </button>
                  </div>
                )}
              </form>
            )}

            {stage === 'signed_in' && (
              <div className="space-y-4">
                <div className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 p-4">
                  <div className="font-mono text-[11px] uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                    ACTIVE SESSION ESTABLISHED
                  </div>
                  <div className="mt-1 font-mono text-sm font-semibold text-celestial-primary">
                    {accountEmail}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2.5">
                  <a
                    href={safeReturnTo}
                    className="btn-celestial-primary inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold"
                  >
                    <span>Continue to Destination</span>
                    <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
                  </a>

                  <button
                    type="button"
                    onClick={handleStartReauth}
                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-celestial-border/50 bg-celestial-canvas/65 px-3.5 py-2 font-mono text-xs text-celestial-secondary hover:text-celestial-primary"
                  >
                    <RefreshCw className="h-3.5 w-3.5 text-celestial-lilac" strokeWidth={1.5} />
                    <span>Step-Up Re-Auth</span>
                  </button>
                </div>

                <div className="flex flex-wrap gap-2.5 border-t border-celestial-border/35 pt-4">
                  <button
                    type="button"
                    onClick={() => handleLogout(false)}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-celestial-border/45 px-3.5 py-2 font-mono text-xs text-celestial-secondary hover:text-celestial-primary"
                  >
                    <LogOut className="h-3.5 w-3.5" strokeWidth={1.5} />
                    <span>Sign Out Device</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLogout(true)}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-rose-400/40 bg-rose-400/10 px-3.5 py-2 font-mono text-xs text-rose-300 hover:bg-rose-400/20"
                  >
                    <KeyRound className="h-3.5 w-3.5" strokeWidth={1.5} />
                    <span>Revoke All Sessions</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right 5 Cols: Sora Companion */}
          <div className="lg:col-span-5">
            <AnimeOperator apiState={apiState} statusText={operatorNote} />
          </div>
        </div>
      </main>
    </div>
  );
};
