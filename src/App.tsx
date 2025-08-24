import React, { useEffect } from 'react'
import {
  Routes,
  Route,
  Navigate,
  useLocation
} from 'react-router-dom'
import { supabase } from './lib/supabase'
import { checkAccessValidation } from './lib/auth/accessValidation'
import { useAuth } from './contexts/AuthContext'
import { SidebarProvider } from './contexts/SidebarContext'
import ErrorBoundary from './components/ErrorBoundary'
import Sidebar from './components/navigation/Sidebar'

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
import CriteriaStage from './components/CriteriaStage'
import EvaluationMethodSelector from './components/EvaluationMethodSelector'

import MyTeams from './components/teams/MyTeams'
import TeamDetails from './components/teams/TeamDetails'
import OrganisationList from './components/organisations/OrganisationList'
import OrganisationDetails from './components/organisations/OrganisationDetails'

import DecisionIntakeScreen from './components/DecisionIntakeScreen'
import TemplatesDashboard from './components/templates/TemplatesDashboard'
import GoalClarificationScreen from './components/GoalClarificationScreen'
import OptionsIdeation from './components/OptionsIdeation'
import CriteriaForm from './components/CriteriaForm'
import Analysis from './components/Analysis'
import SupabaseDiagnostics from './components/diagnostics/SupabaseDiagnostics'

import { DecisionProvider } from './contexts/DecisionContext'
import { TeamsProvider }  from './contexts/TeamsContext'
import DecisionFlowLayout from './components/navigation/DecisionFlowLayout'
import MobileNavBar from './components/navigation/MobileNavBar'

export default function App() {
  const location = useLocation()
  const { authenticated, loading } = useAuth()
  const hasValidAccess = checkAccessValidation()

  // quick sanity check
  useEffect(() => {
    supabase.auth.getSession().then(({ data, error }) => {
      console.log('session:', { data, error })
    })
  }, [])

  const isAuthRoute = [
    '/login','/signup','/forgot-password','/reset-password'
  ].includes(location.pathname)

  const showNavbar =
    location.pathname !== '/' &&
    !isAuthRoute &&
    (authenticated || hasValidAccess)

  if (loading) return <LoadingSpinner />

  return (
    <ErrorBoundary>
      <SidebarProvider>
        <DecisionProvider>
          <TeamsProvider>
            <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-white to-purple-100">
              <AuthNavigationGuard />
              <Sidebar />
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
                      <Route
                        path="/forgot-password"
                        element={<ForgotPasswordForm />}
                      />
                      <Route
                        path="/reset-password"
                        element={<ResetPasswordForm />}
                      />
                    </Route>

                    {/* Decision Flow - Wrapped in DecisionFlowLayout */}
                    <Route element={<DecisionFlowLayout />}>
                      <Route
                        path="/decision/intake"
                        element={
                          <ProtectedRoute>
                            <DecisionIntakeScreen />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/decision/goals"
                        element={
                          <ProtectedRoute>
                            <GoalClarificationScreen />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/decision/options"
                        element={
                          <ProtectedRoute>
                            <OptionsIdeation />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/decision/criteria"
                        element={
                          <ProtectedRoute>
                            <CriteriaStage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/decision/evaluate"
                        element={
                          <ProtectedRoute>
                            <EvaluationMethodSelector />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/decision/analysis"
                        element={
                          <ProtectedRoute>
                            <Analysis />
                          </ProtectedRoute>
                        }
                      />
                    </Route>

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
                      path="/templates"
                      element={
                        <ProtectedRoute>
                          <TemplatesDashboard />
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
                      path="/diagnostics"
                      element={
                        <ProtectedRoute>
                          <SupabaseDiagnostics />
                        </ProtectedRoute>
                      }
                    />
                    
                    {/* Organisations */}
                    <Route
                      path="/organisations"
                      element={
                        <ProtectedRoute>
                          <OrganisationList />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/organisations/:id"
                      element={
                        <ProtectedRoute>
                          <OrganisationDetails />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/organisations/:id/edit"
                      element={
                        <ProtectedRoute>
                          <OrganisationDetails />
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

                    {/* Fallback */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </ErrorBoundary>
              </main>
            </div>
          </TeamsProvider>
          <MobileNavBar />
        </DecisionProvider>
      </SidebarProvider>
    </ErrorBoundary>
  )
}