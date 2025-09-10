import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { authLogger } from '../../lib/auth/authLogger';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading, profile, authenticated } = useAuth();
  const location = useLocation();

  // Log protection check
  authLogger.debug('STATE', 'Protected route check', {
    path: location.pathname,
    hasUser: !!user,
    hasProfile: !!profile,
    authenticated,
    loading,
    timestamp: new Date().toISOString()
  });

  // Show loading spinner while auth state is being determined
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!authenticated || !user) {
    authLogger.info('STATE', 'Protected route access denied', {
      path: location.pathname,
      hasUser: !!user,
      hasProfile: !!profile,
      authenticated
    });
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  // Log successful access
  authLogger.info('STATE', 'Protected route access granted', {
    path: location.pathname,
    userId: user.id,
    authenticated
  });

  // Render protected content
  return <>{children}</>;
}