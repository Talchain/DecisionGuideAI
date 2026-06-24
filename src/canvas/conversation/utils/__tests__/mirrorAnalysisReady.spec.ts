/**
 * Tests for mirrorAnalysisReady — shared analysis_ready → store mirroring.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { buildAnalysisReadyPatch, applyAnalysisReadyPatch } from '../mirrorAnalysisReady'
import { applyValidatedGraph } from '../applyPatch'
import { useCanvasStore } from '../../../store'
import { resolveDisplayedFreshness } from '../../../store/analysisFreshness'
import type { GraphPatchBlock } from '../../types'

const makeBlock = (overrides: Partial<GraphPatchBlock> = {}): GraphPatchBlock => ({
  type: 'graph_patch',
  patch_id: 'p-1',
  summary: 'Test patch',
  operations: [],
  target_graph_hash: 'hash-1',
  ...overrides,
})

describe('buildAnalysisReadyPatch', () => {
  it('returns null when block has no analysis_ready', () => {
    const block = makeBlock()
    expect(buildAnalysisReadyPatch(block)).toBeNull()
  })

  it('returns patch with ceeAnalysisReady when analysis_ready is present', () => {
    const analysisReady = {
      options: [{ option_id: 'o1', label: 'Option A', interventions: {} }],
      goal_node_id: 'g1',
    }
    const block = makeBlock({ analysis_ready: analysisReady as any })
    const patch = buildAnalysisReadyPatch(block)
    expect(patch).not.toBeNull()
    expect(patch!.ceeAnalysisReady).toBe(analysisReady)
  })

  it('returns identical patch for same block (referential stability)', () => {
    const analysisReady = {
      options: [{ option_id: 'o1', label: 'A', interventions: {} }],
      goal_node_id: 'g1',
    }
    const block = makeBlock({ analysis_ready: analysisReady as any })
    const patch1 = buildAnalysisReadyPatch(block)
    const patch2 = buildAnalysisReadyPatch(block)
    expect(patch1!.ceeAnalysisReady).toBe(patch2!.ceeAnalysisReady)
  })
})

// ---------------------------------------------------------------------------
// #3: accepted graph patches route freshness through the source-of-truth reducer
// and dirty semantic changes. Both manual (ConversationPanel) and auto
// (useConversation) acceptance funnel through these same primitives —
// applyValidatedGraph / applyAutoApplyPatch for the mutation and
// applyAnalysisReadyPatch for the analysis_ready ingress — so exercising them
// directly covers both paths.
// ---------------------------------------------------------------------------

describe('applyAnalysisReadyPatch — freshness source of truth', () => {
  const factorNode = { id: 'n1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'F' } }
  const displayed = () => {
    const s = useCanvasStore.getState()
    return resolveDisplayedFreshness(s.analysisFreshness, s.analysisFreshnessDirty)
  }

  beforeEach(() => {
    useCanvasStore.setState({
      nodes: [],
      edges: [],
      history: { past: [], future: [] },
      analysisFreshness: null,
      analysisFreshnessDirty: false,
      ceeAnalysisReady: null,
    })
    // Establish a prior 'fresh' verdict (real payload shape).
    useCanvasStore.getState().setAnalysisFreshness({ freshness: 'fresh', freshness_reason: 'graph_hash_match' })
  })

  it('routes a patch analysis_ready.freshness through the freshness reducer (no longer dropped)', () => {
    applyAnalysisReadyPatch(
      { ceeAnalysisReady: { options: [], goal_node_id: 'g1', freshness: 'stale', freshness_reason: 'graph_changed' } as any },
      {},
    )
    expect(useCanvasStore.getState().analysisFreshness?.freshness).toBe('stale')
  })

  it('a graph patch with NO accompanying analysis_ready dirties the verdict → unknown (not false-fresh)', () => {
    // buildAnalysisReadyPatch returns null when the block carries no analysis_ready,
    // so applyAnalysisReadyPatch never runs — but the graph mutation still dirties.
    expect(buildAnalysisReadyPatch(makeBlock())).toBeNull()
    applyValidatedGraph({ nodes: [factorNode], edges: [] })
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(true)
    expect(displayed()).toBe('unknown')
  })

  it('a graph patch WITH a fresh re-analysis clears the overlay → fresh', () => {
    applyValidatedGraph({ nodes: [factorNode], edges: [] }) // mutation dirties
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(true)
    applyAnalysisReadyPatch(
      { ceeAnalysisReady: { options: [], goal_node_id: 'g1', freshness: 'fresh', freshness_reason: 'reanalysed' } as any },
      {},
    )
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(false)
    expect(displayed()).toBe('fresh')
  })

  it('graph-patch + CEE-fresh → the Results-surface stale chrome is NOT stale (no contradiction with the notice)', () => {
    // Regression for the dual-staleness contradiction: OutputsDock derives its
    // stale banner/dimming from the CEE slice (analysisStale = displayed is
    // 'stale'|'unknown'), NOT graphEditedSinceLastRun. After a validated patch +
    // CEE 'fresh', the notice shows 'fresh' AND the dock derivation must agree.
    applyValidatedGraph({ nodes: [factorNode], edges: [] })
    applyAnalysisReadyPatch(
      { ceeAnalysisReady: { options: [], goal_node_id: 'g1', freshness: 'fresh', freshness_reason: 'reanalysed' } as any },
      {},
    )
    const display = displayed()
    expect(display).toBe('fresh')
    // OutputsDock: const analysisStale = displayed === 'stale' || displayed === 'unknown'
    expect(display === 'stale' || display === 'unknown').toBe(false)
  })

  it('a FRESH verdict with POPULATED option interventions survives the backfill (no false-dirty)', () => {
    // Regression: the intervention backfill (batchUpdateNodes) runs AFTER the
    // fresh verdict is ingested. It writes CEE's own data back onto option nodes
    // and must NOT re-dirty / wipe the just-set fresh verdict.
    useCanvasStore.setState({
      nodes: [{ id: 'opt1', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option 1', kind: 'option' } } as never],
      edges: [],
      analysisFreshness: null,
      analysisFreshnessDirty: false,
      ceeAnalysisReady: null,
    })
    applyAnalysisReadyPatch(
      {
        ceeAnalysisReady: {
          options: [{ id: 'opt1', label: 'Option 1', interventions: { fac1: { value: 1 } } }],
          goal_node_id: 'g1',
          freshness: 'fresh',
          freshness_reason: 'reanalysed',
        } as never,
      },
      {},
    )
    // The backfill ran (interventions written) but the fresh verdict is intact.
    expect(
      (useCanvasStore.getState().nodes[0].data as { interventions?: unknown }).interventions,
    ).toBeDefined()
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(false)
    expect(useCanvasStore.getState().analysisFreshness?.freshness).toBe('fresh')
    expect(useCanvasStore.getState().ceeAnalysisReady).not.toBeNull()
    expect(displayed()).toBe('fresh')
  })
})
