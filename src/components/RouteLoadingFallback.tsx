// src/components/RouteLoadingFallback.tsx
// Accessible loading fallback for lazy-loaded routes

import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'

interface RouteLoadingFallbackProps {
  minDelay?: number
}

export default function RouteLoadingFallback({ 
  minDelay = 200 
}: RouteLoadingFallbackProps) {
  const [show, setShow] = useState(false)
  const location = useLocation()
  
  // Derive route name from pathname with safer parsing
  const path = location.pathname.replace(/^\/+/, '')
  const top = path.split('/')[0] || 'page'
  const routeName = top.charAt(0).toUpperCase() + top.slice(1)

  // Delay showing spinner to avoid flash for fast loads
  useEffect(() => {
    const timer = setTimeout(() => setShow(true), minDelay)
    return () => clearTimeout(timer)
  }, [minDelay])

  if (!show) {
    return null
  }

  return (
    <div 
      className="flex items-center justify-center min-h-screen"
      role="status"
      aria-live="polite"
      aria-label={`Loading ${routeName}`}
    >
      <div className="text-center">
        <div 
          className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-indigo-600 border-r-transparent motion-reduce:animate-none"
          aria-hidden="true"
        />
        <p className="mt-4 text-sm text-gray-600">
          Loading {routeName}...
        </p>
      </div>
    </div>
  )
}
