// THE single adapter between the vNext surface and the app's stores.
//
// Import fence (machine-enforced by __tests__/importIsolation.spec.ts):
// this file is the ONLY module under src/canvas-vnext/ allowed to import
// the canvas store, guidance store, or analysis-state hooks. Everything
// else consumes the pure VM via context.

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useCanvasStore } from '../../canvas/store'
import { useGuidanceStore } from '../../canvas/stores/guidanceStore'
import { useAnalysisDisplayState } from '../../canvas/hooks/useAnalysisDisplayState'
import { buildGraphExperienceVM } from './buildGraphExperienceVM'
import type { GraphExperienceVM } from './types'

const GraphExperienceVMContext = createContext<GraphExperienceVM | null>(null)

/**
 * RF-shaped graph inputs for the vNext <ReactFlow> pane. Lives in this file
 * so components never import the canvas store directly (one-adapter rule).
 * Read-only: the returned arrays are the store's own references — never
 * mutate them.
 */
export function useVNextGraphInputs() {
  return useCanvasStore(
    useShallow((s) => ({
      nodes: s.nodes,
      edges: s.edges,
    })),
  )
}

/**
 * Fire the guidance store's chat prefill if a host has registered one.
 * Returns false (no-op) when unavailable — callers disable the affordance.
 */
export function prefillChatText(text: string): boolean {
  const prefill = useGuidanceStore.getState()._prefillChat
  if (!prefill) return false
  prefill(text)
  return true
}

export function useGraphExperienceVMContext(): GraphExperienceVM {
  const vm = useContext(GraphExperienceVMContext)
  if (!vm) {
    throw new Error('useGraphExperienceVMContext must be used within GraphExperienceVMProvider')
  }
  return vm
}

function useLiveGraphExperienceVM(): GraphExperienceVM {
  const { nodes, edges, goalThreshold, ceeAnalysisReady, report } = useCanvasStore(
    useShallow((s) => ({
      nodes: s.nodes,
      edges: s.edges,
      goalThreshold: s.goalThreshold,
      ceeAnalysisReady: s.ceeAnalysisReady,
      report: s.results.report ?? null,
    })),
  )
  const displayView = useAnalysisDisplayState()
  const prefillChatAvailable = useGuidanceStore((s) => s._prefillChat != null)

  return useMemo(
    () =>
      buildGraphExperienceVM({
        provenance: 'live',
        nodes,
        edges,
        report: report as Record<string, any> | null,
        goalThreshold,
        ceeAnalysisReady,
        displayState: displayView.state,
        prefillChatAvailable,
      }),
    [nodes, edges, report, goalThreshold, ceeAnalysisReady, displayView.state, prefillChatAvailable],
  )
}

/**
 * Provides the VM to the vNext tree. When `fixtureVM` is set (demo map), it
 * REPLACES the live VM wholesale — fixture data is never merged with live
 * data and never written to any store.
 */
export function GraphExperienceVMProvider({
  children,
  fixtureVM = null,
}: {
  children: ReactNode
  fixtureVM?: GraphExperienceVM | null
}) {
  const liveVM = useLiveGraphExperienceVM()
  return (
    <GraphExperienceVMContext.Provider value={fixtureVM ?? liveVM}>
      {children}
    </GraphExperienceVMContext.Provider>
  )
}
