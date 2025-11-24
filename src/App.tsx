import { useEffect, lazy, Suspense } from 'react'
import {
  Routes,
  Route,
  Navigate,
  useLocation
} from 'react-router-dom'
import { supabase } from './lib/supabase'
import { isE2EEnabled } from './flags'
import { isPocOnly } from './lib/poc'
import { checkAccessValidation } from './lib/auth/accessValidation'
import { useAuth } from './contexts/AuthContext'
import { useLimitsStore } from './stores/limitsStore'
import ErrorBoundary from './components/ErrorBoundary'
import Navbar from './components/navigation/Navbar'

import LandingPage from './components/LandingPage'
import About from './components/About'
import AuthLayout from './components/navigation/AuthLayout'
import LoginForm from './components/auth/LoginForm'
import SignUpForm from './components/auth/SignUpForm'
import ForgotPasswordForm from './components/auth/ForgotPasswordForm'
import ResetPasswordForm from './components/auth/ResetPasswordForm'
import ProfileForm from './components/auth/ProfileForm'
import ProtectedRoute from './components/auth/ProtectedRoute'
import LoadingSpinner from './components/LoadingSpinner'

import DecisionList from './components/decisions/DecisionList'
import DecisionForm from './components/decisions/DecisionForm'
import AuthNavigationGuard from './components/auth/AuthNavigationGuard'

import MyTeams from './components/teams/MyTeams'
import TeamDetails from './components/teams/TeamDetails'    // ← Newly added import

import DecisionTypeSelector from './components/DecisionTypeSelector'
import DecisionDetails from './components/DecisionDetails'
import ImportanceSelector from './components/ImportanceSelector'
import ReversibilitySelector from './components/ReversibilitySelector'
import GoalClarificationScreen from './components/GoalClarificationScreen'
import OptionsIdeation from './components/OptionsIdeation'
import CriteriaForm from './components/CriteriaForm'
import Analysis from './components/Analysis'

import SandboxStreamPanel from './components/SandboxStreamPanel'
import GhostPanel from './plotLite/GhostPanel'
import { DecisionProvider } from './contexts/DecisionContext'
import { TeamsProvider }  from './contexts/TeamsContext'
import { TemplatesErrorBoundary } from './routes/templates/TemplatesErrorBoundary'

// Lazy load heavy routes for code splitting
const LazySandboxStreamPanel = lazy(() => import('./components/SandboxStreamPanel'))
const LazySandboxV1 = lazy(() => import('./routes/SandboxV1'))
const DecisionTemplates = lazy(() => import('./routes/templates/DecisionTemplates').then(m => ({ default: m.DecisionTemplates })))

export default function App() {
  const location = useLocation()
  const { authenticated, loading } = useAuth()
  const hasValidAccess = checkAccessValidation()
  const { loadLimits } = useLimitsStore()

  // quick sanity check + load engine limits
  useEffect(() => {
    supabase.auth.getSession().then(({ data, error }) => {
      if (import.meta.env.DEV && (typeof localStorage !== 'undefined') && localStorage.getItem('debug.logging') === '1') {
        console.log('session: [redacted]', { hasData: !!data, hasError: !!error })
      }
    })

    // Load engine limits on app mount
    loadLimits().catch(err => {
      if (import.meta.env.DEV) {
        console.error('[App] Failed to load engine limits:', err)
      }
    })
  }, [loadLimits])

  const isAuthRoute = [
    '/login','/signup','/forgot-password','/reset-password'
  ].includes(location.pathname)

  const showNavbar =
    location.pathname !== '/' &&
    !isAuthRoute &&
    (authenticated || hasValidAccess)

  if (!isE2EEnabled() && loading) return <LoadingSpinner />

  // PoC-only mode: render only the Sandbox, no nav/login/landing
  if (isPocOnly) {
    return (
      <ErrorBoundary>
        <div className="min-h-screen bg-white">
          <Routes>
            <Route path="/sandbox" element={<SandboxStreamPanel />} />
            <Route path="*" element={<Navigate to="/sandbox" replace />} />
          </Routes>
        </div>
      </ErrorBoundary>
    )
  }

  // E2E test-mode (non-prod only): minimal, deterministic surface
  if (!import.meta.env.PROD && isE2EEnabled()) {
    return (
      <ErrorBoundary>
        <div className="min-h-screen bg-white" data-testid="e2e-surface">
          <main className="container mx-auto px-4 py-6">
            <SandboxStreamPanel />
          </main>
        </div>
      </ErrorBoundary>
    )
  }

  return (
    <ErrorBoundary>
      <DecisionProvider>
        <TeamsProvider>
          <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-white to-purple-100">
            <AuthNavigationGuard />
            {showNavbar && <Navbar />}
            <main className="container mx-auto px-4 py-8">
              <ErrorBoundary>
                <Routes>
                  {/* Public */}
                  <Route path="/" element={<LandingPage />} />
                  <Route path="/about" element={<About />} />
                  <Route
                    path="/sandbox"
                    element={
                      <Suspense fallback={<LoadingSpinner />}>
                        <LazySandboxStreamPanel />
                      </Suspense>
                    }
                  />
                  <Route
                    path="/sandbox-v1"
                    element={
                      <Suspense fallback={<LoadingSpinner />}>
                        <LazySandboxV1 />
                      </Suspense>
                    }
                  />
                  <Route path="/ghost" element={<GhostPanel />} />

                  {/* Auth */}
                  <Route element={<AuthLayout />}>
                    <Route path="/login" element={<LoginForm />} />
                    <Route path="/signup" element={<SignUpForm />} />
                    <Route
                      path="/forgot-password"
                      element={<ForgotPasswordForm />}
                    />
                    <Route
                      path="/reset-password"
                      element={<ResetPasswordForm />}
                    />
                  </Route>

                  {/* Decision Flow */}
                  {(authenticated || hasValidAccess) && (
                    <>
                      <Route
                        path="/decision"
                        element={<DecisionTypeSelector />}
                      />
                      <Route
                        path="/decision/details"
                        element={<DecisionDetails />}
                      />
                      <Route
                        path="/decision/importance"
                        element={<ImportanceSelector />}
                      />
                      <Route
                        path="/decision/reversibility"
                        element={<ReversibilitySelector />}
                      />
                      <Route
                        path="/decision/goals"
                        element={<GoalClarificationScreen />}
                      />
                      <Route
                        path="/decision/options"
                        element={<OptionsIdeation />}
                      />
                      <Route
                        path="/decision/criteria"
                        element={<CriteriaForm />}
                      />
                      <Route
                        path="/decision/analysis"
                        element={<Analysis />}
                      />
                    </>
                  )}

                  {/* Protected */}
                  <Route
                    path="/decisions"
                    element={
                      <ProtectedRoute>
                        <DecisionList />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/decisions/new"
                    element={
                      <ProtectedRoute>
                        <DecisionForm />
                      </ProtectedRoute>
                    }
                  />

                  {/* Teams listing and details */}
                  <Route
                    path="/teams"
                    element={
                      <ProtectedRoute>
                        <MyTeams />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/teams/:teamId"
                    element={
                      <ProtectedRoute>
                        <TeamDetails />
                      </ProtectedRoute>
                    }
                  />

                  <Route
                    path="/profile"
                    element={
                      <ProtectedRoute>
                        <ProfileForm />
                      </ProtectedRoute>
                    }
                  />

                  {/* Templates */}
                  <Route
                    path="/templates"
                    element={
                      <ProtectedRoute>
                        <TemplatesErrorBoundary>
                          <Suspense fallback={<LoadingSpinner />}>
                            <DecisionTemplates />
                          </Suspense>
                        </TemplatesErrorBoundary>
                      </ProtectedRoute>
                    }
                  />

                  {/* Fallback */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </ErrorBoundary>
            </main>
          </div>
        </TeamsProvider>
      </DecisionProvider>
    </ErrorBoundary>
  )
}