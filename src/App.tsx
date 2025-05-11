// src/App.tsx

import React, { useEffect, useState } from 'react'
import {
  Routes,
  Route,
  Navigate,
  useLocation
} from 'react-router-dom'
import { supabase } from './lib/supabase'
import { checkAccessValidation } from './lib/auth/accessValidation'
import { useAuth } from './contexts/AuthContext'
import ErrorBoundary from './components/ErrorBoundary'
import Navbar from './components/navigation/Navbar'
import InviteCollaborators from './components/InviteCollaborators'

import DecisionTypeSelector     from './components/DecisionTypeSelector'
import DecisionDetails          from './components/DecisionDetails'
import ImportanceSelector       from './components/ImportanceSelector'
import ReversibilitySelector    from './components/ReversibilitySelector'
import GoalClarificationScreen  from './components/GoalClarificationScreen'
import OptionsIdeation          from './components/OptionsIdeation'
import CriteriaForm             from './components/CriteriaForm'
import Analysis                 from './components/Analysis'

import LandingPage      from './components/LandingPage'
import About            from './components/About'
import AuthLayout       from './components/navigation/AuthLayout'
import LoginForm        from './components/auth/LoginForm'
import SignUpForm       from './components/auth/SignUpForm'
import ForgotPasswordForm from './components/auth/ForgotPasswordForm'
import ResetPasswordForm  from './components/auth/ResetPasswordForm'
import ProfileForm      from './components/auth/ProfileForm'
import ProtectedRoute   from './components/auth/ProtectedRoute'
import DecisionList     from './components/decisions/DecisionList'
import DecisionForm     from './components/decisions/DecisionForm'
import AuthNavigationGuard from './components/auth/AuthNavigationGuard'
import LoadingSpinner   from './components/LoadingSpinner'
import { DecisionProvider } from './contexts/DecisionContext'

export default function App() {
  const location = useLocation()
  const { authenticated, loading } = useAuth()
  const hasValidAccess = checkAccessValidation()

  // control our Invite modal here
  const [showInviteModal, setShowInviteModal] = useState(false)

  // supabase session sanity-check
  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data, error }) => console.log('✅ Session:', { data, error }))
      .catch(err => console.error('❌ getSession error:', err))
  }, [])

  // which navbar routes are “Auth” screens?
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

  // only allow invite on these two wizard steps
  const inviteAllowed = [
    '/decision/goals',
    '/decision/options'
  ].includes(location.pathname)

  return (
    <ErrorBoundary>
      <DecisionProvider>
        {/* Invite modal toggled by state */}
        {showInviteModal && inviteAllowed && (
          <InviteCollaborators onClose={() => setShowInviteModal(false)} />
        )}

        <AuthNavigationGuard />

        {showNavbar && (
          <Navbar
            onInvite={() => {
              if (inviteAllowed) setShowInviteModal(true)
            }}
          />
        )}

        <main className="container mx-auto px-4 py-8">
          <ErrorBoundary>
            <Routes>
              {/* Public */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/about" element={<About />} />

              {/* Auth (no invite here) */}
              <Route element={<AuthLayout />}>
                <Route path="/login" element={<LoginForm />} />
                <Route path="/signup" element={<SignUpForm />} />
                <Route path="/forgot-password" element={<ForgotPasswordForm />} />
                <Route path="/reset-password" element={<ResetPasswordForm />} />
              </Route>

              {/* Wizard flow (no separate /decision/invite route) */}
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
      </DecisionProvider>
    </ErrorBoundary>
  )
}