import React, { useState, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { 
  LogIn, 
  AlertTriangle,
  Mail, 
  Lock,
  Loader,
  Eye,
  EyeOff
} from 'lucide-react';
import { authLogger } from '../../lib/auth/authLogger';
import { validateAuthInputs } from '../../lib/auth/authUtils';
import { validateAccessCode } from '../../lib/auth/accessValidation';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const timeoutRef = useRef<number | null>(null);
  const attemptCountRef = useRef(0);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [redirectPath, setRedirectPath] = useState<string | null>(null);
  
  // Extract redirect path from location state
  useEffect(() => {
    if (location.state?.from) {
      setRedirectPath(location.state.from);
    }
    
    // Display error message if provided in state
    if (location.state?.error) {
      setError(location.state.error);
    }
  }, [location.state]);

  // Clean up timeouts on unmount
  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (loading) {
      authLogger.debug('AUTH', 'Sign in blocked - already in progress');
      return;
    }

    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    authLogger.debug('AUTH', 'Login attempt starting', {
      email: trimmedEmail,
      loading,
      timestamp: new Date().toISOString()
    });

    const validationError = validateAuthInputs(trimmedEmail, trimmedPassword);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setLoading(true);

    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = window.setTimeout(() => {
      if (loading) {
        setLoading(false);
        setError('Sign in timed out. Please try again.');
        authLogger.error('ERROR', 'Sign in timeout', null, { email: trimmedEmail });
      }
    }, 10000);

    try {
      if (attemptCountRef.current > 2) {
        const delay = Math.min(attemptCountRef.current * 1000, 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      const { error: signInError } = await signIn(trimmedEmail, trimmedPassword);
      
      authLogger.debug('AUTH', 'Sign in response received', {
        error: signInError,
        timestamp: new Date().toISOString()
      });

      if (signInError) {
        attemptCountRef.current++;
        setError(signInError.message);
        return;
      }

      // Set default access code for authenticated users
      validateAccessCode('DGAIV01');

      attemptCountRef.current = 0;
      authLogger.info('AUTH', 'Sign in successful', { email: trimmedEmail });

      // Navigate to the intended destination or /decision
      const from = redirectPath || location.state?.from || '/decision/intake';
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      attemptCountRef.current++;
      authLogger.error('ERROR', 'Sign in error', err);
    } finally {
      setLoading(false);
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }
  };

  return (
    <div className="relative">
      <div className="max-w-md w-full mx-auto p-6">
        <div className="text-left mb-8">
          <h2 className="text-3xl font-bold mb-6">Welcome back</h2>
          <p className="text-gray-600">
            Sign in for personalised guidance, improved goal alignment, and more effective outcomes.
          </p>
        </div>

        <div className="relative">
          {error && (
            <div 
              className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 animate-fade-in" 
              role="alert"
            >
              <div className="flex items-start">
                <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5" />
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    Sign in failed
                  </h3>
                  <p className="mt-1 text-sm text-red-700">{error}</p>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
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
                  placeholder="Enter your password"
                  className="pl-10 pr-10 w-full px-4 py-3.5 text-base border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 group-hover:border-indigo-300"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end">
              <Link
                to="/forgot-password"
                className="text-sm font-medium text-indigo-600 hover:text-indigo-500 transition-colors"
              >
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center px-6 py-3.5 text-base font-medium text-white bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg hover:from-purple-600 hover:to-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transform hover:-translate-y-0.5 transition-all duration-200"
            >
              {loading ? (
                <>
                  <Loader className="animate-spin h-5 w-5 mr-2" />
                  Signing in...
                </>
              ) : (
                <>
                  <LogIn className="h-5 w-5 mr-2" />
                  Sign in
                </>
              )}
            </button>

            <div className="text-center mt-6">
              <p className="text-sm text-gray-600">
                Don't have an account?{' '}
                <Link
                  to="/signup"
                  className="font-medium text-indigo-600 hover:text-indigo-500 transition-colors"
                >
                  Create one now
                </Link>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}