import { useEffect } from 'react'
import {
  Routes,
  Route,
  Navigate,
  useLocation
} from 'react-router-dom'
import { supabase, isSupabaseConfigured } from './lib/supabase'
import { checkAccessValidation } from './lib/auth/accessValidation'
import { useAuth } from './contexts/AuthContext'
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
import TeamDetails from './components/teams/TeamDetails'

import DecisionTypeSelector from './components/DecisionTypeSelector'
import DecisionDetails from './components/DecisionDetails'
import ImportanceSelector from './components/ImportanceSelector'
import ReversibilitySelector from './components/ReversibilitySelector'
import GoalClarificationScreen from './components/GoalClarificationScreen'
import OptionsIdeation from './components/OptionsIdeation'
import CriteriaForm from './components/CriteriaForm'
import Analysis from './components/Analysis'

import { DecisionProvider } from './contexts/DecisionContext'
import { TeamsProvider }  from './contexts/TeamsContext'
// Sandbox support:
import { isSandboxEnabled, isWhiteboardEnabled, isStrategyBridgeEnabled, isSandboxRealtimeEnabled, isSandboxDeltaReapplyV2Enabled, isScenarioSnapshotsEnabled, isOptionHandlesEnabled, isSandboxVotingEnabled, isProjectionsEnabled, isDecisionCTAEnabled } from './lib/config'
import { SandboxRoute } from './sandbox/routes'
import { SandboxRoute as WhiteboardSandboxRoute } from './whiteboard/SandboxRoute'
import { ThemeProvider } from './contexts/ThemeContext'
import { Toaster } from './components/ui/toast/toaster'
import { FlagsProvider } from './lib/flags'

export default function App() {
  const location = useLocation()
  const { authenticated, loading } = useAuth()
  const hasValidAccess = checkAccessValidation()

  useEffect(() => {
    if (!isSupabaseConfigured) return
    supabase.auth.getSession().then(({ data, error }) => {
      console.log('session:', { data, error })
    })
  }, [])

  const isAuthRoute = [
    '/login',
    '/signup',
    '/forgot-password',
    '/reset-password'
  ].includes(location.pathname)

  const showNavbar =
    location.pathname !== '/' &&
    !isAuthRoute &&
    (authenticated || hasValidAccess)

  if (loading) return <LoadingSpinner />

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <FlagsProvider value={{
          sandbox: isSandboxEnabled(),
          strategyBridge: isStrategyBridgeEnabled(),
          realtime: isSandboxRealtimeEnabled(),
          deltaReapplyV2: isSandboxDeltaReapplyV2Enabled(),
          projections: isProjectionsEnabled(),
          scenarioSnapshots: isScenarioSnapshotsEnabled(),
          optionHandles: isOptionHandlesEnabled(),
          voting: isSandboxVotingEnabled(),
          decisionCTA: isDecisionCTAEnabled(),
        }}>
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

                    {/* Auth */}
                    <Route element={<AuthLayout />}>  
                      <Route path="/login" element={<LoginForm />} />
                      <Route path="/signup" element={<SignUpForm />} />
                      <Route path="/forgot-password" element={<ForgotPasswordForm />} />
                      <Route path="/reset-password" element={<ResetPasswordForm />} />
                    </Route>

                    {/* Decision Flow */}
                    {(authenticated || hasValidAccess) && (
                      <>
                        <Route path="/decision" element={<DecisionTypeSelector />} />
                        <Route path="/decision/details" element={<DecisionDetails />} />
                        <Route path="/decision/importance" element={<ImportanceSelector />} />
                        <Route path="/decision/reversibility" element={<ReversibilitySelector />} />
                        <Route path="/decision/goals" element={<GoalClarificationScreen />} />
                        <Route path="/decision/options" element={<OptionsIdeation />} />
                        <Route path="/decision/criteria" element={<CriteriaForm />} />
                        <Route path="/decision/analysis" element={<Analysis />} />
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

                    {/* Teams */}
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

                    {/* Sandbox */}
                    {isSandboxEnabled() && (
                      <Route path="/sandbox/*" element={<SandboxRoute />} />
                    )}

                    {isWhiteboardEnabled() && (
                      <Route
                        path="/decisions/:decisionId/sandbox"
                        element={
                          <ProtectedRoute>
                            <WhiteboardSandboxRoute />
                          </ProtectedRoute>
                        }
                      />
                    )}

                    {/* Fallback */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </ErrorBoundary>
              </main>
              <Toaster />
            </div>
          </TeamsProvider>
        </DecisionProvider>
        </FlagsProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}