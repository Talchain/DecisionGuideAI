/**
 * Session-scoped tech toggle for inspector panels.
 * Persists within a page session, not across reloads.
 */

import { useState, useCallback } from 'react'

export function useTechToggle() {
  const [techMode, setTechMode] = useState(false)
  const toggle = useCallback((v: boolean) => setTechMode(v), [])
  return { techMode, setTechMode: toggle }
}
