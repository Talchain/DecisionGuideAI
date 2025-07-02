import React, { useState, useCallback, useEffect, useRef, memo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useDecision } from '../../contexts/DecisionContext';
import { 
  Brain, LogIn, LogOut, Menu, X, List, User, PlusCircle, Info, DoorOpen, MoreHorizontal,
  Users, Building, Star, UserPlus, Settings, Play, ChevronDown, Wrench
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
  const { collaborators, decisionId, activeDecisionId, resetDecisionContext } = useDecision();
  const [isOpen, setIsOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const mountedRef = useRef(true);
  const renderCountRef = useRef(0);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);

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

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (moreMenuOpen && moreMenuRef.current && moreButtonRef.current) {
        if (!moreMenuRef.current.contains(event.target as Node) && 
            !moreButtonRef.current.contains(event.target as Node)) {
          setMoreMenuOpen(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [moreMenuOpen]);

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
        ? 'flex items-center w-full px-4 py-3 text-base font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors duration-200'
        : 'flex items-center px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 rounded-md transition-colors duration-200';
      const authButtonStyles = isMobile
        ? baseStyles
        : 'inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md transition-all duration-200 transform hover:-translate-y-0.5';
      
      // Active styles based on current path
      const getNavLinkStyles = (path: string) => {
        const isActive = location.pathname === path;
        return `${baseStyles} ${isActive ? 'text-indigo-600 bg-indigo-50' : ''}`;
      };
      
      return (
        <div className={isMobile ? 'space-y-1' : 'flex items-center space-x-4'}>
          {user && (
            <>
              {/* Primary Navigation Items */}
              <NavLink to="/decisions" className={getNavLinkStyles('/decisions')}>
                <List className={`h-5 w-5 ${isMobile ? 'mr-3' : 'mr-2'}`} />
                <span>My Decisions</span>
              </NavLink> 
              
              {/* New Decision Button - Always Visible and Prominent */}
              <div className={isMobile ? 'my-2' : 'ml-2'}>
                <NavLink 
                  to="/decision/intake" 
                  onClick={() => {
                    console.log("[Navbar] Starting new decision flow, resetting context");
                    resetDecisionContext();
                  }} 
                  className={`inline-flex items-center px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-purple-600 hover:to-indigo-600 shadow-sm transform transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${isMobile ? 'w-full justify-center' : ''}`}
                >
                  <PlusCircle className="h-5 w-5 mr-2" />
                  <span>New Decision</span>
                </NavLink>
              </div>
              
              {/* Resume Decision - Conditionally Rendered */}
              {activeDecisionId && (
                <NavLink 
                  to={`/decision/analysis?id=${activeDecisionId}`}
                  className={`${baseStyles} text-green-600`}
                >
                  <Play className={`h-5 w-5 ${isMobile ? 'mr-3' : 'mr-2'}`} />
                  <span>Resume Decision</span>
                </NavLink>
              )}
              
              {/* More Menu - Desktop Dropdown */}
              {!isMobile && (
                <div className="relative z-50">
                  <button 
                    ref={moreButtonRef}
                    onClick={() => setMoreMenuOpen(!moreMenuOpen)}
                    className={`${baseStyles} gap-1`}
                    aria-expanded={moreMenuOpen}
                    aria-haspopup="true"
                  >
                    <MoreHorizontal className="h-5 w-5 mr-1" />
                    <span>More</span>
                    <ChevronDown className={`h-4 w-4 ml-1 transition-transform duration-200 ${moreMenuOpen ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {moreMenuOpen && (
                    <div 
                      ref={moreMenuRef}
                      className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg py-2 border border-gray-200 animate-fade-in"
                    >
                      <NavLink 
                        to="/templates" 
                        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        onClick={() => setMoreMenuOpen(false)}
                      >
                        <Star className="h-5 w-5 mr-3 text-yellow-500" />
                        <span>Templates</span>
                      </NavLink>
                      <NavLink 
                        to="/teams" 
                        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        onClick={() => setMoreMenuOpen(false)}
                      >
                        <Users className="h-5 w-5 mr-3 text-blue-500" />
                        <span>Teams</span>
                      </NavLink>
                      <NavLink 
                        to="/organisations" 
                        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        onClick={() => setMoreMenuOpen(false)}
                      >
                        <Building className="h-5 w-5 mr-3 text-purple-500" />
                        <span>Organisations</span>
                      </NavLink>
                      <div className="border-t border-gray-100 my-2"></div>
                      <NavLink 
                        to="/diagnostics" 
                        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        onClick={() => setMoreMenuOpen(false)}
                      >
                        <Wrench className="h-5 w-5 mr-3 text-gray-500" />
                        <span>Diagnostics</span>
                      </NavLink>
                      <NavLink 
                        to="/about" 
                        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        onClick={() => setMoreMenuOpen(false)}
                      >
                        <Info className="h-5 w-5 mr-3 text-gray-500" />
                        <span>About</span>
                      </NavLink>
                    </div>
                  )}
                </div>
              )}
              
              {/* Mobile-only secondary links */}
              {isMobile && (
                <>
                  <NavLink to="/templates" className={getNavLinkStyles('/templates')}>
                    <Star className="h-5 w-5 mr-3" />
                    <span>Templates</span>
                  </NavLink> 
                  <NavLink to="/teams" className={getNavLinkStyles('/teams')}>
                    <Users className="h-5 w-5 mr-3" />
                    <span>Teams</span>
                  </NavLink>
                  <NavLink to="/organisations" className={getNavLinkStyles('/organisations')}>
                    <Building className="h-5 w-5 mr-3" />
                    <span>Organisations</span>
                  </NavLink>
                  <div className="border-t border-gray-200 my-2"></div>
                  <NavLink to="/diagnostics" className={getNavLinkStyles('/diagnostics')}>
                    <Wrench className="h-5 w-5 mr-3" />
                    <span>Diagnostics</span>
                  </NavLink>
                  <NavLink to="/about" className={getNavLinkStyles('/about')}>
                    <Info className="h-5 w-5 mr-3" />
                    <span>About</span>
                  </NavLink>
                  <NavLink to="/profile" className={getNavLinkStyles('/profile')}>
                    <User className="h-5 w-5 mr-3" />
                    <span>Profile</span>
                  </NavLink>
                </>
              )}
              
              <NavButton
                onClick={handleSignOut}
                disabled={isLoading}
                className={
                  isMobile
                    ? baseStyles
                    : 'inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md hover:bg-gray-50 transition-colors ml-2'
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
                className={`${authButtonStyles} text-indigo-600 bg-indigo-50 hover:bg-indigo-100 hover:shadow-sm`}
              >
                <LogIn className="h-4 w-4 mr-2" />
                <span>Sign In</span>
              </NavLink>
              <NavLink
                to="/signup"
                className={`${authButtonStyles} text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-purple-600 hover:to-indigo-600 hover:shadow-md`}
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
    <nav className="backdrop-blur-sm shadow-sm sticky top-0 z-50 border-b border-white/10 bg-white/90" role="navigation">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <Link
              to={user ? '/decisions' : '/'}
              className="flex-shrink-0 flex items-center group"
              aria-label="DecisionGuide.AI Home"
            >
              <Brain className="h-8 w-8 text-indigo-600 transition-transform duration-300 group-hover:scale-110" />
              <span className="ml-2 text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">Olumi</span>
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
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 transition-colors"
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
        className={`fixed inset-0 sm:hidden bg-black/25 backdrop-blur-sm transition-opacity z-50 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsOpen(false)}
      >
        <div
          className={`absolute right-0 top-16 w-full max-w-sm bg-white shadow-lg transform transition-transform h-[calc(100vh-4rem)] overflow-y-auto ${
            isOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
          onClick={e => e.stopPropagation()}
        >
          <div className="py-3 pb-24">{renderNavLinks(true)}</div>
        </div>
      </div>
    </nav>
  );
}