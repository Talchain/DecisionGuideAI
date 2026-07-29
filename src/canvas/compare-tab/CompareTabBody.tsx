/**
 * Compare Tab: Refinement Journey
 *
 * Shows how the recommendation and model quality evolved across
 * analysis runs within a session. Gated on having 2+ snapshots.
 */
import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useCanvasStore } from '../store'
import { useAnalysisTrust } from '../hooks/useAnalysisTrust'
import { AnalysisRunStateCover } from '../components/AnalysisRunStateCover'
import { useAnalysisSnapshotStore, selectSnapshots } from '../stores/analysisSnapshotStore'
import { useCompareHistoryHydration } from './useCompareHistoryHydration'
import { useUIStore } from '../../stores/uiStore'
import { deriveCompareState } from './deriveCompareState'
import { deriveTransitions, buildCumulativeTransition, buildRangeTransition } from './deriveTransitions'
import { deriveRunPairComparison } from './deriveRunPairComparison'
import { applyRunPairChange, normaliseRunPair } from './runPairSelection'
import { TabHeader } from './TabHeader'
import { RunSelector } from './RunSelector'
import { RunPairCompare } from './RunPairCompare'
import { Hero } from './Hero'
import { TrajectorySection } from './TrajectorySection'
import { TransitionsSection } from './TransitionsSection'
import { CompareFooter } from './CompareFooter'
import { EmptyState } from './EmptyState'
import type { RunPair, RunPreset, Transition } from './types'

interface CompareTabBodyProps {
  onRunAnalysis: () => void
}

const EXPERT_STORAGE_KEY = 'feature.compareExpert'

export function CompareTabBody({ onRunAnalysis }: CompareTabBodyProps) {
  // ROADMAP 2.113a slice 1: seed the journey from PERSISTED `run_analysis`
  // facts. The session capture gate (canvas/store.ts `resultsComplete`)
  // requires a `rawV2Response`, and the deployed V5 results-hydration path
  // passes null for it — so before this hook the tab had no data source on
  // the live wire at all, reload or no reload. Everything below is unchanged:
  // this fills the same store the tab already read.
  useCompareHistoryHydration()

  // Snapshot data
  const snapshots = useAnalysisSnapshotStore(selectSnapshots)
  // One trust surface (F10/F11): staleness AND run state both come from the
  // composed useAnalysisTrust answer, never from local flags.
  // "Results outdated" must reflect the composed trust semantic being
  // 'changed' (CEE 'stale' OR a retained-fresh-now-dirtied), NOT the local
  // `graphEditedSinceLastRun` flag, which would independently fabricate a
  // stale state.
  const trust = useAnalysisTrust()
  const graphIsStale = trust.semantic === 'changed'

  // UI state
  const [preset, setPreset] = useState<RunPreset>('prev')
  /**
   * ROADMAP 2.113a slice 2 — the runs the user picked, BY RUN NUMBER, exactly
   * as requested. It is deliberately NOT clamped in state: re-hydration
   * renumbers the journey, and clamping on write would silently rewrite a
   * choice the user could still get back. `pair` below is the resolved value.
   */
  const [requestedPair, setRequestedPair] = useState<RunPair | null>(null)
  const [showExpert, setShowExpert] = useState(() => {
    try { return localStorage.getItem(EXPERT_STORAGE_KEY) === '1' } catch { return false }
  })

  const handleToggleExpert = useCallback((val: boolean) => {
    setShowExpert(val)
    try { localStorage.setItem(EXPERT_STORAGE_KEY, val ? '1' : '0') } catch { /* */ }
  }, [])

  // State machine
  const compareState = useMemo(
    () => deriveCompareState(snapshots, graphIsStale),
    [snapshots, graphIsStale],
  )

  // All transitions
  const allTransitions = useMemo(
    () => deriveTransitions(snapshots),
    [snapshots],
  )

  // ── Pick-two-runs (slice 2) ────────────────────────────────────────────
  const runs = useMemo(
    () => snapshots.map(s => ({ runNumber: s.runNumber, timestamp: s.timestamp })),
    [snapshots],
  )
  const pair = useMemo(
    () => normaliseRunPair(snapshots.map(s => s.runNumber), requestedPair),
    [snapshots, requestedPair],
  )
  /**
   * Positions of the picked pair in the SAME ordered list every other
   * derivation here reads, resolved by run number rather than assuming
   * `runNumber - 1`. Null whenever the pair cannot be resolved to two distinct
   * runs in forward order — and then nothing pair-shaped renders at all,
   * rather than a comparison of a run with itself.
   */
  const pairIndices = useMemo(() => {
    if (!pair) return null
    const fromIndex = snapshots.findIndex(s => s.runNumber === pair.from)
    const toIndex = snapshots.findIndex(s => s.runNumber === pair.to)
    if (fromIndex < 0 || toIndex < 0 || fromIndex >= toIndex) return null
    return { fromIndex, toIndex }
  }, [pair, snapshots])
  /**
   * Derived ONLY while the pair view is the one being looked at — and this is
   * the SINGLE gate on the pair view, deliberately.
   *
   * ⚠ There was a second one: the JSX below also tested `preset === 'pick'`.
   * Mutation-checking found it inert — removing it REDs nothing, because this
   * memo already returns null under every other preset. A redundant condition
   * that reads like a control and cannot fail is the guarantee-theatre this
   * estate keeps paying for, so it is gone and this one carries the whole
   * decision: deleting it REDs both the "other presets are untouched" test and
   * the two pre-existing CompareTabBody specs, whose deliberately-partial
   * snapshot fixtures a comparison nobody asked for would crash on.
   */
  const pairComparison = useMemo(
    () => preset === 'pick' && pairIndices
      ? deriveRunPairComparison(snapshots[pairIndices.fromIndex], snapshots[pairIndices.toIndex])
      : null,
    [preset, pairIndices, snapshots],
  )
  const handlePairChange = useCallback(
    (endpoint: 'from' | 'to', runNumber: number) => {
      if (!pair) return
      setRequestedPair(applyRunPairChange(pair, endpoint, runNumber))
    },
    [pair],
  )

  // Visible transitions based on preset
  const visibleTransitions = useMemo((): Transition[] => {
    if (preset === 'pick') {
      // The narrative half of the pair view is the EXISTING TransitionsSection
      // / TransitionCard, fed the picked pair's own transition — the design's
      // "render the existing TransitionCard machinery for the chosen pair",
      // with no copy of it.
      const paired = pairIndices
        ? buildRangeTransition(snapshots, pairIndices.fromIndex, pairIndices.toIndex)
        : null
      return paired ? [paired] : []
    }
    if (preset === 'all') {
      return [...allTransitions].reverse()
    }
    if (preset === 'first') {
      const cumulative = buildCumulativeTransition(snapshots)
      return cumulative ? [cumulative] : []
    }
    // 'prev' — latest transition only
    return allTransitions.length > 0
      ? [allTransitions[allTransitions.length - 1]]
      : []
  }, [preset, allTransitions, snapshots, pairIndices])

  // Reset to 'prev' if "first" preset becomes unavailable
  useEffect(() => {
    if (preset === 'first' && snapshots.length <= 2) {
      setPreset('prev')
    }
  }, [preset, snapshots.length])

  // Canvas → Compare scroll: when a node is selected, scroll to relevant card
  const transitionRefs = useRef<Map<string, HTMLDivElement | null>>(new Map())
  const registerCardRef = useCallback((key: string, el: HTMLDivElement | null) => {
    if (el) transitionRefs.current.set(key, el)
    else transitionRefs.current.delete(key)
  }, [])
  const selectedNodes = useCanvasStore(s => s.selection?.nodeIds)
  const activeTab = useUIStore(s => s.activeOutputTab)

  useEffect(() => {
    if (activeTab !== 'compare') return
    if (!selectedNodes || selectedNodes.size === 0) return

    const selectedId = [...selectedNodes][0]
    const debounce = setTimeout(() => {
      // Find most recent transition mentioning this node
      for (const tr of [...visibleTransitions]) {
        if (tr.affectedFactorIds.includes(selectedId)) {
          const key = `${tr.fromRunNumber}-${tr.toRunNumber}`
          const el = transitionRefs.current.get(key)
          el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
          break
        }
      }
    }, 300)

    return () => clearTimeout(debounce)
  }, [selectedNodes, activeTab, visibleTransitions])

  // Handlers
  const switchToResults = useCallback(() => {
    useUIStore.getState().setActiveOutputTab('results')
  }, [])

  // Empty state. F9: while a run is in flight there is no content to
  // retain here, so the skeleton stands in for the frozen empty state
  // (which invites a run that is already happening). Settle, complete or
  // error, restores the honest empty state.
  if (snapshots.length < 2) {
    return (
      <div className="flex flex-col h-full" data-testid="compare-tab-body">
        <TabHeader showExpert={showExpert} onToggleExpert={handleToggleExpert} />
        {trust.isRunning ? (
          <div className="pt-3">
            <AnalysisRunStateCover
              isRunning
              startedAt={trust.runStartedAt}
              contentRetained={false}
            />
          </div>
        ) : (
          <EmptyState onViewResults={switchToResults} />
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full" data-testid="compare-tab-body">
      <TabHeader showExpert={showExpert} onToggleExpert={handleToggleExpert} />
      <RunSelector
        preset={preset}
        onChange={setPreset}
        runCount={snapshots.length}
        showExpert={showExpert}
        runs={runs}
        pair={pair}
        onPairChange={handlePairChange}
      />
      {/* F9: run in flight over retained snapshots — banner above, content
          marked busy below, never blanked (v6 doctrine). */}
      {trust.isRunning && (
        <div className="pt-2">
          <AnalysisRunStateCover isRunning startedAt={trust.runStartedAt} contentRetained />
        </div>
      )}
      <div
        className="flex-1 min-h-0 overflow-y-auto"
        aria-busy={trust.isRunning || undefined}
      >
        <Hero
          state={compareState}
          snapshots={snapshots}
          showExpert={showExpert}
          onRunAnalysis={onRunAnalysis}
        />
        {pairComparison && <RunPairCompare comparison={pairComparison} />}
        <TrajectorySection snapshots={snapshots} showExpert={showExpert} />
        <TransitionsSection
          transitions={visibleTransitions}
          showExpert={showExpert}
          registerCardRef={registerCardRef}
        />
      </div>
      <CompareFooter
        state={compareState}
        latestSnapshot={snapshots[snapshots.length - 1] ?? null}
        onRunAnalysis={onRunAnalysis}
        onSwitchToResults={switchToResults}
      />
    </div>
  )
}
