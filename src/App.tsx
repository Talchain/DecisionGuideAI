// src/App.tsx

import React, { useEffect } from 'react';
import {
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate
} from 'react-router-dom';
import { supabase } from './lib/supabase';
import { authLogger } from './lib/auth/authLogger';
import { checkAccessValidation } from './lib/auth/accessValidation';
import { useAuth } from './contexts/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';

import DecisionList from './components/decisions/DecisionList';
import DecisionForm from './components/decisions/DecisionForm';
import AuthNavigationGuard from './components/auth/AuthNavigationGuard';
import Navbar from './components/navigation/Navbar';
import LandingPage from './components/LandingPage';
import About from './components/About';
import AuthLayout from './components/navigation/AuthLayout';
import LoginForm from './components/auth/LoginForm';
import SignUpForm from './components/auth/SignUpForm';
import ForgotPasswordForm from './components/auth/ForgotPasswordForm';
import ResetPasswordForm from './components/auth/ResetPasswordForm';
import ProfileForm from './components/auth/ProfileForm';

import DecisionTypeSelector from './components/DecisionTypeSelector';
import DecisionDetails from './components/DecisionDetails';
import InviteCollaborators from './components/InviteCollaborators';
import ImportanceSelector from './components/ImportanceSelector';
import ReversibilitySelector from './components/ReversibilitySelector';
import GoalClarificationScreen from './components/GoalClarificationScreen';
import OptionsIdeation from './components/OptionsIdeation';
import CriteriaForm from './components/CriteriaForm';
import Analysis from './components/Analysis';

import ProtectedRoute from './components/auth/ProtectedRoute';
import LoadingSpinner from './components/LoadingSpinner';

import { DecisionProvider } from './contexts/DecisionContext';

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const { authenticated, loading } = useAuth();
  const hasValidAccess = checkAccessValidation();

  // quick session-test log
  useEffect(() => {
    console.log('▶️ [Test] getSession start');
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        console.log('✅ [Test] getSession returned', { data, error });
      })
      .catch((err) => {
        console.error('❌ [Test] getSession threw', err);
      });
  }, []);

  const isAuthRoute = [
    '/login',
    '/signup',
    '/forgot-password',
    '/reset-password'
  ].includes(location.pathname);

  const showNavbar =
    location.pathname !== '/' &&
    !isAuthRoute &&
    (authenticated || hasValidAccess);

  if (loading) return <LoadingSpinner />;

  return (
    <ErrorBoundary>
      <DecisionProvider>
        <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-white to-purple-100">
          <AuthNavigationGuard />
          {showNavbar && (
            <Navbar
              onInvite={() => navigate('/decision/invite')}
            />
          )}
          <main className="container mx-auto px-4 py-8">
            <ErrorBoundary>
              <Routes>
                {/* Public */}
                <Route path="/" element={<LandingPage />} />
                <Route path="/about" element={<About />} />

                {/* Auth routes */}
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

                {/* Decision wizard */}
                {console.debug(
                  '[App] 🔐 authenticated=',
                  authenticated,
                  'hasValidAccess=',
                  hasValidAccess
                )}
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

                    {/* ← NEW: Invite step */}
                    <Route
                      path="/decision/invite"
                      element={
                        <InviteCollaborators
                          onClose={() => navigate('/decision/importance')}
                        />
                      }
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
      </DecisionProvider>
    </ErrorBoundary>
  );
}