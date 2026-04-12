/**
 * Tests for mirrorAnalysisReady — shared analysis_ready → store mirroring.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildAnalysisReadyPatch } from '../mirrorAnalysisReady'
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
