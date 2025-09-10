// src/components/auth/AuthNavigationGuard.tsx

import React, { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
// import { clearAuthStates } from '../../lib/auth/authUtils';  ← no longer needed here
import { checkAccessValidation } from '../../lib/auth/accessValidation';

export default function AuthNavigationGuard({ children }: { children?: React.ReactNode }) {
  const { authenticated, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const initialLoadRef = useRef(true);

  const publicRoutes = ['/', '/about'];
  const authRoutes   = ['/login', '/signup', '/forgot-password', '/reset-password'];

  useEffect(() => {
    if (loading) return;

    const isAuthRoute    = authRoutes.includes(location.pathname);
    const isPublicRoute  = publicRoutes.includes(location.pathname);
    const hasValidAccess = !authenticated && checkAccessValidation();

    // Initial load only
    if (initialLoadRef.current) {
      initialLoadRef.current = false;

      // If we're landing *and* authenticated, jump straight into the flow
      if (authenticated && location.pathname === '/') {
        navigate('/decision', { replace: true });
        return;
      }

      // If un-authed and no early-access, any protected URL → landing
      if (!authenticated && !hasValidAccess && !isPublicRoute && !isAuthRoute) {
        navigate('/', { replace: true });
        return;
      }
    }

    // If on an auth page but already signed in, send them to the flow
    if (isAuthRoute && authenticated) {
      navigate('/decision', { replace: true });
      return;
    }

    // Non-public routes require auth or early access
    if (!isPublicRoute && !isAuthRoute) {
      if (!authenticated && !hasValidAccess) {
        navigate('/', { replace: true });
        return;
      }
      // else: they’ve got access → let them through
    }

    // Public landing page: if you’re already authed, bounce to /decision
    if (location.pathname === '/' && authenticated) {
      navigate('/decision', { replace: true });
    }
  }, [authenticated, loading, location.pathname, navigate]);

  return <>{children}</>;
}