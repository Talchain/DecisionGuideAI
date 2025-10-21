/**
 * Bottom Navigation - Phase A
 * Home · Decision Templates · Decision Note · Settings
 */
import { Link, useLocation } from 'react-router-dom'
import { Home, FileText, BookOpen, Settings } from 'lucide-react'

export function BottomNav() {
  const location = useLocation()
  
  const isActive = (path: string) => location.pathname === path
  
  const linkClass = (path: string) => `
    flex flex-col items-center justify-center py-2 px-4 text-xs
    ${isActive(path) 
      ? 'text-blue-600 font-medium' 
      : 'text-gray-600 hover:text-gray-900'}
  `
  
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40" data-testid="bottom-nav">
      <div className="flex justify-around items-center max-w-lg mx-auto">
        <Link to="/" className={linkClass('/')} aria-label="Home">
          <Home className="h-5 w-5 mb-1" />
          <span>Home</span>
        </Link>
        
        <Link to="/templates" className={linkClass('/templates')} aria-label="Decision Templates">
          <FileText className="h-5 w-5 mb-1" />
          <span>Templates</span>
        </Link>
        
        <Link to="/plot" className={linkClass('/plot')} aria-label="Decision Note">
          <BookOpen className="h-5 w-5 mb-1" />
          <span>Decision Note</span>
        </Link>
        
        <Link to="/settings" className={linkClass('/settings')} aria-label="Settings">
          <Settings className="h-5 w-5 mb-1" />
          <span>Settings</span>
        </Link>
      </div>
    </nav>
  )
}
