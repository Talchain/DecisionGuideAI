// src/components/auth/AuthNavigationGuard.tsx

import React, { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { checkAccessValidation } from '../../lib/auth/accessValidation';
import { authLogger } from '../../lib/auth/authLogger';

export default function AuthNavigationGuard() {
  const { authenticated, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Refs to track navigation state
  const initialLoadRef = useRef(true);
  const lastAttemptedNavigationRef = useRef<string | null>(null);
  const previousPathnameRef = useRef<string>(location.pathname);
  const navigationInProgressRef = useRef<boolean>(false);

  const publicRoutes = ['/', '/about'];
  const authRoutes   = ['/login', '/signup', '/forgot-password', '/reset-password'];
  const decisionFlowRoutes = [
    '/decision/intake',
    '/decision',
    '/decision/details',
    '/decision/importance',
    '/decision/reversibility',
    '/decision/goals',
    '/decision/options',
    '/decision/criteria',
    '/decision/analysis'
  ];

  useEffect(() => {
    if (loading) return;

    const isAuthRoute    = authRoutes.includes(location.pathname);
    const isPublicRoute  = publicRoutes.includes(location.pathname);
    const isDecisionFlowRoute = decisionFlowRoutes.includes(location.pathname);
    const hasValidAccess = !authenticated && checkAccessValidation();
    
    // Detect potential navigation loops
    const targetPath = '/decision/intake';
    const isAttemptingToNavigateToSameRoute = lastAttemptedNavigationRef.current === location.pathname;
    const isRepeatedNavigation = lastAttemptedNavigationRef.current === targetPath && location.pathname === targetPath;
    
    // Log navigation state for debugging
    authLogger.debug('AUTH', 'Navigation check', {
      path: location.pathname,
      previousPath: previousPathnameRef.current,
      lastAttemptedNavigation: lastAttemptedNavigationRef.current,
      isAuthRoute,
      isPublicRoute,
      isDecisionFlowRoute,
      authenticated,
      hasValidAccess,
      initialLoad: initialLoadRef.current,
      navigationInProgress: navigationInProgressRef.current,
      isRepeatedNavigation
    });

    // Prevent navigation loops
    if (isRepeatedNavigation || navigationInProgressRef.current) {
      authLogger.debug('AUTH', 'Preventing navigation loop', {
        currentPath: location.pathname,
        lastAttemptedPath: lastAttemptedNavigationRef.current
      });
      return;
    }

    // Initial load only
    if (initialLoadRef.current) {
      initialLoadRef.current = false;

      // If we're landing *and* authenticated, jump straight into the flow
      if (authenticated && location.pathname === '/') {
        authLogger.info('AUTH', 'Redirecting authenticated user', {
          from: location.pathname,
          to: targetPath
        });
        
        navigationInProgressRef.current = true;
        lastAttemptedNavigationRef.current = targetPath;
        navigate(targetPath, { replace: true });
        return;
      }

      // If un-authed and no early-access, any protected URL → landing
      if (!authenticated && !hasValidAccess && !isPublicRoute && !isAuthRoute) {
        authLogger.info('AUTH', 'Redirecting unauthenticated user without access', {
          from: location.pathname,
          to: '/'
        });
        
        navigationInProgressRef.current = true;
        lastAttemptedNavigationRef.current = '/';
        navigate('/', { replace: true });
        return;
      }
    }

    // If on an auth page but already signed in, send them to the flow
    if (isAuthRoute && authenticated) {
      authLogger.info('AUTH', 'Redirecting authenticated user from auth page', {
        from: location.pathname,
        to: targetPath
      });
      
      navigationInProgressRef.current = true;
      lastAttemptedNavigationRef.current = targetPath;
      navigate(targetPath, { replace: true });
      return;
    }

    // Non-public routes require auth or early access
    if (!isPublicRoute && !isAuthRoute) {
      if (!authenticated && !hasValidAccess) {
        authLogger.info('AUTH', 'Redirecting unauthenticated user without access', {
          from: location.pathname,
          to: '/'
        });
        
        navigationInProgressRef.current = true;
        lastAttemptedNavigationRef.current = '/';
        navigate('/', { replace: true });
        return;
      }
      // else: they've got access → let them through
    }

    // Public landing page: if you're already authed, bounce to /decision/intake
    if (location.pathname === '/' && authenticated) {
      authLogger.info('AUTH', 'Redirecting authenticated user from landing', {
        from: location.pathname,
        to: targetPath
      });
      
      navigationInProgressRef.current = true;
      lastAttemptedNavigationRef.current = targetPath;
      navigate(targetPath, { replace: true });
    }
    
    // Update previous pathname ref after navigation decisions
    previousPathnameRef.current = location.pathname;
    
    // Reset navigation in progress flag after the current execution cycle
    setTimeout(() => {
      navigationInProgressRef.current = false;
    }, 0);
    
  }, [authenticated, loading, location.pathname, navigate]);

  return null;
}