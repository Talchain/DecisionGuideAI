// src/components/RouteLoadingFallback.tsx
// Accessible loading fallback for lazy-loaded routes

import { useEffect, useState } from 'react'

interface RouteLoadingFallbackProps {
  routeName?: string
  minDelay?: number
}

export default function RouteLoadingFallback({ 
  routeName = 'page',
  minDelay = 200 
}: RouteLoadingFallbackProps) {
  const [show, setShow] = useState(false)

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
          className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-indigo-600 border-r-transparent"
          aria-hidden="true"
        />
        <p className="mt-4 text-sm text-gray-600">
          Loading {routeName}...
        </p>
      </div>
    </div>
  )
}
