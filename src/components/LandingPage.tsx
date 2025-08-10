import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ArrowRight,
  Mail,
  Lock, Eye, EyeOff,
  AlertTriangle,
  CheckCircle,
  GitBranch as CodeBranch,
  Sparkles,
  UserCog,
  Brain,
  EuroIcon as Neurons,
} from 'lucide-react';
import { registerInterest } from '../lib/api';
import { validateAccessCode } from '../lib/auth/accessValidation';
import { useAuth } from '../contexts/AuthContext';
import { authLogger } from '../lib/auth/authLogger';
import ConfettiConfirmation from './ConfettiConfirmation';

interface FormState {
  email: string;
  accessCode: string;
}

interface FormErrors {
  email?: string;
  accessCode?: string;
}

export default function LandingPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [showAccessCode, setShowAccessCode] = useState(false);
  const [formState, setFormState] = useState<FormState>({
    email: '',
    accessCode: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
  const navigationAttemptedRef = useRef(false);
  
  // Animation state for feature cards
  const [visibleCards, setVisibleCards] = useState<boolean[]>([false, false, false, false]);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  
  // Intersection Observer for scroll animations
  const observerCallback = useCallback((entries: IntersectionObserverEntry[]) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const index = cardRefs.current.findIndex(ref => ref === entry.target);
        if (index !== -1) {
          setVisibleCards(prev => {
            const newState = [...prev];
            newState[index] = true;
            return newState;
          });
        }
      }
    });
  }, []);
  
  useEffect(() => {
    const observer = new IntersectionObserver(observerCallback, {
      threshold: 0.2,
      rootMargin: '0px 0px -50px 0px'
    });
    
    cardRefs.current.forEach(ref => {
      if (ref) observer.observe(ref);
    });
    
    return () => {
      cardRefs.current.forEach(ref => {
        if (ref) observer.unobserve(ref);
      });
    };
  }, [observerCallback]);

  // Handle navigation for authenticated users
  useEffect(() => {
    // Skip if loading or navigation already attempted
    if (loading || navigationAttemptedRef.current) {
      return;
    }

    // Only navigate if we have a user
    if (user) {
      navigationAttemptedRef.current = true;
      authLogger.info('AUTH', 'Redirecting authenticated user', {
        userId: user.id,
      });
      navigate('/decision', { replace: true });
    }
  }, [user, loading, navigate]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setErrors({});
    setSuccess(null);
    setIsSubmitting(true);

    try {
      const { error } = await registerInterest(formState.email);

      if (error) {
        switch (error.code) {
          case '23505':
            setErrors((prev) => ({ ...prev, email: error.message }));
            break;
          case '23514':
            setErrors((prev) => ({
              ...prev,
              email: 'Please enter a valid email address.',
            }));
            break;
          case 'CHECK_ERROR':
            setErrors((prev) => ({
              ...prev,
              email: 'Unable to verify registration status. Please try again.',
            }));
            break;
          default:
            setErrors((prev) => ({
              ...prev,
              email: error.message || 'An error occurred. Please try again.',
            }));
        }
        return;
      }

      setRegisteredEmail(formState.email);
      setFormState((prev) => ({ ...prev, email: '' }));
    } catch (error) {
      console.error('Registration error:', error);
      setErrors((prev) => ({
        ...prev,
        email: 'An unexpected error occurred. Please try again later.',
      }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAccessSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setErrors({});
    setSuccess(null);
    setIsSubmitting(true);

    try {
      const { isValid, error } = validateAccessCode(formState.accessCode);

      if (!isValid) {
        setErrors((prev) => ({
          ...prev,
          accessCode: error || 'Invalid access code',
        }));
        setIsSubmitting(false);
        return;
      }

      setSuccess('Access granted! Redirecting...');

      // Small delay to ensure state updates are processed
      setTimeout(() => {
        navigate('/decision', { replace: true });
      }, 100);
    } catch (error) {
      console.error('Access code validation error:', error);
      setErrors((prev) => ({
        ...prev,
        accessCode: 'An error occurred. Please try again.',
      }));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 animate-gradient-shift">
      {/* Sign In Link */}
      <div className="absolute top-0 right-0 p-6 md:p-8 z-50">
        <Link
          to="/login"
          className="
            inline-flex items-center justify-center
            min-w-[100px] min-h-[44px]
            px-6 py-3
            text-sm font-medium
            text-gray-700
            bg-white
            hover:text-white
            hover:bg-gradient-to-r hover:from-purple-500 hover:to-indigo-500
            rounded-lg
            shadow-md hover:shadow-xl
            transform hover:-translate-y-1 active:scale-[0.98]
            transition-all duration-200
            border border-gray-200
            focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500
          "
        >
          Sign in
        </Link>
      </div>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-10 pb-2 lg:pt-[10px] lg:pb-[20px] animate-scale-in">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap -mx-4">
            <div className="w-full px-4">
              <div className="text-left mx-auto">
                <div className="flex gap-4 mb-5">
                  <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold leading-tight text-gray-900">
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">
                      Olumi
                    </span>
                  </h1>
                </div>
                <h3 className="mb-5 text-2xl sm:text-2xl md:text-4xl">
                  <span className="block text-gray-600">
                    Better decisions faster.
                  </span>
                </h3>
                <div className="mt-6">
                  <Link
                    to="/decision/intake"
                    className="inline-flex items-center px-6 py-3 text-base font-medium text-white bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg hover:from-purple-600 hover:to-indigo-600 hover:shadow-xl transform hover:-translate-y-1 active:scale-[0.98] transition-all duration-200"
                  >
                    Start Making Better Decisions
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Forms Section */}
      <section className="py-12 backdrop-blur-sm animate-float-up">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-8 max-w-7xl mx-auto items-start">
            {/* Early Access Registration */}
            <div className="bg-white rounded-2xl shadow-lg p-8 md:p-10 flex flex-col h-full transform hover:scale-[1.01] transition-all duration-300 w-full text-left">
              {registeredEmail ? (
                <div className="h-[400px]">
                  <ConfettiConfirmation email={registeredEmail} />
                </div>
              ) : (
                <>
                  <div className="mb-8">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">
                      Get Early Access
                    </h2>
                    <p className="text-gray-600">
                      Start making smarter decisions with science-backed methods
                      and AI-powered insights — join the waitlist now for early
                      access.
                    </p>
                  </div>

                  <form onSubmit={handleEmailSubmit} className="mt-auto flex flex-col gap-4">
                    <div className="relative">
                      <div className="relative group">
                        <Mail className="absolute left-3 top-3.5 h-5 w-5 text-gray-400 group-hover:text-indigo-500 transition-colors" />
                        <input
                          type="email"
                          name="email"
                          value={formState.email}
                          onChange={handleInputChange}
                          placeholder="Enter your email"
                          className="pl-10 w-full px-4 py-3.5 text-base border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 group-hover:border-indigo-300"
                          disabled={isSubmitting}
                        />
                      </div>
                      {errors.email && (
                        <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                          <span>{errors.email}</span>
                        </p>
                      )}
                    </div>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full flex items-center justify-center px-6 py-3.5 text-base font-medium text-white bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg hover:from-purple-600 hover:to-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transform hover:-translate-y-1 hover:shadow-xl active:scale-[0.98] transition-all duration-200"
                    >
                      {isSubmitting ? 'Processing...' : 'Request Early Access'}
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </button>
                  </form>
                </>
              )}
            </div>

            {/* Access Code Entry */}
            <div className="bg-white rounded-2xl shadow-lg p-8 md:p-10 flex flex-col h-full transform hover:scale-[1.01] transition-all duration-300 w-full text-left">
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">
                  Have an Access Code?
                </h2>
                <p className="text-gray-600">
                  If you already have your early access code, enter it here to
                  get started making better decisions.
                </p>
              </div>

              <form onSubmit={handleAccessSubmit} className="mt-auto flex flex-col gap-4">
                <div className="relative">
                  <div className="relative group">
                    <Lock className="absolute left-3 top-3.5 h-5 w-5 text-gray-400 group-hover:text-indigo-500 transition-colors" />
                    <input
                      type={showAccessCode ? 'text' : 'password'}
                      name="accessCode"
                      value={formState.accessCode}
                      onChange={handleInputChange}
                      placeholder="Enter access code"
                      className="pl-10 pr-10 w-full px-4 py-3.5 text-base border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 group-hover:border-indigo-300"
                      disabled={isSubmitting}
                    />
                    <button
                      type="button"
                      onClick={() => setShowAccessCode(!showAccessCode)}
                      className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 rounded-full p-1"
                      aria-label={showAccessCode ? 'Hide access code' : 'Show access code'}
                    >
                      {showAccessCode ? (
                        <EyeOff className="h-5 w-5" />
                      ) : (
                        <Eye className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                  {errors.accessCode && (
                    <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                      <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                      <span>{errors.accessCode}</span>
                    </p>
                  )}
                </div>
                <button
                  type="submit"
                  href="/decision/intake" 
                  className="w-full flex items-center justify-center px-6 py-3.5 text-base font-medium text-white bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg hover:from-purple-600 hover:to-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transform hover:-translate-y-1 hover:shadow-xl active:scale-[0.98] transition-all duration-200"
                >
                  {isSubmitting ? 'Verifying...' : 'Enter Olumi'}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </button>
              </form>
            </div>
          </div>

          {/* Success Message */}
          {success && (
            <div className="max-w-md mx-auto mt-8">
              <div className="p-4 bg-green-50 rounded-lg flex items-start gap-2 animate-fade-in">
                <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                <p className="text-green-700">{success}</p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div 
              ref={el => cardRefs.current[0] = el}
              className={`p-6 bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-300 transform hover:-translate-y-1 group ${
                visibleCards[0] ? 'animate-float-up' : 'opacity-0 translate-y-8'
              }`}
              style={{ animationDelay: '0.1s' }}
            >
              <div className="p-3 bg-indigo-50 rounded-lg w-12 h-12 flex items-center justify-center mb-4">
                <CodeBranch className="h-6 w-6 text-indigo-600 transition-transform duration-300 ease-in-out group-hover:scale-110 group-hover:rotate-45" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Science-backed
              </h3>
              <p className="text-gray-600">
                Proven frameworks to analyse options, risks/rewards, and
                potential outcomes.
              </p>
            </div>

            <div 
              ref={el => cardRefs.current[1] = el}
              className={`p-6 bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-300 transform hover:-translate-y-1 group ${
                visibleCards[1] ? 'animate-float-up' : 'opacity-0 translate-y-8'
              }`}
              style={{ animationDelay: '0.2s' }}
            >
              <div className="p-3 bg-green-50 rounded-lg w-12 h-12 flex items-center justify-center mb-4">
                <Brain className="h-6 w-6 text-green-600 transition-transform duration-300 ease-in-out group-hover:scale-110 group-hover:animate-pulse" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Bias mitigation
              </h3>
              <p className="text-gray-600">
                Cognitive bias awareness and emotional regulation through
                real-time analysis and recommendations.
              </p>
            </div>

            <div 
              ref={el => cardRefs.current[2] = el}
              className={`p-6 bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-300 transform hover:-translate-y-1 group ${
                visibleCards[2] ? 'animate-float-up' : 'opacity-0 translate-y-8'
              }`}
              style={{ animationDelay: '0.3s' }}
            >
              <div className="p-3 bg-purple-50 rounded-lg w-12 h-12 flex items-center justify-center mb-4">
                <Sparkles className="h-6 w-6 text-purple-600 transition-transform duration-300 ease-in-out group-hover:animate-[sparkle_0.5s_ease-in-out]" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                AI-powered
              </h3>
              <p className="text-gray-600">
                Powerful insights, overlooked influences, alternative
                perspectives, and optimal choices.
              </p>
            </div>

            <div 
              ref={el => cardRefs.current[3] = el}
              className={`p-6 bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-300 transform hover:-translate-y-1 group ${
                visibleCards[3] ? 'animate-float-up' : 'opacity-0 translate-y-8'
              }`}
              style={{ animationDelay: '0.4s' }}
            >
              <div className="p-3 bg-blue-50 rounded-lg w-12 h-12 flex items-center justify-center mb-4">
                <UserCog className="h-6 w-6 text-blue-600 transition-transform duration-300 ease-in-out group-hover:animate-[usercog_0.5s_ease-in-out]" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Personalised guidance
              </h3>
              <p className="text-gray-600">
                More effective outcomes, improved goal alignment, and deeper
                learning.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
