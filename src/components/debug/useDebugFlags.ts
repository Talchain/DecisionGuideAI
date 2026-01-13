/**
 * useDebugFlags Hook
 *
 * Parses URL parameters to determine debug console visibility and unsafe mode.
 * Supports both regular URLs and HashRouter URLs.
 *
 * Gating:
 * - ?diag=1 → Debug Console visible
 * - ?diag=1&unsafe=1 → Sensitive features (LLM I/O, Payload Lab) visible
 */

import { useMemo } from 'react'
import type { DebugFlags } from './types'

function parseSearchParams(): URLSearchParams {
  // Check regular URL params first
  const regularParams = new URLSearchParams(window.location.search)
  
  // Check hash for HashRouter query params (e.g., #/canvas?diag=1)
  const hashParts = window.location.hash.split('?')
  if (hashParts.length > 1) {
    const hashParams = new URLSearchParams(hashParts[1])
    // Merge hash params into regular params (hash takes precedence)
    hashParams.forEach((value, key) => {
      regularParams.set(key, value)
    })
  }
  
  return regularParams
}

export function useDebugFlags(): DebugFlags {
  return useMemo(() => {
    if (typeof window === 'undefined') {
      return { showDebugConsole: false, showUnsafe: false }
    }

    const params = parseSearchParams()
    const showDebugConsole = params.get('diag') === '1'
    const showUnsafe = showDebugConsole && params.get('unsafe') === '1'

    return { showDebugConsole, showUnsafe }
  }, [])
}

/**
 * Non-hook version for use outside React components
 */
export function getDebugFlags(): DebugFlags {
  if (typeof window === 'undefined') {
    return { showDebugConsole: false, showUnsafe: false }
  }

  const params = parseSearchParams()
  const showDebugConsole = params.get('diag') === '1'
  const showUnsafe = showDebugConsole && params.get('unsafe') === '1'

  return { showDebugConsole, showUnsafe }
}

export default useDebugFlags
