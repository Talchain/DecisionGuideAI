import React, { createContext, useContext, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Session, User } from '@supabase/supabase-js';
import { supabase, getProfile } from '../lib/supabase';
import type { UserProfile } from '../types/database';
import { authLogger } from '../lib/auth/authLogger';
import { clearAuthStates } from '../lib/auth/authUtils';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  authenticated: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any; data?: any }>;
  signUp: (email: string, password: string) => Promise<{ error: any; data?: any }>;
  signOut: () => Promise<{ error: any }>;
  updateProfile?: (data: Partial<UserProfile>) => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  authenticated: false,
  signIn: async () => ({ error: new Error('AuthContext not initialized'), data: null }),
  signUp: async () => ({ error: new Error('AuthContext not initialized'), data: null }),
  signOut: async () => ({ error: new Error('AuthContext not initialized') })
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [state, setState] = React.useState<{
    user: User | null;
    profile: UserProfile | null;
    loading: boolean;
    authenticated: boolean;
  }>({
    user: null,
    profile: null,
    loading: true,
    authenticated: false
  });

  const fetchProfile = useCallback(async (user: User) => {
    try {
      const { data: profile, error } = await getProfile(user.id);
      if (error) throw error;
      return profile;
    } catch (error) {
      authLogger.error('ERROR', 'Failed to fetch profile', error);
      return null;
    }
  }, []);

  const handleAuthStateChange = useCallback(async (session: Session | null) => {
    if (!session) {
      // Clear any stale auth data when session is null
      await clearAuthStates();
      setState({
        user: null,
        profile: null,
        loading: false,
        authenticated: false
      });
      return;
    }

    try {
      const profile = await fetchProfile(session.user);
      setState({
        user: session.user,
        profile,
        loading: false,
        authenticated: true
      });
    } catch (error) {
      authLogger.error('ERROR', 'Auth state change error', error);
      setState({
        user: session.user,
        profile: null,
        loading: false,
        authenticated: true
      });
    }
  }, [fetchProfile]);

  // Initialize auth state
  useEffect(() => {
    const initAuth = async () => {
      authLogger.debug('AUTH', 'Initializing auth state');
      try {
        const { data: { session } } = await supabase.auth.getSession();
        await handleAuthStateChange(session);

        // Subscribe to auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
          authLogger.debug('AUTH', 'Auth state changed', { event });
          await handleAuthStateChange(session);
        });

        return () => {
          subscription.unsubscribe();
        };
      } catch (error) {
        authLogger.error('ERROR', 'Auth initialization failed', error);
        
        // Check if this is a refresh token error
        const errorMessage = error instanceof Error ? error.message : '';
        if (errorMessage.includes('refresh_token_not_found') || 
            errorMessage.includes('Invalid Refresh Token') ||
            errorMessage.includes('Refresh Token Not Found')) {
          authLogger.debug('AUTH', 'Invalid refresh token detected, clearing auth states');
          
          // Clear all auth states and reset to unauthenticated state
          await clearAuthStates();
          setState({
            user: null,
            profile: null,
            loading: false,
            authenticated: false
          });
        } else {
          // For other errors, just stop loading
          setState(prev => ({ ...prev, loading: false }));
        }
      }
    };

    initAuth();
  }, [handleAuthStateChange]);

  const value = React.useMemo(() => ({
    ...state,
    signUp: async (email: string, password: string) => {
      authLogger.debug('AUTH', 'Sign up attempt', { email });
      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/login`
          }
        });
        
        if (error) {
          authLogger.error('ERROR', 'Sign up failed', error);
          return { error, data: null };
        }

        return { data, error: null };
      } catch (error) {
        authLogger.error('ERROR', 'Sign up error', error);
        return { error, data: null };
      }
    },
    signIn: async (email: string, password: string) => {
      authLogger.debug('AUTH', 'Sign in attempt', { email });
      try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          authLogger.error('ERROR', 'Sign in failed', error);
          return { error, data: null };
        }
        return { error: null, data };
      } catch (error) {
        authLogger.error('ERROR', 'Sign in error', error);
        return { error, data: null };
      }
    },
    signOut: async () => {
      authLogger.debug('AUTH', 'Sign out attempt');
      try {
        // First clear all local state and auth data
        await clearAuthStates();
        
        // Reset context state before attempting Supabase signout
        setState({
          user: null,
          profile: null,
          loading: false,
          authenticated: false
        });
        
        // Then try to sign out from Supabase
        try {
          // Get current session first
          const { data: { session } } = await supabase.auth.getSession();
          
          if (session) {
            await supabase.auth.signOut({
              scope: 'local' // Change to local scope to prevent 403 error
            });
          }
        } catch (signOutError) {
          // Log but continue - we'll still clear local state
          authLogger.debug('AUTH', 'Supabase sign out failed, continuing with cleanup', {
            error: signOutError instanceof Error ? signOutError.message : 'Unknown error'
          });
        }
        
        // Navigate to landing page
        navigate('/', { replace: true });
        
        return { error: null };
      } catch (error) {
        // If anything fails, force clear everything
        try {
          await clearAuthStates();
          setState({
            user: null,
            profile: null,
            loading: false,
            authenticated: false
          });
          navigate('/', { replace: true });
        } catch (cleanupError) {
          authLogger.error('ERROR', 'Failed to clean up during error recovery', cleanupError);
        }
        
        authLogger.error('ERROR', 'Sign out failed', error);
        return { error };
      }
    }
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