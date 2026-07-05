/**
 * Tests for selectConversationStatus selector
 *
 * Verifies status derivation, top guidance item, count, and CTA kind
 * for all conversation states.
 */

import { describe, it, expect } from 'vitest'
import { selectConversationStatus } from '../selectors'
import type { ConversationStatusInput } from '../selectors'
import type { GuidanceItem } from '../../stores/guidanceStore'
import type { ConversationMessage, GraphPatchBlock, BriefBlock } from '../types'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeGuidanceItem(overrides: Partial<GuidanceItem> = {}): GuidanceItem {
  return {
    item_id: 'g-1',
    signal_code: 'EDGE_DEFAULT',
    category: 'should_fix',
    source: 'structural',
    title: 'Fix edge strength',
    priority: 50,
    primary_action: { type: 'discuss', prompt: 'Tell me about this.' },
    ...overrides,
  }
}

function makeInput(overrides: Partial<ConversationStatusInput> = {}): ConversationStatusInput {
  return {
    nodeCount: 0,
    resultsStatus: 'idle',
    hasCompletedFirstRun: false,
    analysisFreshness: null,
    analysisFreshnessDirty: false,
    guidance: {
      guidanceItems: [],
      activeGuidanceItemId: null,
      _sendMessage: null,
      _scrollToPatch: null,
      inspectorDeepLinkField: null,
      _runAnalysis: null,
      _sendChip: null,
      _prefillChat: null,
      _dispatchAction: null,
      _registrationToken: null,
    },
    messages: [],
    patchBlockStates: new Map(),
    ...overrides,
  }
}

function makePatchMsg(patchId = 'p-1'): ConversationMessage {
  const block: GraphPatchBlock = {
    type: 'graph_patch',
    patch_id: patchId,
    summary: 'Add node',
    operations: [{ op: 'add_node', target_id: 'n1', data: {} }],
    target_graph_hash: 'abc',
  }
  return {
    id: 'm-1',
    role: 'assistant',
    content: 'Here is a suggestion.',
    blocks: [block],
    timestamp: new Date(),
  }
}

function makeBriefMsg(): ConversationMessage {
  const block: BriefBlock = {
    type: 'brief',
    title: 'Decision brief',
    summary: 'Summary of the decision.',
  }
  return {
    id: 'm-2',
    role: 'assistant',
    content: 'Here is the brief.',
    blocks: [block],
    timestamp: new Date(),
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('selectConversationStatus', () => {
  it('returns empty when no messages, no nodes', () => {
    const result = selectConversationStatus(makeInput())
    expect(result.status).toBe('empty')
    expect(result.topGuidanceItem).toBeNull()
    expect(result.guidanceCount).toBe(0)
    expect(result.ctaKind).toBeNull()
  })

  it('returns framing when messages exist but no graph', () => {
    const result = selectConversationStatus(makeInput({
      messages: [{ id: 'm1', role: 'user', content: 'Hi', timestamp: new Date() }],
    }))
    expect(result.status).toBe('framing')
  })

  it('returns graph_ready when graph exists, no analysis', () => {
    const items = [makeGuidanceItem()]
    const result = selectConversationStatus(makeInput({
      nodeCount: 5,
      guidance: { guidanceItems: items, activeGuidanceItemId: null, _sendMessage: null, _scrollToPatch: null, inspectorDeepLinkField: null, _runAnalysis: null, _sendChip: null, _prefillChat: null, _dispatchAction: null, _registrationToken: null },
    }))
    expect(result.status).toBe('graph_ready')
    expect(result.ctaKind).toBe('view_issues')
    expect(result.topGuidanceItem?.item_id).toBe('g-1')
    expect(result.guidanceCount).toBe(1)
  })

  it('returns graph_ready with no CTA when no guidance items', () => {
    const result = selectConversationStatus(makeInput({ nodeCount: 3 }))
    expect(result.status).toBe('graph_ready')
    expect(result.ctaKind).toBeNull()
  })

  it('returns analysis_running when results are preparing', () => {
    const result = selectConversationStatus(makeInput({
      nodeCount: 3,
      resultsStatus: 'preparing',
    }))
    expect(result.status).toBe('analysis_running')
    expect(result.ctaKind).toBeNull()
  })

  it('returns analysis_running when results are streaming', () => {
    const result = selectConversationStatus(makeInput({
      nodeCount: 3,
      resultsStatus: 'streaming',
    }))
    expect(result.status).toBe('analysis_running')
  })

  it('returns analysis_ready when complete and freshness is current', () => {
    const result = selectConversationStatus(makeInput({
      nodeCount: 3,
      resultsStatus: 'complete',
      hasCompletedFirstRun: true,
      analysisFreshness: { freshness: 'fresh' },
    }))
    expect(result.status).toBe('analysis_ready')
    expect(result.ctaKind).toBe('view_results')
  })

  it('returns analysis_stale when the CEE freshness verdict is stale (changed)', () => {
    const result = selectConversationStatus(makeInput({
      nodeCount: 3,
      resultsStatus: 'complete',
      hasCompletedFirstRun: true,
      analysisFreshness: { freshness: 'stale' },
    }))
    expect(result.status).toBe('analysis_stale')
    expect(result.ctaKind).toBe('view_results')
  })

  it('returns patch_pending when pending patch exists', () => {
    const result = selectConversationStatus(makeInput({
      nodeCount: 3,
      messages: [makePatchMsg()],
      patchBlockStates: new Map(), // default = 'proposed'
    }))
    expect(result.status).toBe('patch_pending')
    expect(result.ctaKind).toBe('review_patch')
  })

  it('does not return patch_pending when patch is accepted', () => {
    const msg = makePatchMsg('p-1')
    // Composite key: msgId:patchId
    const result = selectConversationStatus(makeInput({
      nodeCount: 3,
      messages: [msg],
      patchBlockStates: new Map([[`${msg.id}:p-1`, 'accepted']]),
    }))
    expect(result.status).not.toBe('patch_pending')
  })

  it('returns brief_ready when brief block exists', () => {
    const result = selectConversationStatus(makeInput({
      nodeCount: 3,
      messages: [makeBriefMsg()],
    }))
    expect(result.status).toBe('brief_ready')
    expect(result.ctaKind).toBe('view_brief')
  })

  it('returns correct topGuidanceItem and guidanceCount', () => {
    const items = [
      makeGuidanceItem({ item_id: 'low', priority: 10 }),
      makeGuidanceItem({ item_id: 'high', priority: 90 }),
      makeGuidanceItem({ item_id: 'mid', priority: 50 }),
    ]
    const result = selectConversationStatus(makeInput({
      nodeCount: 3,
      guidance: { guidanceItems: items, activeGuidanceItemId: null, _sendMessage: null, _scrollToPatch: null, inspectorDeepLinkField: null, _runAnalysis: null, _sendChip: null, _prefillChat: null, _dispatchAction: null, _registrationToken: null },
    }))
    expect(result.topGuidanceItem?.item_id).toBe('high')
    expect(result.guidanceCount).toBe(3)
  })

  it('returns correct ctaKind for each status', () => {
    // graph_ready with guidance → view_issues
    expect(selectConversationStatus(makeInput({
      nodeCount: 3,
      guidance: { guidanceItems: [makeGuidanceItem()], activeGuidanceItemId: null, _sendMessage: null, _scrollToPatch: null, inspectorDeepLinkField: null, _runAnalysis: null, _sendChip: null, _prefillChat: null, _dispatchAction: null, _registrationToken: null },
    })).ctaKind).toBe('view_issues')

    // patch_pending → review_patch
    expect(selectConversationStatus(makeInput({
      nodeCount: 3,
      messages: [makePatchMsg()],
    })).ctaKind).toBe('review_patch')

    // analysis_ready → view_results
    expect(selectConversationStatus(makeInput({
      nodeCount: 3,
      resultsStatus: 'complete',
      hasCompletedFirstRun: true,
      analysisFreshness: { freshness: 'fresh' },
    })).ctaKind).toBe('view_results')

    // brief_ready → view_brief
    expect(selectConversationStatus(makeInput({
      nodeCount: 3,
      messages: [makeBriefMsg()],
    })).ctaKind).toBe('view_brief')

    // analysis_running → null
    expect(selectConversationStatus(makeInput({
      nodeCount: 3,
      resultsStatus: 'streaming',
    })).ctaKind).toBeNull()
  })

  // Single source of truth: staleness is the CEE freshness verdict + local dirty
  // overlay via classifyFreshnessForDisplay (=== 'changed'). Pin the mapping so it
  // never drifts back to independently deriving stale from graphEditedSinceLastRun.
  describe('freshness classifier (single source)', () => {
    it('CEE stale verdict → analysis_stale', () => {
      const result = selectConversationStatus(
        makeInput({
          nodeCount: 5,
          resultsStatus: 'complete',
          hasCompletedFirstRun: true,
          analysisFreshness: { freshness: 'stale' },
        }),
      )
      expect(result.status).toBe('analysis_stale')
    })

    it('CEE fresh + clean → analysis_ready', () => {
      const result = selectConversationStatus(
        makeInput({
          nodeCount: 5,
          resultsStatus: 'complete',
          hasCompletedFirstRun: true,
          analysisFreshness: { freshness: 'fresh' },
          analysisFreshnessDirty: false,
        }),
      )
      expect(result.status).toBe('analysis_ready')
    })

    it('CEE fresh downgraded by a local edit (dirty) → analysis_stale (changed)', () => {
      // The dirty overlay correctly flags a model edited since the fresh verdict.
      const result = selectConversationStatus(
        makeInput({
          nodeCount: 5,
          resultsStatus: 'complete',
          hasCompletedFirstRun: true,
          analysisFreshness: { freshness: 'fresh' },
          analysisFreshnessDirty: true,
        }),
      )
      expect(result.status).toBe('analysis_stale')
    })

    it('CEE-sourced unknown (cannot-confirm) → analysis_ready, NOT analysis_stale (no fabrication)', () => {
      const result = selectConversationStatus(
        makeInput({
          nodeCount: 5,
          resultsStatus: 'complete',
          hasCompletedFirstRun: true,
          analysisFreshness: { freshness: 'unknown' },
          analysisFreshnessDirty: true,
        }),
      )
      expect(result.status).toBe('analysis_ready')
    })

    it('no freshness verdict + complete → analysis_ready', () => {
      const result = selectConversationStatus(
        makeInput({
          nodeCount: 5,
          resultsStatus: 'complete',
          hasCompletedFirstRun: true,
          analysisFreshness: null,
        }),
      )
      expect(result.status).toBe('analysis_ready')
    })
  })
})
