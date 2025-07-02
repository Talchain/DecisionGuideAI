import React, { createContext, useContext, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Session, User } from '@supabase/supabase-js';
import { supabase, getProfile } from '../lib/supabase';
import type { UserProfile } from '../types/database';
import { authLogger } from '../lib/auth/authLogger';
import { clearAuthStates } from '../lib/auth/authUtils';

// Timeout for session refresh attempts
const SESSION_REFRESH_TIMEOUT = 10000; // 10 seconds

// Debug flag for additional logging
const AUTH_DEBUG = false;

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
  
  // Refs for tracking session refresh state
  const refreshingSessionRef = useRef<boolean>(false);
  const sessionRefreshTimeoutRef = useRef<number | null>(null);

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
      if (state.user !== null || state.profile !== null || state.authenticated !== false || state.loading) {
        if (AUTH_DEBUG) console.log('[AuthContext] Session is null, clearing auth state');
        
        // Log the event for debugging
        authLogger.debug('AUTH', 'Session became null, clearing state', {
          previousUser: state.user?.id,
          timestamp: new Date().toISOString()
        });
        
        await clearAuthStates();
        setState({
          user: null,
          profile: null,
          loading: false,
          authenticated: false
        });
      } else if (state.loading) {
        // Only update loading state if it's true
        setState(prev => ({ ...prev, loading: false }));
      }
      return;
    }

    try {
      // Check if user has changed before fetching profile
      const currentUserId = state.user?.id;
      const newUserId = session.user.id;
      
      if (AUTH_DEBUG) console.log('[AuthContext] Session exists, user IDs:', { currentUserId, newUserId });
      
      // Only fetch profile and update state if user has changed or we don't have a profile
      if (currentUserId !== newUserId || !state.profile) {
        const profile = await fetchProfile(session.user);

        if (AUTH_DEBUG) console.log('[AuthContext] Updating auth state with new user/profile', {
          userId: session.user.id,
          hasProfile: !!profile
        });

        setState({
          user: session.user,
          profile,
          loading: false,
          authenticated: true
        });
      } else {
        // Always ensure loading is false and authenticated is true when we have a valid session
        if (state.loading || !state.authenticated) {
          if (AUTH_DEBUG) console.log('[AuthContext] Updating loading/authenticated state only');
          setState(prev => ({
            ...prev,
            loading: false,
            authenticated: true
          }));
        }
      }
    } catch (error) {
      authLogger.error('ERROR', 'Auth state change error', error);
      
      // Only update state if it's different from current state
      if (state.user?.id !== session.user.id || state.profile !== null || state.loading || !state.authenticated) {
        setState({
          user: session.user,
          profile: null,
          loading: false,
          authenticated: true
        });
      }
    }
  }, [fetchProfile, state]);

  // Initialize auth state
  useEffect(() => {
    let visibilityChangeHandler: (() => void) | null = null;
    
    const initAuth = async () => {
      authLogger.debug('AUTH', 'Initializing auth state', { timestamp: new Date().toISOString() });
      try {
        // Add a small delay to ensure localStorage is properly initialized
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const { data: { session } } = await supabase.auth.getSession();
        
        // Log session state for debugging
        authLogger.debug('AUTH', 'Initial session check', { 
          hasSession: !!session,
          userId: session?.user?.id,
          timestamp: new Date().toISOString()
        });
        
        await handleAuthStateChange(session);

        // Subscribe to auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
          authLogger.debug('AUTH', 'Auth state changed', { event });
          console.log('[AuthContext] Auth state changed:', event, session?.user?.id);
          
          // Log auth events for debugging
          if (event === 'SIGNED_OUT') {
            authLogger.info('AUTH', 'User signed out', { timestamp: new Date().toISOString() });
          } else if (event === 'SIGNED_IN') {
            authLogger.info('AUTH', 'User signed in', { 
              userId: session?.user?.id,
              timestamp: new Date().toISOString() 
            });
          } else if (event === 'TOKEN_REFRESHED') {
            authLogger.debug('AUTH', 'Token refreshed', { 
              userId: session?.user?.id,
              timestamp: new Date().toISOString() 
            });
          }
          
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

    // Set up visibility change handler to refresh session when tab becomes visible
    visibilityChangeHandler = async () => {
      if (document.visibilityState === 'visible') {
        console.log('[AuthContext] Tab became visible, refreshing session');
        try {
          const { data } = await supabase.auth.getSession();
          if (data.session) {
            console.log('[AuthContext] Session refreshed on visibility change');
            await handleAuthStateChange(data.session);
          } else if (state.authenticated) {
            console.log('[AuthContext] No session found on visibility change but state shows authenticated');
            await handleAuthStateChange(null);
          }
        } catch (error) {
          console.error('[AuthContext] Error refreshing session on visibility change:', error);
        }
      }
    };

    // Add visibility change listener
    document.addEventListener('visibilitychange', visibilityChangeHandler);

    // Set up a periodic session check for active tabs
    const periodicSessionCheck = setInterval(async () => {
      if (document.visibilityState === 'visible' && state.authenticated) {
        try {
          // Only attempt refresh if we're not already refreshing
          if (!refreshingSessionRef.current) {
            refreshingSessionRef.current = true;
            
            // Set a timeout to prevent hanging
            if (sessionRefreshTimeoutRef.current) {
              window.clearTimeout(sessionRefreshTimeoutRef.current);
            }
            
            sessionRefreshTimeoutRef.current = window.setTimeout(() => {
              refreshingSessionRef.current = false;
              sessionRefreshTimeoutRef.current = null;
              console.log('[AuthContext] Session refresh timed out');
            }, SESSION_REFRESH_TIMEOUT);
            
            // Attempt to refresh the session
            const { data, error } = await supabase.auth.refreshSession();
            
            // Clear timeout since we got a response
            if (sessionRefreshTimeoutRef.current) {
              window.clearTimeout(sessionRefreshTimeoutRef.current);
              sessionRefreshTimeoutRef.current = null;
            }
            
            if (error) {
              console.warn('[AuthContext] Session refresh error:', error);
              // If refresh fails and we thought we were authenticated, update state
              if (state.authenticated) {
                await handleAuthStateChange(null);
              }
            } else if (data.session) {
              if (AUTH_DEBUG) console.log('[AuthContext] Session refreshed successfully');
              await handleAuthStateChange(data.session);
            } else if (state.authenticated) {
              // No session returned but we thought we were authenticated
              await handleAuthStateChange(null);
            }
          }
        } catch (error) {
          console.error('[AuthContext] Error during periodic session check:', error);
        } finally {
          refreshingSessionRef.current = false;
          if (sessionRefreshTimeoutRef.current) {
            window.clearTimeout(sessionRefreshTimeoutRef.current);
            sessionRefreshTimeoutRef.current = null;
          }
        }
      }
    }, 60000); // Check every minute

    initAuth();

    return () => {
      if (visibilityChangeHandler) {
        document.removeEventListener('visibilitychange', visibilityChangeHandler);
      }
      
      // Clear interval and timeout on unmount
      clearInterval(periodicSessionCheck);
      if (sessionRefreshTimeoutRef.current) {
        window.clearTimeout(sessionRefreshTimeoutRef.current);
        sessionRefreshTimeoutRef.current = null;
      }
    };
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
        // Clear any pending session refresh
        if (sessionRefreshTimeoutRef.current) {
          window.clearTimeout(sessionRefreshTimeoutRef.current);
          sessionRefreshTimeoutRef.current = null;
        }
        refreshingSessionRef.current = false;
        
        // Reset context state before attempting Supabase signout
        setState({
          user: null,
          profile: null,
          loading: false,
          authenticated: false
        });

        // Clear all local state and auth data
        await clearAuthStates();
        
        // Then try to sign out from Supabase
        try {
          // Sign out without checking session first
          await supabase.auth.signOut({
            scope: 'local' // Use local scope to prevent 403 error
          }).then(() => {
            if (AUTH_DEBUG) console.log('[AuthContext] Supabase sign out successful');
          }).catch(e => {
            console.warn('[AuthContext] Supabase sign out error:', e);
          });
        } catch (signOutError) {
          // Log but continue - we'll still clear local state
          authLogger.debug('AUTH', 'Supabase sign out failed, continuing with cleanup', {
            error: signOutError instanceof Error ? signOutError.message : 'Unknown error'
          });
        }
        
        // Navigate to landing page
        navigate('/', { replace: true });
        authLogger.debug('AUTH', 'Sign out completed successfully');
        
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