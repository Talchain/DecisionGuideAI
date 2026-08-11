/**
 * Hook to provide analysis metadata for Top Bar display
 * Decision Graph Display v2: Task 13
 *
 * Returns run status, scenario count, stability, and timestamp
 */

import { useMemo } from 'react'
import { useCanvasStore } from '../store'

export type RunStatus = 'draft' | 'running' | 'complete' | 'error'
export type StabilityStatus = 'stable' | 'fragile' | null

/**
 * The producer's display-safe robustness verdict (PLoT #202,
 * `robustness.display_verdict`). This is the ONLY field licensed to make a
 * robustness claim on screen — see the single-source rule quoted in
 * `buildAnalysisHeroViewModel.ts` and `useResultsSectionData.ts`.
 *
 * FAIL-CLOSED, exactly as every other consumer does it: only these four tokens
 * count. An absent field (older PLoT build) or an unrecognised token yields no
 * verdict, and no verdict means no claim.
 */
const DISPLAY_SAFE_VERDICTS = ['robust', 'moderate', 'fragile', 'not_assessed'] as const
type RobustnessDisplayVerdict = (typeof DISPLAY_SAFE_VERDICTS)[number]

function readDisplayVerdict(raw: unknown): RobustnessDisplayVerdict | null {
  return (DISPLAY_SAFE_VERDICTS as readonly string[]).includes(raw as string)
    ? (raw as RobustnessDisplayVerdict)
    : null
}

interface AnalysisMetadata {
  /** Run status for display */
  runStatus: RunStatus
  /** Number of scenarios analysed */
  scenarioCount: number | null
  /** Stability assessment */
  stability: StabilityStatus
  /** When analysis completed (ISO timestamp) */
  computedAt: string | null
  /** User-friendly relative time string */
  relativeTime: string | null
}

/**
 * Get analysis metadata for Top Bar display
 */
export function useAnalysisMetadata(): AnalysisMetadata {
  const resultsStatus = useCanvasStore(state => state.results.status)
  const report = useCanvasStore(state => state.results.report)

  return useMemo(() => {
    // Derive run status from results.status
    const runStatus: RunStatus = (() => {
      if (resultsStatus === 'complete') return 'complete'
      if (resultsStatus === 'error') return 'error'
      if (resultsStatus === 'preparing' || resultsStatus === 'connecting' || resultsStatus === 'streaming') {
        return 'running'
      }
      return 'draft' // idle, cancelled, or undefined
    })()

    // Extract scenario count from meta.n_samples
    const scenarioCount = (() => {
      if (!report?.meta) return null
      const nSamples = report.meta.n_samples ?? report.meta.nSamples
      return typeof nSamples === 'number' ? nSamples : null
    })()

    // ── THE HEADER'S STABILITY CLAIM ────────────────────────────────────────
    //
    // ⚠ THIS USED TO READ `robustness.is_robust`, AND THAT WAS THE DEFECT
    // (link-track R1 item 1 / C6). On deployed staging `5597d867`, 2026-08-11,
    // one screen state carried a green `Stable` chip above an analysis panel
    // saying "fragile" four times, "Ranking sensitive to assumptions", and
    // "Stability: (not available for this run)" (L3-BROWSER-TRUTH §9 C6 — "the
    // most investor-damaging contradiction in the product", reproduced on a
    // second brief and a newer build, so it is systemic).
    //
    // `is_robust` is a RAW producer field, and this chip was its ONLY display
    // consumer repo-wide. Everything else in the product consumes the
    // display-safe `display_verdict` under an explicit single-source rule, and
    // fails CLOSED so an unassessed run keeps the certified "Robustness
    // unknown" state.
    //
    // Two authorities, two different questions (CLAUDE.md trap 21):
    //   `is_robust`       — did the perturbation set leave the winner standing?
    //   `display_verdict` — what may this run CLAIM about robustness on screen?
    // A chrome chip is a display surface, so it takes the display authority.
    // The point is not to align the two defaults; it is to point the surface
    // at the question it is actually asking.
    //
    // `not_assessed` and an absent/unrecognised token both yield null, and a
    // null stability renders NO CHIP AT ALL (TopBar gates on `!== null`) —
    // silence, never a cheerful default.
    const stability: StabilityStatus = (() => {
      const verdict = readDisplayVerdict(
        (report?.robustness as { display_verdict?: unknown } | undefined)?.display_verdict,
      )
      if (verdict === 'robust') return 'stable'
      if (verdict === 'moderate' || verdict === 'fragile') return 'fragile'
      // 'not_assessed', absent, or unrecognised — the run may claim nothing.
      return null
    })()

    // Extract computed_at timestamp
    const computedAt = (() => {
      if (!report?.meta) return null
      const timestamp = report.meta.computed_at ?? report.meta.computedAt
      return typeof timestamp === 'string' ? timestamp : null
    })()

    // Generate relative time string
    const relativeTime = (() => {
      if (!computedAt) return null
      try {
        const date = new Date(computedAt)
        const seconds = Math.floor((Date.now() - date.getTime()) / 1000)

        if (seconds < 60) return 'just now'
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
        if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
        return date.toLocaleDateString()
      } catch {
        return null
      }
    })()

    return {
      runStatus,
      scenarioCount,
      stability,
      computedAt,
      relativeTime,
    }
  }, [resultsStatus, report])
}
