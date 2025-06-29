// src/components/auth/AuthNavigationGuard.tsx

import React, { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
// import { clearAuthStates } from '../../lib/auth/authUtils';  ← no longer needed here
import { checkAccessValidation } from '../../lib/auth/accessValidation';
import { authLogger } from '../../lib/auth/authLogger';

export default function AuthNavigationGuard() {
  const { authenticated, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const initialLoadRef = useRef(true);

  const publicRoutes = ['/', '/about'];
  const authRoutes = ['/login', '/signup', '/forgot-password', '/reset-password'];
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
    
    console.log("[AuthNavigationGuard] Navigation check:", {
      path: location.pathname,
      isAuthRoute,
      isPublicRoute,
      isDecisionFlowRoute,
      authenticated,
      hasValidAccess,
      initialLoad: initialLoadRef.current
    });

    // Initial load only
    if (initialLoadRef.current) {
      initialLoadRef.current = false;

      // If we're landing *and* authenticated, jump straight into the flow
      if (authenticated && location.pathname === '/') {
        console.log("[AuthNavigationGuard] Authenticated user on landing page, redirecting to intake");
        navigate('/decision/intake', { replace: true });
      }

      // If un-authed and no early-access, any protected URL → landing
      if (!authenticated && !hasValidAccess && !isPublicRoute && !isAuthRoute) {
        console.log("[AuthNavigationGuard] Unauthenticated user without access code on protected route, redirecting to landing");
        navigate('/', { replace: true });
        return;
      }
    }

    // If on an auth page but already signed in, send them to the flow
    if (isAuthRoute && authenticated) {
       console.log("[AuthNavigationGuard] Authenticated user on auth page, redirecting to intake");
      navigate('/decision/intake', { replace: true });
    }

    // Non-public routes require auth or early access
    if (!isPublicRoute && !isAuthRoute) {
      if (!authenticated && !hasValidAccess) {
         console.log("[AuthNavigationGuard] Unauthenticated user without access code on protected route, redirecting to landing");
        navigate('/', { replace: true });
        return;
      }
      // else: they’ve got access → let them through
       console.log("[AuthNavigationGuard] User has access, allowing through to:", location.pathname);
    }

    // Public landing page: if you’re already authed, bounce to /decision
    if (location.pathname === '/' && authenticated) {
       console.log("[AuthNavigationGuard] Authenticated user on landing page, redirecting to intake");
      // No need to navigate since '/' is now the intake screen
    }
  }, [authenticated, loading, location.pathname, navigate]);

  return null;
}