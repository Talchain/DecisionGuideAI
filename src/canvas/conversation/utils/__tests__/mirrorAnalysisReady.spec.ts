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
})
