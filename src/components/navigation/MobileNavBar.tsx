import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Inbox, Brain, PlusCircle, Users, Menu } from 'lucide-react';
import { useDecision } from '../../contexts/DecisionContext';
import { useAuth } from '../../contexts/AuthContext';
import { useSidebar } from '../../contexts/SidebarContext';

export default function MobileNavBar() {
  const location = useLocation();
  const { authenticated } = useAuth();
  const { resetDecisionContext } = useDecision();
  const { toggleCollapsed } = useSidebar();
  
  // Don't show on auth pages or landing page for non-authenticated users
  const isAuthRoute = ['/login', '/signup', '/forgot-password', '/reset-password'].includes(location.pathname);
  const isLandingPage = location.pathname === '/' && !authenticated;
  
  if (isAuthRoute || isLandingPage) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40 sm:hidden">
      <div className="flex items-center justify-around h-16">
        <Link 
          to="/inbox/waiting"
          className="flex flex-col items-center justify-center w-1/5 h-full text-gray-500 hover:text-indigo-600"
        >
          <Inbox className="h-5 w-5" />
          <span className="text-xs mt-1">Inbox</span>
        </Link>
        
        <Link 
          to="/decisions"
          className={`flex flex-col items-center justify-center w-1/5 h-full ${
            location.pathname === '/decisions' 
              ? 'text-indigo-600' 
              : 'text-gray-500 hover:text-indigo-600'
          }`}
        >
          <Brain className="h-5 w-5" />
          <span className="text-xs mt-1">Decisions</span>
        </Link>
        
        <Link 
          to="/decision/intake"
          onClick={() => resetDecisionContext()}
          className="flex flex-col items-center justify-center w-1/5 h-full"
        >
          <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center -mt-5 shadow-lg">
            <PlusCircle className="h-6 w-6 text-white" />
          </div>
        </Link> 
        
        <Link 
          to="/teams"
          className="flex flex-col items-center justify-center w-1/5 h-full text-gray-500 hover:text-indigo-600"
        >
          <Users className="h-5 w-5" />
          <span className="text-xs mt-1">Teams</span>
        </Link>
        
        <button 
          onClick={toggleCollapsed}
          className="flex flex-col items-center justify-center w-1/5 h-full text-gray-500 hover:text-indigo-600"
        >
          <Menu className="h-5 w-5" />
          <span className="text-xs mt-1">Menu</span>
        </button>
      </div>
    </div>
  );
}