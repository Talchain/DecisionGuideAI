import React, { createContext, useContext, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, getProfile } from '../lib/supabase';
import type { UserProfile } from '../types/database';
import { authLogger } from '../lib/auth/authLogger';
import { clearAuthStates } from '../lib/auth/authUtils';
import { isE2EEnabled } from '../flags';
import { isGuestAuth } from '../lib/poc';
import { setSentryUser, clearSentryUser } from '../lib/monitoring';
import { identifyUser, resetPostHog, trackEvent } from '../lib/posthog';

// ---------------------------------------------------------------------------
// Context type
// ---------------------------------------------------------------------------

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  authenticated: boolean;
  signInWithMagicLink: (email: string) => Promise<{ error: unknown }>;
  signInWithGoogle: () => Promise<{ error: unknown }>;
  signOut: () => Promise<{ error: unknown }>;

  // Legacy compat — kept so existing components that destructure these don't break.
  // Both are no-ops that return an error.
  signIn: (email: string, password: string) => Promise<{ error: unknown; data?: unknown }>;
  signUp: (email: string, password: string) => Promise<{ error: unknown; data?: unknown }>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  authenticated: false,
  signInWithMagicLink: async () => ({ error: new Error('AuthContext not initialized') }),
  signInWithGoogle: async () => ({ error: new Error('AuthContext not initialized') }),
  signIn: async () => ({ error: new Error('Password auth removed'), data: null }),
  signUp: async () => ({ error: new Error('Password auth removed'), data: null }),
  signOut: async () => ({ error: new Error('AuthContext not initialized') }),
});

// Legacy no-op for removed password auth
const legacyNoOp = async () => ({ error: new Error('Password auth removed — use magic link'), data: null });

// ---------------------------------------------------------------------------
// The sign-in calls — ONE implementation, shared by every posture
// ---------------------------------------------------------------------------
//
// These used to exist twice: once for real, and once as
// `async () => ({ error: null })` inside the guest branch below. Staging
// deploys VITE_AUTH_MODE="guest", so the *deployed* implementation was the
// second one — both login buttons made no network call and reported SUCCESS,
// and LoginPage duly told the user a link was on its way. A silent-success
// twin of a real function is the worst shape available: it cannot be seen in
// a diff of either half, and every test of the real one stays green.
//
// There is now no second copy to drift. The posture decides WHO YOU ARE; it
// does not decide whether the button does anything.

/**
 * The Supabase SDK is aliased to `src/stubs/supabase-stub.mjs` on any build
 * that does not set `VITE_STUB_SUPABASE=0` (see scripts/supabase-stub-decision.mjs),
 * and that stub implements NEITHER `signInWithOtp` NOR `signInWithOAuth`.
 * Calling one there throws a TypeError. The honest answer is an error the
 * surface can render — never `{ error: null }`, which is exactly the lie this
 * whole module was changed to stop telling.
 */
function signInUnavailable(method: string): Error {
  // `status: 501` is not decoration. Surfaces classify a failure by HTTP-style
  // status (see LoginPage: >= 500 means OUR fault, say so; anything else stays
  // in the enumeration-safe branch), and a build with no sign-in capability is
  // exactly Not Implemented. Without a status this error would fall into the
  // "might be an unknown address" bucket and be reported as a sent link — the
  // very lie being removed.
  return Object.assign(
    new Error(
      `Sign-in is unavailable in this build: the bundled Supabase client has no ${method}. ` +
        'No sign-in request was sent.',
    ),
    { status: 501 },
  );
}

/**
 * A THROW from the Supabase client is a fault, never a fact about the address.
 *
 * `signInWithOtp` can reject or throw for a network failure, a CSP block, or a
 * missing method on a stubbed client. None of those say anything about whether
 * an account exists — but a bare `Error` carries no `status`, and LoginPage's
 * enumeration-safe default would file it under "might be an unknown address"
 * and report a sent link. Stamping 5xx puts it in the honest branch.
 *
 * An error that ALREADY carries a numeric status keeps it: a real
 * `AuthApiError` has classified itself better than this wrapper can, and
 * overwriting a 422 with a 500 would turn an enumeration-safe outcome into a
 * false server-fault message.
 */
function asFault(error: unknown): unknown {
  if (typeof (error as { status?: unknown } | null)?.status === 'number') return error;
  if (error instanceof Error) return Object.assign(error, { status: 500 });
  return Object.assign(new Error(String(error)), { status: 500 });
}

async function callSignInWithMagicLink(email: string): Promise<{ error: unknown }> {
  authLogger.debug('SIGN_IN', 'Magic link request', { email });
  try {
    if (typeof supabase.auth.signInWithOtp !== 'function') {
      return { error: signInUnavailable('signInWithOtp') };
    }
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/#/auth/callback`,
      },
    });
    if (error) {
      authLogger.error('ERROR', 'Magic link failed', error);
      return { error };
    }
    return { error: null };
  } catch (error) {
    authLogger.error('ERROR', 'Magic link error', error);
    return { error: asFault(error) };
  }
}

async function callSignInWithGoogle(): Promise<{ error: unknown }> {
  authLogger.debug('SIGN_IN', 'Google OAuth request');
  try {
    if (typeof supabase.auth.signInWithOAuth !== 'function') {
      return { error: signInUnavailable('signInWithOAuth') };
    }
    // Invite-only enforcement for Google OAuth relies on a server-side
    // "Before User Created" hook configured in the Supabase dashboard,
    // not on client-side config. signInWithOAuth does not support
    // shouldCreateUser — the hook checks an email allowlist.
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/#/auth/callback`,
      },
    });
    if (error) {
      authLogger.error('ERROR', 'Google OAuth failed', error);
      return { error };
    }
    return { error: null };
  } catch (error) {
    authLogger.error('ERROR', 'Google OAuth error', error);
    return { error: asFault(error) };
  }
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();

  // E2E test-mode hardening: disallow in production bundles
  if (import.meta.env.PROD && isE2EEnabled()) {
    throw new Error('E2E test mode is forbidden in production bundles');
  }

  // Guest/PoC mode: an immediately-ready guest identity WITH a real front door.
  if (isGuestAuth) {
    return <OptionalAuthProvider>{children}</OptionalAuthProvider>;
  }

  // E2E test-mode (non-prod builds): provide an immediately-ready auth context
  if (!import.meta.env.PROD && isE2EEnabled()) {
    const value: AuthContextType = {
      user: null,
      profile: null,
      loading: false,
      authenticated: true,
      signInWithMagicLink: async () => ({ error: null }),
      signInWithGoogle: async () => ({ error: null }),
      signIn: async () => ({ error: null, data: null }),
      signUp: async () => ({ error: null, data: null }),
      signOut: async () => ({ error: null }),
    };
    return (
      <AuthContext.Provider value={value}>
        {children}
      </AuthContext.Provider>
    );
  }

  // --- Real auth path ---

  const [state, setState] = React.useState<{
    user: User | null;
    profile: UserProfile | null;
    loading: boolean;
    authenticated: boolean;
  }>({
    user: null,
    profile: null,
    loading: true,
    authenticated: false,
  });

  // Fetch profile in a separate effect reacting to user changes —
  // keeps onAuthStateChange callback lightweight (no chained Supabase queries).
  const [pendingUser, setPendingUser] = React.useState<User | null>(null);

  const handleAuthStateChange = useCallback((session: Session | null) => {
    if (!session) {
      clearAuthStates();
      clearSentryUser();
      resetPostHog();
      setState({ user: null, profile: null, loading: false, authenticated: false });
      setPendingUser(null);
      return;
    }

    // Set user immediately (synchronous side-effects only).
    // Profile fetch is deferred to the useEffect below.
    const u = session.user;
    setSentryUser(u.id, u.email ?? '');
    identifyUser(u.id, u.email ?? '', u.user_metadata?.full_name);
    trackEvent('signed_in', { provider: u.app_metadata?.provider ?? 'unknown' });
    setState(prev => ({ ...prev, user: u, loading: false, authenticated: true }));
    setPendingUser(u);
  }, []);

  // Deferred profile fetch — runs after auth callback has completed.
  useEffect(() => {
    if (!pendingUser) return;
    let cancelled = false;
    (async () => {
      try {
        const { data: profile, error } = await getProfile(pendingUser.id);
        if (error) throw error;
        if (!cancelled) {
          setState(prev => ({ ...prev, profile: profile ?? null }));
        }
      } catch (err) {
        authLogger.error('ERROR', 'Failed to fetch profile', err);
      }
    })();
    return () => { cancelled = true; };
  }, [pendingUser]);

  // Initialize auth state
  useEffect(() => {
    authLogger.debug('INIT', 'Initializing auth state');
    let cleanup: (() => void) | undefined;

    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        handleAuthStateChange(session);

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
          authLogger.debug('STATE', 'Auth state changed', { event: _event });
          handleAuthStateChange(session);
        });

        cleanup = () => subscription.unsubscribe();
      } catch (error) {
        authLogger.error('ERROR', 'Auth initialization failed', error);
        setState(prev => ({ ...prev, loading: false }));
      }
    })();

    return () => cleanup?.();
  }, [handleAuthStateChange]);

  const value = React.useMemo((): AuthContextType => ({
    ...state,

    signInWithMagicLink: callSignInWithMagicLink,
    signInWithGoogle: callSignInWithGoogle,

    // Legacy no-ops
    signIn: legacyNoOp,
    signUp: legacyNoOp,

    signOut: async () => {
      authLogger.debug('SIGN_OUT', 'Sign out attempt');
      try {
        clearAuthStates();
        clearSentryUser();
        resetPostHog();
        setState({ user: null, profile: null, loading: false, authenticated: false });

        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            await supabase.auth.signOut({ scope: 'local' });
          }
        } catch (signOutError) {
          authLogger.debug('SIGN_OUT', 'Supabase sign out failed, continuing', {
            error: signOutError instanceof Error ? signOutError.message : 'Unknown error',
          });
        }

        navigate('/login', { replace: true });
        return { error: null };
      } catch (error) {
        try {
          clearAuthStates();
          setState({ user: null, profile: null, loading: false, authenticated: false });
          navigate('/login', { replace: true });
        } catch (cleanupError) {
          authLogger.error('ERROR', 'Cleanup during sign-out failed', cleanupError);
        }
        authLogger.error('ERROR', 'Sign out failed', error);
        return { error };
      }
    },
  }), [state, navigate]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// OPTIONAL AUTH — the guest posture, with a real front door
// ---------------------------------------------------------------------------
//
// ── WHAT "OPTIONAL" BUYS, AND WHAT IT COSTS ───────────────────────────────
// A visitor who never signs in is byte-for-byte where they were: guest
// identity, `authenticated: true`, `loading: false` on the FIRST render, so
// `AuthGuard` lets them straight through and no spinner is ever shown. That is
// asserted per-render (not just at settle) in
// `__tests__/AuthContext.optionalAuth.spec.tsx`, because a single frame of
// `loading: true` is a visible flash the PoC does not have today.
//
// What changes is that signing in now DOES something: this provider adopts a
// real Supabase session if one exists or arrives, and the sign-in calls are
// the same shared implementations the real-auth path uses.
//
// ── WHY A SEPARATE COMPONENT RATHER THAN UNIFYING `AuthProvider` ──────────
// `AuthProvider` returns early for three postures BEFORE its hooks run. Adding
// hooks to the guest branch in place would have made that conditional-hook
// shape worse and moved `src/contexts/AuthContext.tsx`'s entry in
// `scripts/ci/rules-of-hooks-baseline.json` — which fails the ratchet in
// EITHER direction, by design. A child component owns its own hooks
// unconditionally, so it adds none, and the real-auth path below is untouched:
// this change cannot regress a signed-in user, because it does not run for one.
//
// ── WHY `getSession()` IS SAFE TO CALL HERE ──────────────────────────────
// With no stored session it is a synchronous-ish storage read and issues no
// network request, so a guest pays nothing. `AuthContext` already imported the
// Supabase client at module scope in guest builds, so no new code enters the
// bundle either.
function OptionalAuthProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();

  // `null` = no real session; the guest identity stands in.
  const [session, setSession] = React.useState<{
    user: User;
    profile: UserProfile | null;
  } | null>(null);
  const [pendingUser, setPendingUser] = React.useState<User | null>(null);

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    const adopt = (s: Session | null) => {
      if (cancelled) return;
      if (!s) {
        setSession(null);
        setPendingUser(null);
        return;
      }
      const u = s.user;
      setSentryUser(u.id, u.email ?? '');
      identifyUser(u.id, u.email ?? '', u.user_metadata?.full_name);
      setSession(prev => ({ user: u, profile: prev?.profile ?? null }));
      setPendingUser(u);
    };

    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        adopt(data?.session ?? null);
        const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => adopt(s));
        cleanup = () => sub?.subscription?.unsubscribe?.();
      } catch (error) {
        // A guest build must never fail to boot because auth is unavailable.
        authLogger.debug('INIT', 'Optional auth unavailable; staying a guest', error);
      }
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  // Deferred profile fetch, mirroring the real path: never chained inside the
  // auth-state callback.
  useEffect(() => {
    if (!pendingUser) return;
    let cancelled = false;
    (async () => {
      try {
        const { data: profile, error } = await getProfile(pendingUser.id);
        if (error) throw error;
        if (!cancelled) {
          setSession(prev => (prev ? { ...prev, profile: profile ?? null } : prev));
        }
      } catch (err) {
        authLogger.error('ERROR', 'Failed to fetch profile', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pendingUser]);

  const value = React.useMemo((): AuthContextType => ({
    user: session?.user ?? ({ id: 'guest', email: 'guest@poc' } as User),
    profile: session?.profile ?? null,
    // Never true: a guest is ready immediately, and AuthGuard must not spin.
    loading: false,
    // A guest counts as authenticated so every route stays reachable — that is
    // what makes signing in OPTIONAL rather than merely available.
    authenticated: true,

    signInWithMagicLink: callSignInWithMagicLink,
    signInWithGoogle: callSignInWithGoogle,

    // Password auth is removed product-wide. The guest branch used to answer
    // `{ error: null, data: { id: 'guest' } }` here — a success report for a
    // capability that does not exist.
    signIn: legacyNoOp,
    signUp: legacyNoOp,

    signOut: async () => {
      // No real session: there is genuinely nothing to sign out of, and
      // pretending otherwise would send a request that cannot succeed.
      if (!session) return { error: null };
      authLogger.debug('SIGN_OUT', 'Sign out attempt (optional-auth posture)');
      try {
        clearAuthStates();
        clearSentryUser();
        resetPostHog();
        setSession(null);
        setPendingUser(null);
        await supabase.auth.signOut({ scope: 'local' });
        navigate('/', { replace: true });
        return { error: null };
      } catch (error) {
        authLogger.error('ERROR', 'Sign out failed', error);
        return { error };
      }
    },
  }), [session, navigate]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
