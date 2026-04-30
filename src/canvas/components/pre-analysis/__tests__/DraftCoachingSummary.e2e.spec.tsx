/**
 * End-to-end test: response.coaching.summary → adapter → ingestion → render.
 *
 * Covers the regression ChatGPT identified: legacy ingestion paths read
 * `(draftData as any).coaching?.summary` from the raw response, but the
 * adapter consumes `coaching` and emits `draftCoaching`. The summary must
 * therefore be sourced from `draftData.draftCoaching?.summary` so that
 * ModelHealthCard can continue to display it via the legacy
 * analysis_ready.coaching_summary path.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { adaptDraftResponse } from '../../../../adapters/cee/client'
import { applyDraftResult } from '../../../utils/applyDraftResult'
import { useCanvasStore } from '../../../store'
import { ModelHealthCard } from '../ModelHealthCard'

beforeEach(() => {
  useCanvasStore.setState({
    nodes: [],
    edges: [],
    ceeAnalysisReady: null,
    draftCoaching: null,
  })
})

describe('coaching.summary end-to-end (raw response → adapter → applyDraftResult → render)', () => {
  it('renders the summary in ModelHealthCard after a draft completes', () => {
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

    const ar = useCanvasStore.getState().ceeAnalysisReady as { coaching_summary?: string } | null
    expect(ar).not.toBeNull()
    expect(ar!.coaching_summary).toBe('You have three options to weigh.')

    render(
      <ModelHealthCard
        compact
        completeness={null}
        evidence={null}
        balance={null}
        calibration={null}
        optionCount={1}
        goalLabel="Revenue"
        coachingSummary={ar!.coaching_summary ?? null}
        dynamicHeadline={null}
        isLoading={false}
        hasGoalNode
      />,
    )
    expect(screen.getByText('You have three options to weigh.')).toBeInTheDocument()
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
