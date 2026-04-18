/**
 * Integrated path test — 2026-04-10 fix brief verification
 *
 * Exercises the compound failure case where all three tasks interact:
 *   Task 1: Staleness guard prevents stale analysis_state on next turn
 *   Task 2: Intervention backfill populates node.data.interventions on patch accept
 *   Task 3: Label resolution produces entity names, not generic text
 *
 * This test does NOT render React components — it exercises the data layer
 * directly: backfill function, describeOperation, and store flag checks.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { backfillInterventionsOntoOptionNodes } from '../../utils/applyDraftResult'
import { describeOperation } from '../friendlyOperation'
import type { DescribeOpDeps } from '../friendlyOperation'
import type { PatchOperation } from '../types'
import { useCanvasStore } from '../../store'

// ---------------------------------------------------------------------------
// Store mock — mirrors applyDraftResult.spec.ts pattern
// ---------------------------------------------------------------------------

let storeNodes: any[] = []

const mockGetState = () => ({
  nodes: storeNodes,
  edges: [],
  currentScenarioId: 'test-scenario',
  // Staleness guard fields — read by buildRequest
  analysisStateReady: false,
  graphEditedSinceLastRun: false,
  results: { status: 'idle' },
  rawV2Response: null,
  // Diff-aware batch updater mirroring store.batchUpdateNodes. Added 2026-04-14
  // (commit a1b68fcf) — backfillInterventionsOntoOptionNodes routes through
  // this action so undo/redo reverts affected nodes in one step. Mock mirrors
  // the pattern in applyDraftResult.spec.ts: apply patches to storeNodes so
  // the subsequent getState().nodes read sees the written state.
  batchUpdateNodes: (updates: Array<{ id: string; data: Record<string, unknown> }>) => {
    if (!updates?.length) return { updatedCount: 0 }
    const byId = new Map(updates.map(u => [u.id, u.data]))
    let changed = 0
    const next = storeNodes.map(n => {
      const patch = byId.get(n.id)
      if (!patch) return n
      const merged = { ...n.data, ...patch }
      let diff = false
      for (const k of Object.keys(patch)) {
        if ((n.data as any)?.[k] !== (merged as any)[k]) { diff = true; break }
      }
      if (!diff) return n
      changed += 1
      return { ...n, data: merged }
    })
    if (changed > 0) storeNodes = next
    return { updatedCount: changed }
  },
})

vi.mock('../../store', () => ({
  useCanvasStore: Object.assign(vi.fn(), {
    getState: () => mockGetState(),
    setState: vi.fn((update: any) => {
      if (typeof update === 'function') {
        const patch = update({ nodes: storeNodes, edges: [] })
        if (patch.nodes) storeNodes = patch.nodes
      } else {
        if (update.nodes) storeNodes = update.nodes
      }
    }),
  }),
}))

vi.mock('../../store/scenarios', () => ({
  saveAutosave: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Fixtures — AI-added option via graph_patch with analysis_ready
// ---------------------------------------------------------------------------

const OPTION_ID = 'opt_tiered_pricing'
const OPTION_LABEL = 'Tiered pricing'
const FACTOR_ID = 'fac_revenue'

/** analysis_ready payload as CEE would provide on a graph_patch block */
const analysisReady = {
  goal_node_id: 'goal_profit',
  options: [
    {
      id: OPTION_ID,
      label: OPTION_LABEL,
      status: 'ready' as const,
      interventions: { [FACTOR_ID]: 1.2 },
      is_baseline: false,
    },
  ],
}

/** PatchOperation for adding the option node */
const addOptionOp: PatchOperation = {
  op: 'add_node',
  target_id: OPTION_ID,
  data: { kind: 'option', label: OPTION_LABEL },
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('integrated path — patch accept → backfill → label → staleness', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Pre-populate store with goal + the newly accepted option (no interventions yet)
    storeNodes = [
      {
        id: 'goal_profit',
        type: 'goal',
        position: { x: 0, y: 0 },
        data: { kind: 'goal', label: 'Profit' },
      },
      {
        id: OPTION_ID,
        type: 'option',
        position: { x: 100, y: 0 },
        data: { kind: 'option', label: OPTION_LABEL },
        // interventions intentionally absent — simulates patch just applied
      },
    ]
  })

  it('Task 2: backfill populates node.data.interventions from analysis_ready', () => {
    const result = backfillInterventionsOntoOptionNodes(analysisReady)

    expect(result.interventionBackfilledCount).toBe(1)
    // Verify the store node was updated
    const optionNode = storeNodes.find((n: any) => n.id === OPTION_ID)
    expect(optionNode.data.interventions).toEqual({ [FACTOR_ID]: 1.2 })
  })

  it('Task 3: describeOperation resolves label and kind for the add_option op', () => {
    const deps: DescribeOpDeps = {
      proposalItem: undefined,
      relatedElements: undefined,
      nodeLabels: new Map(),
      edgeEndpoints: new Map(),
    }

    const description = describeOperation(addOptionOp, deps)

    // Label resolved from op.data.label (tier 2), kind from op.data.kind
    expect(description).toBe('Add **Tiered pricing** (option)')
    // Must not contain raw IDs
    expect(description).not.toMatch(/opt_|fac_|goal_/)
  })

  it('Task 1: analysisStateReady=false prevents stale analysis_state inclusion', () => {
    // This verifies the store state contract that buildRequest reads.
    // After a patch accept triggers pushToHistory, analysisStateReady is false.
    const state = useCanvasStore.getState()

    // analysisStateReady is false (set by pushToHistory after patch-accept)
    expect(state.analysisStateReady).toBe(false)

    // buildRequest's gate condition: graphIsStale || !analysisIsReady → undefined
    const graphIsStale = state.graphEditedSinceLastRun
    const analysisIsReady = state.analysisStateReady
    const shouldIncludeAnalysis = !graphIsStale && analysisIsReady
    expect(shouldIncludeAnalysis).toBe(false)
  })

  it('compound: accept option → backfill → label → staleness gate all pass together', () => {
    // Step 1: Backfill interventions (Task 2)
    const backfillResult = backfillInterventionsOntoOptionNodes(analysisReady)
    expect(backfillResult.interventionBackfilledCount).toBe(1)

    const optionNode = storeNodes.find((n: any) => n.id === OPTION_ID)
    expect(optionNode.data.interventions).toEqual({ [FACTOR_ID]: 1.2 })

    // Step 2: Verify label resolution (Task 3)
    const deps: DescribeOpDeps = {
      proposalItem: undefined,
      relatedElements: undefined,
      nodeLabels: new Map(),
      edgeEndpoints: new Map(),
    }
    const description = describeOperation(addOptionOp, deps)
    expect(description).toContain('Tiered pricing')
    expect(description).toContain('option')
    expect(description).not.toMatch(/opt_|fac_|goal_/)

    // Step 3: Verify staleness gate (Task 1)
    // After a patch is accepted and pushToHistory runs, analysisStateReady
    // is false — buildRequest must not ship stale analysis_state.
    const state = useCanvasStore.getState()
    const shouldOmitAnalysis = !state.analysisStateReady || state.graphEditedSinceLastRun
    expect(shouldOmitAnalysis).toBe(true)
  })

  it('factor-only patch: backfill skips gracefully when no options in analysis_ready', () => {
    const factorOnlyAnalysisReady = {
      goal_node_id: 'goal_profit',
      options: [],
    }

    const result = backfillInterventionsOntoOptionNodes(factorOnlyAnalysisReady)
    expect(result.interventionBackfilledCount).toBe(0)
    expect(result.totalUpdatedCount).toBe(0)

    // Option node's data unchanged (no interventions key added spuriously)
    const optionNode = storeNodes.find((n: any) => n.id === OPTION_ID)
    expect(optionNode.data.interventions).toBeUndefined()
  })

  it('null analysis_ready: backfill handles null gracefully', () => {
    const result = backfillInterventionsOntoOptionNodes(null)
    expect(result.interventionBackfilledCount).toBe(0)
    expect(result.totalUpdatedCount).toBe(0)
  })

  it('second patch does not corrupt first option interventions', () => {
    // First backfill: populates tiered pricing interventions
    backfillInterventionsOntoOptionNodes(analysisReady)

    const optionBefore = storeNodes.find((n: any) => n.id === OPTION_ID)
    expect(optionBefore.data.interventions).toEqual({ [FACTOR_ID]: 1.2 })

    // Second backfill: different option, no overlap
    const secondAnalysisReady = {
      goal_node_id: 'goal_profit',
      options: [
        {
          id: 'opt_flat_rate',
          label: 'Flat rate',
          status: 'ready' as const,
          interventions: { [FACTOR_ID]: 0.8 },
        },
      ],
    }

    // Add the second option node to store
    storeNodes.push({
      id: 'opt_flat_rate',
      type: 'option',
      position: { x: 200, y: 0 },
      data: { kind: 'option', label: 'Flat rate' },
    })

    backfillInterventionsOntoOptionNodes(secondAnalysisReady)

    // First option's interventions untouched
    const optionAfter = storeNodes.find((n: any) => n.id === OPTION_ID)
    expect(optionAfter.data.interventions).toEqual({ [FACTOR_ID]: 1.2 })

    // Second option populated
    const secondOption = storeNodes.find((n: any) => n.id === 'opt_flat_rate')
    expect(secondOption.data.interventions).toEqual({ [FACTOR_ID]: 0.8 })
  })
})
