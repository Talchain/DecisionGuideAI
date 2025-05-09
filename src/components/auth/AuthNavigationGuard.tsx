import React, { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { authLogger } from '../../lib/auth/authLogger';
import { clearAuthStates } from '../../lib/auth/authUtils';
import { checkAccessValidation } from '../../lib/auth/accessValidation';

export default function AuthNavigationGuard() {
  const { authenticated, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const navigationAttemptedRef = useRef(false);
  const initialLoadRef = useRef(true);
  const debugLogRef = useRef(0);
  const publicRoutes = ['/', '/about'];
  const authRoutes = ['/login', '/signup', '/forgot-password', '/reset-password'];

  useEffect(() => {
    debugLogRef.current++;
    console.debug('[AuthNavigationGuard] Navigation check', {
      attempt: debugLogRef.current,
      path: location.pathname,
      loading,
      authenticated,
      initialLoad: initialLoadRef.current,
      hasValidAccess: checkAccessValidation(),
      timestamp: new Date().toISOString()
    });

    // Skip if loading or navigation already attempted
    if (loading) {
      authLogger.debug('AUTH', 'Waiting for auth state', {
        path: location.pathname,
        loading,
        authenticated,
        initialLoad: initialLoadRef.current
      });
      return;
    }

    const isAuthRoute = authRoutes.includes(location.pathname);
    const isPublicRoute = publicRoutes.includes(location.pathname);
    const hasValidAccess = !authenticated && checkAccessValidation();

    console.debug('[AuthNavigationGuard] Navigation decision', {
      isAuthRoute,
      isPublicRoute,
      hasValidAccess,
      shouldRedirect: !hasValidAccess && !isPublicRoute && !isAuthRoute
    });

    // Handle initial load
    if (initialLoadRef.current) {
      initialLoadRef.current = false;
      
      // If authenticated, clear early access and redirect from public routes
      if (authenticated) {
        clearAuthStates();
        // Only redirect from landing page, not other public routes
        if (location.pathname === '/') {
          navigate('/decision', { replace: true });
          return;
        }
      }
      // If not authenticated and no access, redirect to landing
      else if (!hasValidAccess && !isPublicRoute && !isAuthRoute) {
        navigate('/', { replace: true });
        return;
      }
    }

    // Handle auth routes
    if (isAuthRoute) {
      if (authenticated) {
        navigate('/decision', { replace: true });
      }
      return;
    }

    // Handle non-public routes
    if (!isPublicRoute) {
      if (!authenticated && !hasValidAccess) {
        navigate('/', { replace: true });
        return;
      }
      return; // Allow access for authenticated or early access users
    }

    // Handle public routes for authenticated users
    // Only redirect from landing page when authenticated
    if (location.pathname === '/' && authenticated) {
      navigate('/decision', { replace: true });
    }
  }, [authenticated, loading, location.pathname, navigate]);


  return null;
}