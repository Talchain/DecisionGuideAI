import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useSidebar } from '../../../contexts/SidebarContext';
import NavGroup from './NavGroup';
import NavItem from './NavItem';
import { navigationConfig } from './navigationConfig';
import Tooltip from '../../Tooltip';

export default function Sidebar() {
  const { user } = useAuth();
  const { isCollapsed, toggleCollapsed } = useSidebar();
  const location = useLocation();
  const [hovering, setHovering] = useState(false);

  // Don't show sidebar on auth pages or landing page for non-authenticated users
  const isAuthRoute = ['/login', '/signup', '/forgot-password', '/reset-password'].includes(location.pathname);
  const isLandingPage = location.pathname === '/' && !user;
  
  if (isAuthRoute || isLandingPage) {
    return null;
  }

  const shouldShowExpanded = !isCollapsed || hovering;

  return (
    <>
      {/* Sidebar */}
      <div
        className={`
          fixed left-0 top-0 h-full bg-white border-r border-gray-200 z-40
          transition-all duration-300 ease-in-out
          ${shouldShowExpanded ? 'w-80' : 'w-18'}
        `}
        onMouseEnter={() => isCollapsed && setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200">
          {shouldShowExpanded && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">O</span>
              </div>
              <span className="font-bold text-gray-900">Olumi</span>
            </div>
          )}
          
          <Tooltip content={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}>
            <button
              onClick={toggleCollapsed}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isCollapsed ? (
                <ChevronRight className="h-5 w-5" />
              ) : (
                <ChevronLeft className="h-5 w-5" />
              )}
            </button>
          </Tooltip>
        </div>

        {/* Navigation Content */}
        <div className="flex-1 overflow-y-auto py-4">
          <nav className="space-y-2 px-3" role="navigation" aria-label="Main navigation">
            {navigationConfig.map((group) => (
              <NavGroup
                key={group.id}
                group={group}
                isCollapsed={!shouldShowExpanded}
                currentPath={location.pathname}
              />
            ))}
          </nav>
        </div>
      </div>

      {/* Main content offset */}
      <div className={`transition-all duration-300 ease-in-out ${shouldShowExpanded ? 'ml-80' : 'ml-18'}`}>
        {/* This div creates the proper spacing for the main content */}
      </div>
    </>
  );
}