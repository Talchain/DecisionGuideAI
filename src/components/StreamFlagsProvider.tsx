/**
 * StreamFlagsProvider - Feature Flag Management Hook
 *
 * P1 Polish (Task A): Extracted from SandboxStreamPanel.tsx
 *
 * Centralises all feature flag state and initialisation logic.
 * Manages 13 feature flags with dynamic re-evaluation on localStorage changes.
 *
 * Responsibilities:
 * - Manage all feature flags as state
 * - Listen to localStorage changes
 * - Evaluate flags on mount and on storage events
 * - Auto-update flags every 250ms for first 2 seconds (E2E compatibility)
 */

import { useState, useEffect } from 'react'
import * as Flags from '../flags'

export interface StreamFlags {
  simplifyFlag: boolean
  listViewFlag: boolean
  engineModeFlag: boolean
  mobileGuardFlag: boolean
  summaryV2Flag: boolean
  guidedFlag: boolean
  commentsFlag: boolean
  diagFlag: boolean
  perfFlag: boolean
  scorecardFlag: boolean
  errorBannersFlag: boolean
  snapshotsFlag: boolean
  compareFlag: boolean
}

/**
 * Hook that manages all feature flags for SandboxStreamPanel
 *
 * @returns StreamFlags object with all flag states
 */
export function useStreamFlags(): StreamFlags {
  // Flag state declarations (lines 47-79, 491-496 from original)
  const [simplifyFlag, setSimplifyFlag] = useState<boolean>(() => {
    try { const fn: any = (Flags as any).isCanvasSimplifyEnabled; return typeof fn === 'function' ? !!fn() : false } catch { return false }
  })
  const [listViewFlag, setListViewFlag] = useState<boolean>(() => {
    try { const fn: any = (Flags as any).isListViewEnabled; return typeof fn === 'function' ? !!fn() : false } catch { return false }
  })
  const [engineModeFlag, setEngineModeFlag] = useState<boolean>(() => {
    try { const fn: any = (Flags as any).isEngineModeEnabled; return typeof fn === 'function' ? !!fn() : false } catch { return false }
  })
  const [mobileGuardFlag, setMobileGuardFlag] = useState<boolean>(() => {
    try { const fn: any = (Flags as any).isMobileGuardrailsEnabled; return typeof fn === 'function' ? !!fn() : false } catch { return false }
  })
  const [summaryV2Flag, setSummaryV2Flag] = useState<boolean>(() => {
    try { const fn: any = (Flags as any).isSummaryV2Enabled; return typeof fn === 'function' ? !!fn() : false } catch { return false }
  })
  const [guidedFlag, setGuidedFlag] = useState<boolean>(() => {
    try { const fn: any = (Flags as any).isGuidedV1Enabled; return typeof fn === 'function' ? !!fn() : false } catch { return false }
  })
  const [commentsFlag, setCommentsFlag] = useState<boolean>(() => {
    try { const fn: any = (Flags as any).isCommentsEnabled; return typeof fn === 'function' ? !!fn() : false } catch { return false }
  })
  const [diagFlag, setDiagFlag] = useState<boolean>(() => {
    try { const fn: any = (Flags as any).isDiagnosticsEnabled; return typeof fn === 'function' ? !!fn() : false } catch { return false }
  })
  const [perfFlag, setPerfFlag] = useState<boolean>(() => {
    try { const fn: any = (Flags as any).isPerfProbesEnabled; return typeof fn === 'function' ? !!fn() : false } catch { return false }
  })
  const [scorecardFlag, setScorecardFlag] = useState<boolean>(() => {
    try { const fn: any = (Flags as any).isScorecardEnabled; return typeof fn === 'function' ? !!fn() : false } catch { return false }
  })
  const [errorBannersFlag, setErrorBannersFlag] = useState<boolean>(() => {
    try { const fn: any = (Flags as any).isErrorBannersEnabled; return typeof fn === 'function' ? !!fn() : false } catch { return false }
  })
  const [snapshotsFlag, setSnapshotsFlag] = useState<boolean>(() => {
    try { const fn: any = (Flags as any).isSnapshotsEnabled; return typeof fn === 'function' ? !!fn() : false } catch { return false }
  })
  const [compareFlag, setCompareFlag] = useState<boolean>(() => {
    try { const fn: any = (Flags as any).isCompareEnabled; return typeof fn === 'function' ? !!fn() : false } catch { return false }
  })

  // Flag re-evaluation effect (lines 81-111 from original)
  useEffect(() => {
    // Re-evaluate flags after mount and whenever localStorage changes (E2E sets flags post-navigation)
    const update = () => {
      try { const fn: any = (Flags as any).isCanvasSimplifyEnabled; setSimplifyFlag(typeof fn === 'function' ? !!fn() : false) } catch {}
      try { const fn: any = (Flags as any).isListViewEnabled; setListViewFlag(typeof fn === 'function' ? !!fn() : false) } catch {}
      try { const fn: any = (Flags as any).isEngineModeEnabled; setEngineModeFlag(typeof fn === 'function' ? !!fn() : false) } catch {}
      try { const fn: any = (Flags as any).isMobileGuardrailsEnabled; setMobileGuardFlag(typeof fn === 'function' ? !!fn() : false) } catch {}
      try { const fn: any = (Flags as any).isSnapshotsEnabled; setSnapshotsFlag(typeof fn === 'function' ? !!fn() : false) } catch {}
      try { const fn: any = (Flags as any).isCompareEnabled; setCompareFlag(typeof fn === 'function' ? !!fn() : false) } catch {}
      try { const fn: any = (Flags as any).isSummaryV2Enabled; setSummaryV2Flag(typeof fn === 'function' ? !!fn() : false) } catch {}
      try { const fn: any = (Flags as any).isGuidedV1Enabled; setGuidedFlag(typeof fn === 'function' ? !!fn() : false) } catch {}
      try { const fn: any = (Flags as any).isCommentsEnabled; setCommentsFlag(typeof fn === 'function' ? !!fn() : false) } catch {}
      try { const fn: any = (Flags as any).isDiagnosticsEnabled; setDiagFlag(typeof fn === 'function' ? !!fn() : false) } catch {}
      try { const fn: any = (Flags as any).isPerfProbesEnabled; setPerfFlag(typeof fn === 'function' ? !!fn() : false) } catch {}
      try { const fn: any = (Flags as any).isScorecardEnabled; setScorecardFlag(typeof fn === 'function' ? !!fn() : false) } catch {}
      try { const fn: any = (Flags as any).isErrorBannersEnabled; setErrorBannersFlag(typeof fn === 'function' ? !!fn() : false) } catch {}
    }

    update()

    // Grace period: catch LS writes made immediately after mount (same-tab writes don't fire 'storage')
    const t1 = setTimeout(update, 50)
    const t2 = setTimeout(update, 200)
    const t3 = setTimeout(update, 500)
    const iv = setInterval(update, 250)
    const tStop = setTimeout(() => clearInterval(iv), 2000)

    const onStorage = (e: StorageEvent) => {
      if (!e || typeof e.key !== 'string') { update(); return }
      if (e.key.startsWith('feature.')) update()
    }

    window.addEventListener('storage', onStorage)

    return () => {
      window.removeEventListener('storage', onStorage)
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
      clearTimeout(tStop)
      clearInterval(iv)
    }
  }, [])

  return {
    simplifyFlag,
    listViewFlag,
    engineModeFlag,
    mobileGuardFlag,
    summaryV2Flag,
    guidedFlag,
    commentsFlag,
    diagFlag,
    perfFlag,
    scorecardFlag,
    errorBannersFlag,
    snapshotsFlag,
    compareFlag,
  }
}
