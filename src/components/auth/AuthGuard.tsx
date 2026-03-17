/**
 * Auth guard — wraps protected routes.
 *
 * Checks auth state and shows:
 * - Loading spinner while session is being resolved
 * - Redirects to /login if not authenticated
 * - Renders children (Outlet) if authenticated
 *
 * Does NOT include an app bar — that is integrated into the existing
 * workspace top bar and the scenario hub's own header.
 */

import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

export default function AuthGuard() {
  const { loading, authenticated } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <Loader2 className="h-8 w-8 animate-spin text-info" />
      </div>
    )
  }

  if (!authenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <Outlet />
}
