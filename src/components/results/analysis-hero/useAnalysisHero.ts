/**
 * useAnalysisHero — the ONE store/flag-aware file in the analysis-hero
 * module.
 *
 * Receives the SAME adapted object the Results Panel consumes (passed down
 * from ResultsBody as a prop — no second data path, no fetch, no direct
 * CEE/PLoT access) and wires the live concerns the presentational panel
 * must not own:
 *   - re-run analysis via the canonical runner (stale footer action);
 *   - WHICH coaching panel is mounted below (flag-aware: the adaptive
 *     Strengthen panel replaces FocusNow inside its flag, mirroring
 *     ResultsBody's own mount logic) — exposed as the panel's scroll-target
 *     selector so the affordance is never keyed to a retired flag;
 *   - the TOP active Strengthen entry's title (priority order, from the
 *     lifecycle store) for the Next-step footer row;
 *   - the canvas node-id set for buildHeroModel's flip-risk focus pre-gate
 *     (fail-closed: rows whose target is not on the canvas render as text).
 *
 * The model is memoised on the data object identity — lens switching and row
 * disclosure live in the panel as local render state and never re-run this
 * mapping.
 */
import { useCallback, useMemo } from 'react'
import { useCanvasStore } from '@/canvas/store'
import { executeCanonicalRun } from '@/canvas/analysis/canonicalRunRegistry'
import { selectActive, useStrengthenStore } from '@/canvas/stores/strengthenStore'
import { isFocusNowPanelEnabled, isStrengthenPanelEnabled } from '@/flags'
import type { ResultsSectionDataReturn } from '../useResultsSectionData'
import { buildHeroModel } from './buildHeroModel'
import type { HeroModel } from './heroTypes'

export interface UseAnalysisHeroReturn {
  model: HeroModel
  onRerun: () => void
  rerunDisabled: boolean
  /** Scroll-target selector for the mounted coaching panel, or null when
   * neither panel flag is on (no scroll affordance is rendered). */
  focusPanelSelector: string | null
  /** Top active Strengthen entry title (Next-step row); null when the
   * Strengthen panel is off or nothing is active. */
  nextRecommendation: string | null
}

/** The coaching-panel scroll anchors, keyed by which flag drives the mount
 * (must mirror ResultsBody: Strengthen replaces FocusNow inside its flag). */
const STRENGTHEN_PANEL_SELECTOR = '[data-testid="strengthen-panel"]'
const FOCUS_NOW_PANEL_SELECTOR = '[data-testid="focus-now-panel"]'

export function useAnalysisHero(data: ResultsSectionDataReturn): UseAnalysisHeroReturn {
  const resultsStatus = useCanvasStore((s) => s.results.status)
  const isAnalysing =
    resultsStatus === 'preparing' || resultsStatus === 'connecting' || resultsStatus === 'streaming'

  // Wave 2 (§6.4): identity-anchored ordinals from the Wave F-A store slice.
  // Selecting the map itself is referentially stable — registerOptionNumbering
  // no-ops (skips set) when every id is already registered.
  const optionNumbering = useCanvasStore((s) => s.optionNumbering)

  // Canvas node ids for the flip-risk focus pre-gate (fail-closed rows).
  // The nodes array reference changes only on real graph edits, so the Set
  // memo is cheap and stable between edits.
  const nodes = useCanvasStore((s) => s.nodes)
  const canvasNodeIds = useMemo(() => new Set(nodes.map((n) => n.id)), [nodes])

  const model = useMemo(
    () => buildHeroModel(data, optionNumbering, canvasNodeIds),
    [data, optionNumbering, canvasNodeIds],
  )

  const strengthenOn = isStrengthenPanelEnabled()

  // Next-step row source: the SAME priority-ordered active list the
  // Strengthen panel renders first (selectActive over the lifecycle store),
  // so the hero can never name a different "top" than the panel below.
  // Records/priorityOrder are selected separately (stable references — a
  // derived-array selector would loop React's useSyncExternalStore).
  const records = useStrengthenStore((s) => s.records)
  const priorityOrder = useStrengthenStore((s) => s.priorityOrder)
  const nextRecommendation = useMemo(() => {
    if (!strengthenOn) return null
    const top = selectActive({ records, priorityOrder })[0]
    return top?.snapshot.title ?? null
  }, [strengthenOn, records, priorityOrder])

  // Wave F-B: the hero rerun routes through the canonical runner — its old
  // private useV2Run instance bypassed the dock's run gate and the V5 fact
  // path (no cross-instance mutex; audit F-77).
  const onRerun = useCallback(() => {
    void executeCanonicalRun({ source: 'analysis-hero' })
  }, [])

  return {
    model,
    onRerun,
    rerunDisabled: isAnalysing,
    // Flag-aware scroll target: Strengthen wins inside its flag (ResultsBody
    // mounts it INSTEAD of FocusNow), else the FocusNow panel, else none.
    focusPanelSelector: strengthenOn
      ? STRENGTHEN_PANEL_SELECTOR
      : isFocusNowPanelEnabled()
        ? FOCUS_NOW_PANEL_SELECTOR
        : null,
    nextRecommendation,
  }
}
