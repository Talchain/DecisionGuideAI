import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, List, PlusCircle, Play, Menu } from 'lucide-react';
import { useDecision } from '../../contexts/DecisionContext';
import { useAuth } from '../../contexts/AuthContext';

export default function MobileNavBar() {
  const location = useLocation();
  const { authenticated } = useAuth();
  const { activeDecisionId, resetDecisionContext } = useDecision();
  
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
          to="/"
          className="flex flex-col items-center justify-center w-1/5 h-full text-gray-500 hover:text-indigo-600"
        >
          <Home className="h-5 w-5" />
          <span className="text-xs mt-1">Home</span>
        </Link>
        
        <Link 
          to="/decisions"
          className={`flex flex-col items-center justify-center w-1/5 h-full ${
            location.pathname === '/decisions' 
              ? 'text-indigo-600' 
              : 'text-gray-500 hover:text-indigo-600'
          }`}
        >
          <List className="h-5 w-5" />
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
        
        {activeDecisionId ? (
          <Link 
            to={`/decision/analysis?id=${activeDecisionId}`}
            className="flex flex-col items-center justify-center w-1/5 h-full text-gray-500 hover:text-indigo-600"
          >
            <Play className="h-5 w-5" />
            <span className="text-xs mt-1">Resume</span>
          </Link>
        ) : (
          <div className="flex flex-col items-center justify-center w-1/5 h-full text-gray-300">
            <Play className="h-5 w-5" />
            <span className="text-xs mt-1">Resume</span>
          </div>
        )}
        
        <Link 
          to="#"
          className="flex flex-col items-center justify-center w-1/5 h-full text-gray-500 hover:text-indigo-600"
        >
          <Menu className="h-5 w-5" />
          <span className="text-xs mt-1">More</span>
        </Link>
      </div>
    </div>
  );
}