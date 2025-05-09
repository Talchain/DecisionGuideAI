import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { UserPlus, AlertTriangle, Brain, EuroIcon as Neurons, Mail, Lock, ArrowRight, Loader, Eye, EyeOff } from 'lucide-react';
import SignUpConfirmation from './SignUpConfirmation';
import { navDebug } from '../../lib/debug/navDebug';

export default function SignUpForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { signUp } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    navDebug.log('auth', 'SignUpForm', 'Starting form submission');
    
    // Input validation
    if (!email.trim() || !password.trim()) {
      navDebug.log('auth', 'SignUpForm', 'Validation failed - missing fields');
      setError('Please enter both email and password');
      return;
    }

    if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(email)) {
      navDebug.log('auth', 'SignUpForm', 'Validation failed - invalid email format');
      setError('Please enter a valid email address');
      return;
    }

    if (password.length < 6) {
      navDebug.log('auth', 'SignUpForm', 'Validation failed - password too short');
      setError('Password must be at least 6 characters long');
      return;
    }

    if (loading) {
      navDebug.log('auth', 'SignUpForm', 'Submission blocked - already in progress');
      return;
    }
    
    setLoading(true);
    navDebug.log('auth', 'SignUpForm', 'Starting sign up process', { 
      email,
      timestamp: new Date().toISOString()
    });

    try {
      const { error: signUpError, data } = await signUp(email, password);

      if (signUpError) {
        let errorMessage = 'Failed to create account. Please try again.';
        
        // Log the full error for debugging
        navDebug.logError('SignUpForm', 'Sign up error details', {
          code: signUpError.code,
          message: signUpError.message,
          details: signUpError.details
        });

        if (signUpError.message?.includes('already registered') || signUpError.message?.includes('already exists')) {
          errorMessage = 'An account with this email already exists. Please sign in instead.';
        } else if (signUpError.message?.includes('password')) {
          errorMessage = 'Password must be at least 6 characters long';
        }

        setError(errorMessage);
        navDebug.log('auth', 'SignUpForm', 'Sign up failed with error', {
          code: signUpError.code,
          message: errorMessage
        });
        setLoading(false);
        return;
      }

      if (data?.user) {
        setSuccess(true);
        navDebug.log('auth', 'SignUpForm', 'Sign up successful', { 
          userId: data.user.id,
          email: data.user.email,
          timestamp: new Date().toISOString()
        });
      } else {
        setError('Failed to create account. Please try again.');
        navDebug.log('auth', 'SignUpForm', 'Sign up failed - no user data', {
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      navDebug.logError('SignUpForm', 'Unexpected sign up error', error);
      // Provide more helpful error message to user
      let userMessage = 'An unexpected error occurred. Please try again.';
      if (error instanceof Error) {
        if (error.message.includes('network')) {
          userMessage = 'Unable to connect. Please check your internet connection.';
        } else if (error.message.includes('timeout')) {
          userMessage = 'The request timed out. Please try again.';
        }
      }
      setError(error instanceof Error ? error.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
      navDebug.log('auth', 'SignUpForm', 'Sign up process completed', {
        success: success || false,
        hasError: !!error,
        timestamp: new Date().toISOString()
      });
    }
  };

  if (success) {
    return <SignUpConfirmation email={email} />;
  }

  return (
    <div className="relative">
      <div className="max-w-md w-full mx-auto p-6">
        <div className="text-left mb-8">
          <h2 className="text-3xl font-bold mb-6">Create your account</h2>
          <p className="text-gray-600">
            Sign up to start making better decisions with science-backed methods and AI-powered insights.
          </p>
        </div>

        <div className="relative">
          {error && (
            <div 
              className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 animate-fade-in" 
              role="alert"
            >
              <div className="flex">
                <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5" />
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Sign up failed</h3>
                  <div className="mt-2 text-sm text-red-700">{error}</div>
                </div>
              </div>
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div className="relative group">
                <Mail className="absolute left-3 top-3.5 h-5 w-5 text-gray-400 group-hover:text-indigo-500 transition-colors" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="pl-10 w-full px-4 py-3.5 text-base border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 group-hover:border-indigo-300"
                  required
                  disabled={loading}
                />
              </div>

              <div className="relative group">
                <Lock className="absolute left-3 top-3.5 h-5 w-5 text-gray-400 group-hover:text-indigo-500 transition-colors" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a password"
                  className="pl-10 pr-10 w-full px-4 py-3.5 text-base border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 group-hover:border-indigo-300"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600 focus:outline-none"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center px-6 py-3.5 text-base font-medium text-white bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg hover:from-purple-600 hover:to-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transform hover:-translate-y-0.5 transition-all duration-200">
              {loading ? (
                <>
                  <Loader className="animate-spin h-5 w-5 mr-2" />
                  Creating account...
                </>
              ) : (
                <>
                  <UserPlus className="h-5 w-5 mr-2" />
                  Create account
                </>
              )}
            </button>

            <div className="text-center">
              <p className="text-sm text-gray-600">
                Already have an account?{' '}
                <Link
                  to="/login"
                  className="font-medium text-indigo-600 hover:text-indigo-500 transition-colors"
                >
                  Sign in
                  <ArrowRight className="inline-block ml-1 h-4 w-4" />
                </Link>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}