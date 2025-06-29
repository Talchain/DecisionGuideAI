// src/components/auth/AuthNavigationGuard.tsx

import React, { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { checkAccessValidation } from '../../lib/auth/accessValidation';
import { authLogger } from '../../lib/auth/authLogger';

export default function AuthNavigationGuard() {
  const { authenticated, loading, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Refs to track navigation state
  const initialLoadRef = useRef(true);
  const lastAttemptedNavigationRef = useRef<string | null>(null);
  const previousPathnameRef = useRef<string>(location.pathname);
  const navigationInProgressRef = useRef<boolean>(false);
  const hasRedirectedRef = useRef<boolean>(false);

  const publicRoutes = ['/', '/about'];
  const authRoutes   = ['/login', '/signup', '/forgot-password', '/reset-password'];
  const decisionFlowRoutes = [
    '/decision/intake',
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
    
    // Determine target path for authenticated users
    const targetPath = isDecisionFlowRoute ? location.pathname : '/decision/intake';
    
    // Detect and prevent navigation loops
    const isNavigatingToSameRoute = lastAttemptedNavigationRef.current === location.pathname;
    const isAlreadyAtTargetPath = location.pathname === targetPath;
    
    // Log navigation state for debugging
    authLogger.debug('AUTH', 'Navigation check', {
      path: location.pathname,
      previousPath: previousPathnameRef.current,
      lastAttemptedNavigation: lastAttemptedNavigationRef.current,
      hasUser: !!user,
      isAuthRoute,
      isPublicRoute,
      isDecisionFlowRoute,
      authenticated,
      hasValidAccess,
      initialLoad: initialLoadRef.current,
      navigationInProgress: navigationInProgressRef.current,
      isNavigatingToSameRoute,
      isAlreadyAtTargetPath,
      hasRedirected: hasRedirectedRef.current
    });

    // Prevent navigation loops
    if ((isNavigatingToSameRoute && !initialLoadRef.current) || 
        navigationInProgressRef.current || 
        (authenticated && isAlreadyAtTargetPath)) {
      authLogger.debug('AUTH', 'Preventing navigation loop', {
        currentPath: location.pathname,
        lastAttemptedPath: lastAttemptedNavigationRef.current
      });
      return;
    }

    // Initial load only
    if (initialLoadRef.current) {
      initialLoadRef.current = false;
      authLogger.debug('AUTH', 'Initial load navigation check', {
        authenticated,
        path: location.pathname,
        hasValidAccess
      });

      // If we're landing *and* authenticated, jump straight into the flow
      if (authenticated && location.pathname === '/') {
        authLogger.info('AUTH', 'Redirecting authenticated user to decision flow', {
          from: location.pathname,
          to: targetPath
        });
        
        navigationInProgressRef.current = true;
        lastAttemptedNavigationRef.current = targetPath;
        hasRedirectedRef.current = true;
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
        hasRedirectedRef.current = true;
        navigate('/', { replace: true });
        return;
      }
    }

    // If on an auth page but already signed in, send them to the flow
    if (isAuthRoute && authenticated) {
      authLogger.info('AUTH', 'Redirecting authenticated user to decision flow', {
        from: location.pathname,
        to: targetPath
      });
      
      navigationInProgressRef.current = true;
      lastAttemptedNavigationRef.current = targetPath;
      hasRedirectedRef.current = true;
      navigate(targetPath, { replace: true });
      return;
    }

    // Non-public routes require auth or early access
    if (!isPublicRoute && !isAuthRoute) {
      if (!authenticated && !hasValidAccess) {
        authLogger.info('AUTH', 'Redirecting unauthenticated user without access', {
          from: location.pathname,
          to: '/',
          hasUser: !!user
        });
        
        navigationInProgressRef.current = true;
        lastAttemptedNavigationRef.current = '/';
        hasRedirectedRef.current = true;
        navigate('/', { replace: true });
        return;
      }
      // else: they've got access → let them through
    }

    // Public landing page: if you're already authed, bounce to /decision/intake
    if (location.pathname === '/' && authenticated) {
      authLogger.info('AUTH', 'Redirecting authenticated user to decision flow', {
        from: location.pathname,
        to: targetPath
      });
      
      navigationInProgressRef.current = true;
      lastAttemptedNavigationRef.current = targetPath;
      hasRedirectedRef.current = true;
      navigate(targetPath, { replace: true });
    }
    
    // Update previous pathname ref after navigation decisions
    previousPathnameRef.current = location.pathname;
    
    // Reset navigation in progress flag after the current execution cycle
    navigationInProgressRef.current = false;
    
  }, [authenticated, loading, location.pathname, navigate, user]);

  return null;
}