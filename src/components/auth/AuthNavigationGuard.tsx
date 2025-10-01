// src/components/auth/AuthNavigationGuard.tsx

import React, { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { checkAccessValidation } from '../../lib/auth/accessValidation';
import { authLogger } from '../../lib/auth/authLogger'; 

// Route configuration for cleaner logic
const ROUTE_CONFIG = {
  public: ['/', '/about'],
  auth: ['/login', '/signup', '/forgot-password', '/reset-password'],
  decisionFlow: [
    '/decision/intake',
    '/decision/goals',
    '/decision/options',
    '/decision/criteria',
    '/decision/analysis'
  ]
} as const;

interface NavigationState {
  authenticated: boolean;
  hasValidAccess: boolean;
  currentPath: string;
  isAuthRoute: boolean;
  isPublicRoute: boolean;
  isDecisionFlowRoute: boolean;
}

function getNavigationState(
  authenticated: boolean,
  pathname: string
): NavigationState {
  return {
    authenticated,
    hasValidAccess: !authenticated && checkAccessValidation(),
    currentPath: pathname,
    isAuthRoute: ROUTE_CONFIG.auth.includes(pathname as any),
    isPublicRoute: ROUTE_CONFIG.public.includes(pathname as any),
    isDecisionFlowRoute: ROUTE_CONFIG.decisionFlow.includes(pathname as any)
  };
}

function shouldRedirectToDecisionFlow(state: NavigationState): boolean {
  return state.authenticated && (
    state.currentPath === '/' || 
    state.isAuthRoute
  );
}

function shouldRedirectToLanding(state: NavigationState): boolean {
  return !state.authenticated && 
         !state.hasValidAccess && 
         !state.isPublicRoute && 
         !state.isAuthRoute;
}
export default function AuthNavigationGuard() {
  const { authenticated, loading, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Simplified state tracking
  const initialLoadRef = useRef(true);


  useEffect(() => {
    if (loading) return;

    const navState = getNavigationState(authenticated, location.pathname);
    
    // Log navigation state for debugging
    authLogger.debug('AUTH', 'Navigation check', {
      ...navState,
      hasUser: !!user,
      initialLoad: initialLoadRef.current
    });

    // Initial load only
    if (initialLoadRef.current) {
      initialLoadRef.current = false;
      authLogger.debug('AUTH', 'Initial load navigation check', {
        ...navState
      });

      if (shouldRedirectToDecisionFlow(navState)) {
        authLogger.info('AUTH', 'Redirecting authenticated user to decision intake', {
          from: location.pathname
        });
        navigate('/decision/intake', { replace: true });
        return;
      }

      if (shouldRedirectToLanding(navState)) {
        authLogger.info('AUTH', 'Redirecting unauthenticated user without access', {
          from: location.pathname,
          to: '/'
        });

        navigate('/', { replace: true });
        return;
      }
    }

    if (shouldRedirectToDecisionFlow(navState)) {
      authLogger.info('AUTH', 'Redirecting authenticated user to decision flow', {
        from: location.pathname
      });

      navigate('/decision/intake', { replace: true });
      return;
    }


    if (shouldRedirectToLanding(navState)) {
      authLogger.info('AUTH', 'Redirecting unauthenticated user without access', {
        from: location.pathname
      });

      navigate('/', { replace: true });
    }
  }, [authenticated, loading, location.pathname, navigate, user]);

  return null;
}