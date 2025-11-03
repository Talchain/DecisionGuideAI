import { useEffect, useState } from 'react'

/**
 * Hook to detect if user prefers reduced motion
 *
 * Respects the prefers-reduced-motion CSS media query.
 * Use this to disable or reduce animations for users with motion sensitivity.
 *
 * @returns true if user prefers reduced motion, false otherwise
 *
 * @example
 * const prefersReducedMotion = usePrefersReducedMotion()
 * const duration = prefersReducedMotion ? 0 : 300
 */
export function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mediaQuery.matches)

    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches)
    }

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }

    // Legacy browsers
    mediaQuery.addListener(handleChange)
    return () => mediaQuery.removeListener(handleChange)
  }, [])

  return prefersReducedMotion
}
