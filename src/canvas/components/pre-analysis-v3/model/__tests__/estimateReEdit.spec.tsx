/**
 * Reviewed-estimate re-edit affordance — journey-walk 2026-08-03 gap #3,
 * dead-end half.
 *
 * THE WITNESSED DEAD END (journey-walk-2026-08-03.md §1b item 5, UI
 * 43fd19e1): once a row reads "checked by you" its Check button is GONE —
 * `EstimateRow`'s reviewed branch renders a static tick with no affordance,
 * and `YourDecisionSection` additionally guards the drill-in with
 * `expandedEstimate === row.nodeId && !row.reviewed`. A wrong checked value
 * (the walk's silently-accepted `£60,000`) therefore cannot be repaired from
 * the surface that accepted it: the tester is locked out of their own edit.
 *
 * FIX SHAPE: reviewed rows keep an "Edit" affordance that reopens the same
 * drill-in; the parent guard drops `!row.reviewed`. No optimistic-state
 * change, no new write path — the same commitValue/commitConfirm handlers.
 *
 * RED-first at pristine 43fd19e1: the edit affordance testid does not exist
 * and the drill-in cannot open for a reviewed row.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import type { Node } from '@xyflow/react'
import { EstimateRow } from '../EstimateRow'
import type { EstimateRowModel } from '../../types'
import { PreAnalysisPanelV3 } from '../../PreAnalysisPanelV3'
import { ToastProvider } from '../../../../ToastContext'
import { useCanvasStore } from '../../../../store'
import { useReadinessStore } from '../../../../stores/readinessStore'

const base: EstimateRowModel = {
  nodeId: 'f1',
  label: 'Content Marketing Investment',
  rankLabel: 'lower',
  weight: 1,
  reviewed: true,
  aiSourced: false,
  attribution: { kind: 'person', displayName: 'You' },
  displayText: '0.6',
  rawPrefill: 0.6,
  cap: null,
  canEditValue: true,
  needsValue: false,
}

describe('EstimateRow — a reviewed row still offers a way back into the editor', () => {
  it('reviewed row renders an Edit affordance alongside the completion tick', () => {
    const onToggle = vi.fn()
    render(<EstimateRow row={base} expanded={false} onToggle={onToggle} />)
    // The completion pill stays — the affordance does not falsify the state.
    expect(screen.getByText('checked by you')).toBeInTheDocument()
    const edit = screen.getByTestId('pre-analysis-v3-edit-f1')
    expect(edit.tagName).toBe('BUTTON')
    fireEvent.click(edit)
    expect(onToggle).toHaveBeenCalledWith('f1')
  })

  it('confirm-only reviewed rows (canEditValue false) offer the affordance too — Confirm-as-is state is also revisitable', () => {
    render(
      <EstimateRow
        row={{ ...base, canEditValue: false, displayText: null }}
        expanded={false}
        onToggle={vi.fn()}
      />,
    )
    expect(screen.getByTestId('pre-analysis-v3-edit-f1')).toBeInTheDocument()
  })
})

function node(id: string, kind: string, label: string, data: Record<string, unknown> = {}): Node {
  return { id, type: kind, position: { x: 0, y: 0 }, data: { kind, label, ...data } } as Node
}

describe('YourDecisionSection guard — the drill-in opens for a reviewed row (real panel path)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })))
    useReadinessStore.setState({
      readiness: {
        readiness_score: 60,
        readiness_level: 'fair',
        can_run_analysis: true,
        confidence_explanation: '',
        improvements: [],
      },
      loading: false,
      error: null,
    })
    useCanvasStore.setState({
      nodes: [
        node('d1', 'decision', 'Grow ARR to £1M?'),
        node('g1', 'goal', 'Reach £1,000,000 ARR', { goal_threshold: 0.8 }),
        node('o1', 'option', 'Invest in Content Marketing'),
        node('o2', 'option', 'Hire Two Sales Reps'),
        // A user-reviewed factor: source user_override = "checked by you".
        node('f1', 'factor', 'Content Marketing Investment', {
          observedState: { raw_value: 0.6, value: 0.6, source: 'user_override' },
        }),
      ],
      edges: [],
      preAnalysisSensitivity: null,
      draftCoaching: null,
      currentBriefText: null,
      goalThreshold: 0.8,
    })
  })

  it('clicking Edit on the reviewed row opens the drill-in input', () => {
    render(
      <ToastProvider>
        <PreAnalysisPanelV3 onAnalyse={vi.fn()} isAnalysing={false} canRun blockedReason={undefined} />
      </ToastProvider>,
    )
    // Open the "Your decision" disclosure, then the estimates group (both
    // closed at rest — the group renders children only when open).
    fireEvent.click(
      within(screen.getByTestId('pre-analysis-v3-your-decision')).getAllByRole('button')[0],
    )
    fireEvent.click(
      within(screen.getByTestId('pre-analysis-v3-group-estimates')).getAllByRole('button')[0],
    )
    fireEvent.click(screen.getByTestId('pre-analysis-v3-edit-f1'))
    expect(
      screen.getByLabelText('Your estimate for Content Marketing Investment'),
    ).toBeInTheDocument()
  })
})
