import React, { useState, useCallback, useEffect, useRef, memo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useDecision } from '../../contexts/DecisionContext';
import {
  Brain,
  LogIn,
  LogOut,
  Menu,
  X,
  List,
  User,
  PlusCircle,
  Info,
  DoorOpen,
  Users as TeamsIcon,
  Building,
  Star,
  UserPlus
} from 'lucide-react';
import { navDebug } from '../../lib/debug/navDebug';
import {
  clearAccessValidation,
  ACCESS_VALIDATION_KEY,
  ACCESS_TIMESTAMP_KEY,
  ACCESS_CODE_KEY,
} from '../../lib/auth/accessValidation';
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
  <Link to={to} className={className}>
    {children}
  </Link>
));
NavLink.displayName = 'NavLink';

const NavButton = memo(
  ({
    onClick,
    className,
    children,
    disabled,
  }: {
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
  )
);
NavButton.displayName = 'NavButton';

export default function Navbar() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { collaborators, decisionId, resetDecisionContext } = useDecision();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const mountedRef = useRef(true);
  const renderCountRef = useRef(0);

  const hasValidAccess = localStorage.getItem('dga_access_validated') === 'true';

  useEffect(() => {
    const currentCount = renderCountRef.current;
    renderCountRef.current++;
    navDebug.log('render', 'Navbar', 'Component Mounted', {
      renderCount: currentCount + 1,
      authLoading,
      hasUser: !!user,
      hasValidAccess,
      timestamp: new Date().toISOString(),
    });
    return () => {
      mountedRef.current = false;
      navDebug.log('render', 'Navbar', 'Component Unmounted', {
        timestamp: new Date().toISOString(),
      });
    };
  }, [authLoading, user, hasValidAccess]);

  const handleSignOut = useCallback(async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      const { error } = await signOut();
      if (error) throw error;
    } catch (err) {
      alert('Failed to sign out. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [signOut, isLoading]);

  const handleExitEarlyAccess = useCallback(() => {
    clearAccessValidation();
    navigate('/', { replace: true });
    setIsOpen(false);
  }, [navigate]);

  const renderNavLinks = useCallback(
    (isMobile = false) => {
      const baseStyles = isMobile
        ? 'flex items-center w-full px-4 py-3 text-base font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50'
        : 'flex items-center px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 rounded-md';
      const authButtonStyles = isMobile
        ? baseStyles
        : 'inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md';
      return (
        <div className={isMobile ? 'space-y-1' : 'flex items-center space-x-4'}>
          <NavLink to="/about" className={baseStyles}>
            <Info className={`h-5 w-5 ${isMobile ? 'mr-3' : 'mr-2'}`} />
            <span>About</span>
          </NavLink>

          {user && (
            <>
              <NavLink to="/decisions" className={baseStyles}>
                <List className={`h-5 w-5 ${isMobile ? 'mr-3' : 'mr-2'}`} />
                <span>My Decisions</span>
              </NavLink>
              <NavLink to="/templates" className={baseStyles}>
                <Star className={`h-5 w-5 ${isMobile ? 'mr-3' : 'mr-2'}`} />
                <span>Templates</span>
              </NavLink>
              <NavLink to="/diagnostics" className={baseStyles}>
                <span>Diagnostics</span>
              </NavLink>
              <NavLink to="/teams" className={baseStyles}>
                <TeamsIcon className={`h-5 w-5 ${isMobile ? 'mr-3' : 'mr-2'}`} />
                <span>Teams</span>
              </NavLink>
              <NavLink to="/organisations" className={baseStyles}>
                <Building className={`h-5 w-5 ${isMobile ? 'mr-3' : 'mr-2'}`} />
                <span>Organisations</span>
              </NavLink>
              <NavLink 
                to="/decision/intake" 
                onClick={() => {
                  console.log("[Navbar] Starting new decision flow, resetting context");
                  resetDecisionContext();
                }} 
                className={baseStyles}
              >
                <PlusCircle className={`h-5 w-5 ${isMobile ? 'mr-3' : 'mr-2'}`} />
                <span>New Decision</span>
              </NavLink>
              <NavLink to="/profile" className={baseStyles}>
                <User className={`h-5 w-5 ${isMobile ? 'mr-3' : 'mr-2'}`} />
                <span>Profile</span>
              </NavLink>
              <NavButton
                onClick={handleSignOut}
                disabled={isLoading}
                className={
                  isMobile
                    ? baseStyles
                    : 'inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md'
                }
              >
                <LogOut className="h-4 w-4 mr-2" />
                <span>{isLoading ? 'Signing out...' : 'Sign Out'}</span>
              </NavButton>
            </>
          )}

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
              {hasValidAccess && (
                <NavButton
                  onClick={handleExitEarlyAccess}
                  disabled={isLoading}
                  className={
                    isMobile
                      ? baseStyles
                      : 'inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md'
                  }
                >
                  <DoorOpen className="h-4 w-4 mr-2" />
                  <span>Exit Early Access</span>
                </NavButton>
              )}
            </>
          )}
        </div>
      );
    },
    [user, isLoading, handleExitEarlyAccess, handleSignOut]
  );

  return (
    <nav className="backdrop-blur-sm shadow-sm sticky top-0 z-50 border-b border-white/10" role="navigation">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <Link
              to={user ? '/decision/intake' : '/'}
              onClick={() => {
                if (user) {
                  console.log("[Navbar] Clicking logo with user, resetting context");
                  resetDecisionContext();
                }
              }}
              onClick={() => {
                if (user) {
                  console.log("[Navbar] Clicking logo with user, resetting context");
                  resetDecisionContext();
                }
              }}
              className="flex-shrink-0 flex items-center"
              aria-label="DecisionGuide.AI Home"
            >
              <Brain className="h-8 w-8 text-indigo-600" />
              <span className="ml-2 text-xl font-bold text-gray-900">Olumi</span>
            </Link>
          </div>

          <div className="hidden sm:ml-6 sm:flex sm:items-center">
            {/* Collaborator avatars */}
            {decisionId && (
              <div className="flex items-center gap-2 mr-4">
                <div className="flex -space-x-2">
                  {collaborators.slice(0, 4).map(c => (
                    <CollaboratorAvatar key={c.id} email={c.email || ''} role={c.role} />
                  ))}
                  {collaborators.length > 4 && (
                    <Tooltip content={`+${collaborators.length - 4} more`}>
                      <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-sm font-medium">
                        +{collaborators.length - 4}
                      </div>
                    </Tooltip>
                  )}
                </div>
              </div>
            )}

            {renderNavLinks(false)}
          </div>

          <div className="flex items-center sm:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
              aria-expanded={isOpen}
            >
              <span className="sr-only">
                {isOpen ? 'Close menu' : 'Open menu'}
              </span>
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      <div
        id="mobile-menu"
        className={`fixed inset-0 sm:hidden bg-black/25 backdrop-blur-sm transition-opacity ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsOpen(false)}
      >
        <div
          className={`absolute right-0 top-16 w-full max-w-sm bg-white shadow-lg transform transition-transform ${
            isOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
          onClick={e => e.stopPropagation()}
        >
          <div className="py-3">{renderNavLinks(true)}</div>
        </div>
      </div>
    </nav>
  );
}