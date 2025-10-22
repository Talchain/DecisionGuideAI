/**
 * useFocusManagement - Restore focus to heading on route change
 */
import { useEffect, useRef } from 'react'

export function useFocusManagement(routeKey: string) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  
  useEffect(() => {
    // Restore focus to heading on route mount
    if (headingRef.current) {
      headingRef.current.focus()
    }
  }, [routeKey])
  
  return headingRef
}
