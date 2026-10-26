/**
 * End-to-end test: response.coaching.summary → adapter → ingestion → render.
 *
 * Covers the regression ChatGPT identified: legacy ingestion paths read
 * `(draftData as any).coaching?.summary` from the raw response, but the
 * adapter consumes `coaching` and emits `draftCoaching`. The summary must
 * therefore be sourced from `draftData.draftCoaching?.summary` and reach the
 * store's analysis_ready.coaching_summary. (The ModelHealthCard render half went
 * with the card, U2.)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { adaptDraftResponse } from '../../../../adapters/cee/client'
import { applyDraftResult } from '../../../utils/applyDraftResult'
import { useCanvasStore } from '../../../store'

// setCeeAnalysisReady (store.ts) emits DEV-only console.warn + console.trace
// diagnostics. Silence them in this targeted spec so output stays clean —
// the diagnostics are pre-existing and unrelated to what this test asserts.
let warnSpy: ReturnType<typeof vi.spyOn>
let traceSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  traceSpy = vi.spyOn(console, 'trace').mockImplementation(() => {})
  useCanvasStore.setState({
    nodes: [],
    edges: [],
    ceeAnalysisReady: null,
    draftCoaching: null,
  })
})

afterEach(() => {
  warnSpy.mockRestore()
  traceSpy.mockRestore()
})

describe('coaching.summary end-to-end (raw response → adapter → applyDraftResult → store)', () => {
  it('writes coaching.summary into the store', () => {
    const raw = {
      schema_version: '2.2',
      quality_overall: 7,
      nodes: [
        { id: 'g1', label: 'Revenue', type: 'goal', uncertainty: 0.1 },
        { id: 'f1', label: 'Price', type: 'factor', uncertainty: 0.3 },
      ],
      edges: [{ from: 'f1', to: 'g1', weight: 0.5 }],
      analysis_ready: {
        options: [{ id: 'opt1', label: 'Hold', status: 'ready' }],
        goal_node_id: 'g1',
      },
      coaching: { summary: 'You have three options to weigh.' },
    }

    const adapted = adaptDraftResponse(raw)
    expect(adapted.draftCoaching?.summary).toBe('You have three options to weigh.')

    applyDraftResult(adapted as Parameters<typeof applyDraftResult>[0])

    // Store contract preserved — the adapter still copies coaching.summary
    // through to ceeAnalysisReady.coaching_summary so any other consumer
    // (e.g. results panel) keeps working.
    const ar = useCanvasStore.getState().ceeAnalysisReady as { coaching_summary?: string } | null
    expect(ar).not.toBeNull()
    expect(ar!.coaching_summary).toBe('You have three options to weigh.')
  })

  it('does not write coaching_summary when coaching.summary is absent', () => {
    const raw = {
      schema_version: '2.2',
      quality_overall: 7,
      nodes: [{ id: 'g1', label: 'Revenue', type: 'goal', uncertainty: 0.1 }],
      edges: [],
      analysis_ready: {
        options: [{ id: 'opt1', label: 'Hold', status: 'ready' }],
        goal_node_id: 'g1',
      },
    }

    const adapted = adaptDraftResponse(raw)
    expect(adapted.draftCoaching).toBeNull()

    applyDraftResult(adapted as Parameters<typeof applyDraftResult>[0])

    const ar = useCanvasStore.getState().ceeAnalysisReady as { coaching_summary?: string } | null
    expect(ar?.coaching_summary).toBeUndefined()
  })
})
