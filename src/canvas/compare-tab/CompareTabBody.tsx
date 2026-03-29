/**
 * Compare Tab: Refinement Journey
 *
 * Shows how the recommendation and model quality evolved across
 * analysis runs within a session. Gated on having 2+ snapshots.
 */
import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useCanvasStore } from '../store'
import { useAnalysisSnapshotStore, selectSnapshots } from '../stores/analysisSnapshotStore'
import { useUIStore } from '../../stores/uiStore'
import { deriveCompareState } from './deriveCompareState'
import { deriveTransitions, buildCumulativeTransition } from './deriveTransitions'
import { TabHeader } from './TabHeader'
import { RunSelector } from './RunSelector'
import { Hero } from './Hero'
import { TrajectorySection } from './TrajectorySection'
import { TransitionsSection } from './TransitionsSection'
import { CompareFooter } from './CompareFooter'
import { EmptyState } from './EmptyState'
import type { RunPreset, Transition } from './types'

interface CompareTabBodyProps {
  onRunAnalysis: () => void
}

const EXPERT_STORAGE_KEY = 'feature.compareExpert'

export function CompareTabBody({ onRunAnalysis }: CompareTabBodyProps) {
  // Snapshot data
  const snapshots = useAnalysisSnapshotStore(selectSnapshots)
  const graphIsStale = useCanvasStore(s => s.graphEditedSinceLastRun)

  // UI state
  const [preset, setPreset] = useState<RunPreset>('prev')
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

  // Visible transitions based on preset
  const visibleTransitions = useMemo((): Transition[] => {
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
  }, [preset, allTransitions, snapshots])

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

  // Empty state
  if (snapshots.length < 2) {
    return (
      <div className="flex flex-col h-full" data-testid="compare-tab-body">
        <TabHeader showExpert={showExpert} onToggleExpert={handleToggleExpert} />
        <EmptyState onViewResults={switchToResults} />
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
      />
      <div className="flex-1 min-h-0 overflow-y-auto">
        <Hero state={compareState} snapshots={snapshots} showExpert={showExpert} />
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
