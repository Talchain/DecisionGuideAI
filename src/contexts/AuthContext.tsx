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
// Provider
// ---------------------------------------------------------------------------

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();

  // E2E test-mode hardening: disallow in production bundles
  if (import.meta.env.PROD && isE2EEnabled()) {
    throw new Error('E2E test mode is forbidden in production bundles');
  }

  // Guest/PoC mode: provide an immediately-ready auth context with no network calls
  if (isGuestAuth) {
    const value: AuthContextType = {
      user: { id: 'guest', email: 'guest@poc' } as User,
      profile: null,
      loading: false,
      authenticated: true,
      signInWithMagicLink: async () => ({ error: null }),
      signInWithGoogle: async () => ({ error: null }),
      signIn: async () => ({ error: null, data: { id: 'guest', email: 'guest@poc' } }),
      signUp: async () => ({ error: null, data: { id: 'guest', email: 'guest@poc' } }),
      signOut: async () => ({ error: null }),
    };
    return (
      <AuthContext.Provider value={value}>
        {children}
      </AuthContext.Provider>
    );
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

    signInWithMagicLink: async (email: string) => {
      authLogger.debug('SIGN_IN', 'Magic link request', { email });
      try {
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
        return { error };
      }
    },

    // Invite-only enforcement for Google OAuth relies on a server-side
    // "Before User Created" hook configured in the Supabase dashboard,
    // not on client-side config. signInWithOAuth does not support
    // shouldCreateUser — the hook checks an email allowlist.
    signInWithGoogle: async () => {
      authLogger.debug('SIGN_IN', 'Google OAuth request');
      try {
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
        return { error };
      }
    },

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

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
