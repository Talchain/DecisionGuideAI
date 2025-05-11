import React, { useState, useCallback, useEffect, useRef, memo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useDecision } from '../../contexts/DecisionContext';
import { authLogger } from '../../lib/auth/authLogger';
import { 
  Brain, 
  LogIn, 
  LogOut,
  UserPlus, 
  Menu, 
  X, 
  List, 
  User, 
  PlusCircle,
  Info,
  DoorOpen
  Users
} from 'lucide-react';
import { navDebug } from '../../lib/debug/navDebug';
import { clearAccessValidation, ACCESS_VALIDATION_KEY, ACCESS_TIMESTAMP_KEY, ACCESS_CODE_KEY } from '../../lib/auth/accessValidation';
import Tooltip from '../Tooltip';

interface CollaboratorAvatarProps {
  email: string;
  role: string;
}

const CollaboratorAvatar = memo(({ email, role }: CollaboratorAvatarProps) => {
  const initials = email
    .split('@')[0]
    .split(/[^a-zA-Z]/)
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <Tooltip content={`${email} (${role})`}>
      <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm font-medium">
        {initials}
      </div>
    </Tooltip>
  );
});

CollaboratorAvatar.displayName = 'CollaboratorAvatar';

const NavLink = memo(({ to, className, children }: { to: string; className: string; children: React.ReactNode }) => (
  <Link to={to} className={className}>{children}</Link>
));

NavLink.displayName = 'NavLink';

const NavButton = memo(({ onClick, className, children, disabled }: { 
  onClick?: () => void; 
  className: string; 
  children: React.ReactNode;
  disabled?: boolean;
}) => (
  <button 
    onClick={onClick} 
    className={`${className} disabled:opacity-50 disabled:cursor-not-allowed`} 
    disabled={disabled}
  >
    {children}
  </button>
));

NavButton.displayName = 'NavButton';

function Navbar() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { collaborators, decisionId } = useDecision();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const mountedRef = useRef(true);
  const renderCountRef = useRef(0);

  // Check for access validation
  const hasValidAccess = localStorage.getItem('dga_access_validated') === 'true';

  useEffect(() => {
    const currentCount = renderCountRef.current;
    renderCountRef.current++;
    navDebug.log('render', 'Navbar', 'Component Mounted', {
      renderCount: currentCount + 1,
      authLoading,
      hasUser: !!user,
      hasValidAccess,
      timestamp: new Date().toISOString()
    });
    
    return () => {
      mountedRef.current = false;
      navDebug.log('render', 'Navbar', 'Component Unmounted', {
        timestamp: new Date().toISOString()
      });
    };
  }, [authLoading, user, hasValidAccess]);

  const handleSignOut = useCallback(async () => {
    if (isLoading) {
      authLogger.debug('AUTH', 'Sign out blocked - already in progress');
      return;
    }
    
    setIsLoading(true);
    authLogger.debug('AUTH', 'Sign out initiated');
    
    try {
      const { error } = await signOut();
      if (error) {
        authLogger.error('ERROR', 'Sign out failed', error);
        throw error;
      }
      authLogger.debug('AUTH', 'Sign out completed successfully');
    } catch (error) {
      console.error('Sign out error:', error);
      // Show error to user
      alert('Failed to sign out. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [signOut, isLoading]);

  const handleExitEarlyAccess = useCallback(async () => {
    console.log('Exit early access clicked');
    if (isLoading) {
      console.log('Exit blocked - already in progress');
      return;
    }
    
    authLogger.debug('AUTH', 'Exiting early access');
    setIsLoading(true);
    
    try {
      console.log('Clearing access validation...');
      // Clear all access-related data
      clearAccessValidation();
      
      console.log('Redirecting to landing page...');
      navigate('/', { replace: true });
      setIsOpen(false); // Close mobile menu if open
    } catch (error) {
      console.error('Error exiting early access:', error);
      console.log('Current localStorage state:', {
        validated: localStorage.getItem(ACCESS_VALIDATION_KEY),
        timestamp: localStorage.getItem(ACCESS_TIMESTAMP_KEY),
        code: localStorage.getItem(ACCESS_CODE_KEY)
      });
      // Reset loading state on error
      setIsLoading(false);
      return;
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  const renderNavLinks = useCallback((isMobile = false) => {
    const baseStyles = isMobile
      ? "flex items-center w-full px-4 py-3 text-base font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500 transition-colors"
      : "flex items-center px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors";

    const authButtonStyles = isMobile
      ? baseStyles
      : "inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md transition-colors";

    return (
      <div 
        className={isMobile ? "space-y-1" : "flex items-center space-x-4"}
        role="group"
        aria-label="Main navigation"
      >
        <NavLink
          to="/about"
          className={baseStyles}
        >
          <Info className={`h-5 w-5 ${isMobile ? 'mr-3' : 'mr-2'}`} />
          <span>About</span>
        </NavLink>

        {/* Show user-specific links when authenticated */}
        {user && (
          <>
            <NavLink
              to="/decisions"
              className={baseStyles}
            >
              <List className={`h-5 w-5 ${isMobile ? 'mr-3' : 'mr-2'}`} />
              <span>My Decisions</span>
            </NavLink>
            <NavLink
              to="/decisions/new"
              className={baseStyles}
            >
              <PlusCircle className={`h-5 w-5 ${isMobile ? 'mr-3' : 'mr-2'}`} />
              <span>New Decision</span>
            </NavLink>
            <NavLink
              to="/profile"
              className={baseStyles}
            >
              <User className={`h-5 w-5 ${isMobile ? 'mr-3' : 'mr-2'}`} />
              <span>Profile</span>
            </NavLink>
            <NavButton
              onClick={handleSignOut}
              disabled={isLoading}
              className={`
                inline-flex items-center
                ${isMobile 
                  ? baseStyles
                  : "px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                }
              `}
            >
              <LogOut className="h-4 w-4 mr-2" />
              <span>{isLoading ? 'Signing out...' : 'Sign Out'}</span>
            </NavButton>
          </>
        )}

        {/* Show auth links when not authenticated */}
        {!user && (
          <>
            <NavLink
              to="/login"
              className={`${authButtonStyles} text-indigo-600 bg-indigo-50 hover:bg-indigo-100`}
            >
              <LogIn className="h-4 w-4 mr-2" />
              <span>Sign In</span>
            </NavLink>
            <NavLink
              to="/signup"
              className={`${authButtonStyles} text-white bg-indigo-600 hover:bg-indigo-700`}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              <span>Create Account</span>
            </NavLink>
          </>
        )}

        {/* Show early access button only when not authenticated */}
        {!user && hasValidAccess && (
          <NavButton
            onClick={handleExitEarlyAccess}
            disabled={isLoading}
            className={`
              inline-flex items-center
              ${isMobile 
                ? baseStyles
                : "px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              }
            `}
          >
            <DoorOpen className="h-4 w-4 mr-2" />
            <span>{isLoading ? 'Exiting...' : 'Exit Early Access'}</span>
          </NavButton>
        )}
      </div>
    );
  }, [user, isLoading, hasValidAccess, handleExitEarlyAccess, handleSignOut]);

  return (
    <nav 
      className="bg-white shadow-sm sticky top-0 z-50"
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <Link 
              to={hasValidAccess || user ? "/decision" : "/"} 
              className="flex-shrink-0 flex items-center hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-md"
              aria-label="DecisionGuide.AI Home"
            >
              <Brain className="h-8 w-8 text-indigo-600" />
              <span className="ml-2 text-xl font-bold text-gray-900">DecisionGuide.AI</span>
            </Link>
          </div>

          <div className="hidden sm:ml-6 sm:flex sm:items-center">
            {/* Collaborators Section */}
            {decisionId && (
              <div className="flex items-center gap-2 mr-4">
                <div className="flex -space-x-2">
                  {collaborators.slice(0, 4).map((collab) => (
                    <CollaboratorAvatar
                      key={collab.id}
                      email={collab.email || ''}
                      role={collab.role}
                    />
                  ))}
                  {collaborators.length > 4 && (
                    <Tooltip content={`+${collaborators.length - 4} more collaborators`}>
                      <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-sm font-medium">
                        +{collaborators.length - 4}
                      </div>
                    </Tooltip>
                  )}
                </div>
                <Tooltip content="Invite collaborators">
                  <button
                    onClick={() => setShowInviteModal(true)}
                    className="p-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-full transition-colors"
                  >
                    <UserPlus className="h-5 w-5" />
                  </button>
                </Tooltip>
              </div>
            )}

            {renderNavLinks(false)}
          </div>

          <div className="flex items-center sm:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500 transition-colors"
              aria-expanded={isOpen}
              aria-controls="mobile-menu"
              aria-label="Toggle navigation menu"
            >
              <span className="sr-only">
                {isOpen ? 'Close main menu' : 'Open main menu'}
              </span>
              {isOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      <div
        id="mobile-menu"
        className={`
          fixed inset-0 sm:hidden bg-black/25 backdrop-blur-sm transition-opacity duration-200
          ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
        `}
        aria-hidden={!isOpen}
        onClick={() => setIsOpen(false)}
      >
        <div 
          className={`
            absolute right-0 top-16 w-full max-w-sm bg-white shadow-lg transform transition-transform duration-200 ease-in-out
            ${isOpen ? 'translate-x-0' : 'translate-x-full'}
          `}
          onClick={e => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
        >
          <div className="py-3">
            {renderNavLinks(true)}
          </div>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;