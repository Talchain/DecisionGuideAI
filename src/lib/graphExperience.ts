// src/lib/graphExperience.ts
// Graph Experience vNext activation — hash-aware ?graphExperience URL param
// mirrored into the env-less localStorage flag (feature.graphVNext).
//
// Lives OUTSIDE src/canvas-vnext/ so CanvasMVP can import it statically while
// the vNext surface itself stays behind a dynamic import — the bundle fence
// (no static canvas-vnext imports outside the dir) is machine-enforced by
// src/canvas-vnext/__tests__/importIsolation.spec.ts.

import { isGraphVNextEnabled } from '../flags'

export type GraphExperience = 'default' | 'vnext'

export const GRAPH_EXPERIENCE_PARAM = 'graphExperience'

// Must match FLAGS_CONFIG.graphVNext.storageKey in src/flags.ts — the mirror
// test in graphExperience.spec.ts (setGraphVNextEnabled → isGraphVNextEnabled)
// pins the two keys together.
const GRAPH_VNEXT_STORAGE_KEY = 'feature.graphVNext'

/**
 * Read the raw ?graphExperience value from the URL. Checks location.search
 * first, then the query segment inside location.hash — the app runs under
 * HashRouter, so route queries normally sit after the hash
 * ('#/canvas?graphExperience=vnext'). Same parse pattern as
 * getCanvasDebugMode in src/canvas/ReactFlowGraph.tsx.
 */
export function readGraphExperienceParam(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const url = new URL(window.location.href)
    const fromSearch = url.searchParams.get(GRAPH_EXPERIENCE_PARAM)
    if (fromSearch != null) return fromSearch

    const hash = window.location.hash
    if (hash) {
      const queryIndex = hash.indexOf('?')
      if (queryIndex !== -1) {
        const hashParams = new URLSearchParams(hash.slice(queryIndex + 1))
        return hashParams.get(GRAPH_EXPERIENCE_PARAM)
      }
    }
    return null
  } catch {
    return null
  }
}

/** Persist the vNext flag ('1'/'0' — flagFactory treats '0'/'false' as off). */
export function setGraphVNextEnabled(enabled: boolean): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(GRAPH_VNEXT_STORAGE_KEY, enabled ? '1' : '0')
    }
  } catch {
    // localStorage unavailable — the URL param still activates per load.
  }
}

/**
 * Resolve the active graph experience. An explicit URL param wins and is
 * mirrored into the localStorage flag ('vnext' → on, 'default' → off — the
 * explicit off-switch) so the choice sticks across in-app navigation.
 * Unrecognised param values are ignored. With no recognised param the
 * localStorage flag decides; default is 'default'.
 */
export function resolveGraphExperience(): GraphExperience {
  const param = readGraphExperienceParam()
  if (param === 'vnext') {
    setGraphVNextEnabled(true)
    return 'vnext'
  }
  if (param === 'default') {
    setGraphVNextEnabled(false)
    return 'default'
  }
  return isGraphVNextEnabled() ? 'vnext' : 'default'
}

/**
 * Remove ?graphExperience from the URL — both the plain search string and the
 * hash query — without a reload, via history.replaceState. Used by the Exit
 * control so a refresh after exiting stays on the default graph.
 */
export function stripGraphExperienceParam(): void {
  if (typeof window === 'undefined') return
  try {
    const url = new URL(window.location.href)
    let changed = false

    if (url.searchParams.has(GRAPH_EXPERIENCE_PARAM)) {
      url.searchParams.delete(GRAPH_EXPERIENCE_PARAM)
      changed = true
    }

    const hash = url.hash
    const queryIndex = hash.indexOf('?')
    if (queryIndex !== -1) {
      const hashParams = new URLSearchParams(hash.slice(queryIndex + 1))
      if (hashParams.has(GRAPH_EXPERIENCE_PARAM)) {
        hashParams.delete(GRAPH_EXPERIENCE_PARAM)
        const rest = hashParams.toString()
        url.hash = rest ? `${hash.slice(0, queryIndex)}?${rest}` : hash.slice(0, queryIndex)
        changed = true
      }
    }

    if (changed) {
      window.history.replaceState(window.history.state, '', url.toString())
    }
  } catch {
    // URL manipulation failed — the localStorage flag still governs resolution.
  }
}
