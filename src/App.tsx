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

// Core components (always needed)
import LandingPage from './components/LandingPage'
import AuthLayout from './components/navigation/AuthLayout'
import LoginForm from './components/auth/LoginForm'
import SignUpForm from './components/auth/SignUpForm'
import ForgotPasswordForm from './components/auth/ForgotPasswordForm'
import ResetPasswordForm from './components/auth/ResetPasswordForm'
import ProtectedRoute from './components/auth/ProtectedRoute'
import LoadingSpinner from './components/LoadingSpinner'
import AuthNavigationGuard from './components/auth/AuthNavigationGuard'
import SandboxStreamPanel from './components/SandboxStreamPanel'
import { DecisionProvider } from './contexts/DecisionContext'
import { TeamsProvider }  from './contexts/TeamsContext'
import { TemplatesErrorBoundary } from './routes/templates/TemplatesErrorBoundary'

// Lazy load heavy routes for code splitting (P1.2 Bundle Optimization)
const LazySandboxStreamPanel = lazy(() => import('./components/SandboxStreamPanel'))
const LazySandboxV1 = lazy(() => import('./routes/SandboxV1'))
const CopilotSandboxPage = lazy(() => import('./pages/sandbox-copilot'))
const DecisionTemplates = lazy(() => import('./routes/templates/DecisionTemplates').then(m => ({ default: m.DecisionTemplates })))

// Lazy load protected routes
const About = lazy(() => import('./components/About'))
const ProfileForm = lazy(() => import('./components/auth/ProfileForm'))
const DecisionList = lazy(() => import('./components/decisions/DecisionList'))
const DecisionForm = lazy(() => import('./components/decisions/DecisionForm'))
const MyTeams = lazy(() => import('./components/teams/MyTeams'))
const TeamDetails = lazy(() => import('./components/teams/TeamDetails'))
const GhostPanel = lazy(() => import('./plotLite/GhostPanel'))

// Lazy load decision flow components (only needed when going through flow)
const DecisionTypeSelector = lazy(() => import('./components/DecisionTypeSelector'))
const DecisionDetails = lazy(() => import('./components/DecisionDetails'))
const ImportanceSelector = lazy(() => import('./components/ImportanceSelector'))
const ReversibilitySelector = lazy(() => import('./components/ReversibilitySelector'))
const GoalClarificationScreen = lazy(() => import('./components/GoalClarificationScreen'))
const OptionsIdeation = lazy(() => import('./components/OptionsIdeation'))
const CriteriaForm = lazy(() => import('./components/CriteriaForm'))
const Analysis = lazy(() => import('./components/Analysis'))

export default function App() {
  const location = useLocation()
  const { authenticated, loading } = useAuth()
  const hasValidAccess = checkAccessValidation()
  // React #185 FIX: Don't destructure loadLimits as it creates a new reference each render
  // Instead, access it directly from the store state in the effect

  // quick sanity check + load engine limits
  useEffect(() => {
    supabase.auth.getSession().then(({ data, error }) => {
      if (import.meta.env.DEV && (typeof localStorage !== 'undefined') && localStorage.getItem('debug.logging') === '1') {
        console.log('session: [redacted]', { hasData: !!data, hasError: !!error })
      }
    })

    // Load engine limits on app mount - access store method directly to avoid dependency issues
    useLimitsStore.getState().loadLimits().catch(err => {
      if (import.meta.env.DEV) {
        console.error('[App] Failed to load engine limits:', err)
      }
    })
  }, []) // Empty deps - only run on mount

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
                  <Route path="/about" element={
                    <Suspense fallback={<LoadingSpinner />}>
                      <About />
                    </Suspense>
                  } />
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
                  {/* Copilot Variant - Feature Flag Controlled */}
                  {import.meta.env.VITE_COPILOT_ENABLED === 'true' && (
                    <Route
                      path="/sandbox/copilot"
                      element={
                        <Suspense fallback={<LoadingSpinner />}>
                          <CopilotSandboxPage />
                        </Suspense>
                      }
                    />
                  )}
                  <Route path="/ghost" element={
                    <Suspense fallback={<LoadingSpinner />}>
                      <GhostPanel />
                    </Suspense>
                  } />

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

                  {/* Decision Flow (lazy loaded) */}
                  {(authenticated || hasValidAccess) && (
                    <>
                      <Route
                        path="/decision"
                        element={<Suspense fallback={<LoadingSpinner />}><DecisionTypeSelector /></Suspense>}
                      />
                      <Route
                        path="/decision/details"
                        element={<Suspense fallback={<LoadingSpinner />}><DecisionDetails /></Suspense>}
                      />
                      <Route
                        path="/decision/importance"
                        element={<Suspense fallback={<LoadingSpinner />}><ImportanceSelector /></Suspense>}
                      />
                      <Route
                        path="/decision/reversibility"
                        element={<Suspense fallback={<LoadingSpinner />}><ReversibilitySelector /></Suspense>}
                      />
                      <Route
                        path="/decision/goals"
                        element={<Suspense fallback={<LoadingSpinner />}><GoalClarificationScreen /></Suspense>}
                      />
                      <Route
                        path="/decision/options"
                        element={<Suspense fallback={<LoadingSpinner />}><OptionsIdeation /></Suspense>}
                      />
                      <Route
                        path="/decision/criteria"
                        element={<Suspense fallback={<LoadingSpinner />}><CriteriaForm /></Suspense>}
                      />
                      <Route
                        path="/decision/analysis"
                        element={<Suspense fallback={<LoadingSpinner />}><Analysis /></Suspense>}
                      />
                    </>
                  )}

                  {/* Protected (lazy loaded) */}
                  <Route
                    path="/decisions"
                    element={
                      <ProtectedRoute>
                        <Suspense fallback={<LoadingSpinner />}>
                          <DecisionList />
                        </Suspense>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/decisions/new"
                    element={
                      <ProtectedRoute>
                        <Suspense fallback={<LoadingSpinner />}>
                          <DecisionForm />
                        </Suspense>
                      </ProtectedRoute>
                    }
                  />

                  {/* Teams listing and details (lazy loaded) */}
                  <Route
                    path="/teams"
                    element={
                      <ProtectedRoute>
                        <Suspense fallback={<LoadingSpinner />}>
                          <MyTeams />
                        </Suspense>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/teams/:teamId"
                    element={
                      <ProtectedRoute>
                        <Suspense fallback={<LoadingSpinner />}>
                          <TeamDetails />
                        </Suspense>
                      </ProtectedRoute>
                    }
                  />

                  <Route
                    path="/profile"
                    element={
                      <ProtectedRoute>
                        <Suspense fallback={<LoadingSpinner />}>
                          <ProfileForm />
                        </Suspense>
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