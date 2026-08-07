/**
 * Estimate affordance contract (defect pass): an unchecked row must not show a
 * bare checkmark (which reads as already completed). It shows a compact "Check"
 * text action; the tick is reserved for completed rows; rows with no usable
 * value show "Add value"; and the group's checked-count excludes missing-value
 * rows.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import type { Node } from '@xyflow/react'
import { EstimateRow } from '../EstimateRow'
import type { EstimateRowModel } from '../../types'
import { PreAnalysisPanelV3 } from '../../PreAnalysisPanelV3'
import { ToastProvider } from '../../../../ToastContext'
import { useCanvasStore } from '../../../../store'
import { useReadinessStore } from '../../../../stores/readinessStore'

const base: EstimateRowModel = {
  nodeId: 'f1',
  label: 'Tech lead impact',
  rankLabel: 'top',
  weight: 1,
  reviewed: false,
  aiSourced: true,
  attribution: { kind: 'olumi' },
  displayText: '30%',
  rawPrefill: 30,
  cap: 100,
  canEditValue: true,
  needsValue: false,
}

function renderRow(over: Partial<EstimateRowModel>) {
  return render(<EstimateRow row={{ ...base, ...over }} expanded={false} onToggle={vi.fn()} />)
}

describe('EstimateRow affordance — no false completion signal', () => {
  it('unchecked-with-value shows a "Check" text action, not a completion tick', () => {
    renderRow({ reviewed: false, needsValue: false })
    const check = screen.getByTestId('pre-analysis-v3-check-f1')
    expect(check.tagName).toBe('BUTTON')
    expect(check).toHaveTextContent('Check')
    expect(check).toHaveAccessibleName('Check Tech lead impact')
    // A valued row never offers "Add value".
    expect(screen.queryByTestId('pre-analysis-v3-add-value-f1')).toBeNull()
  })

  it('a reviewed row shows completion state (checked pill), and no "Check" button', () => {
    renderRow({ reviewed: true })
    expect(screen.queryByTestId('pre-analysis-v3-check-f1')).toBeNull()
    expect(screen.queryByTestId('pre-analysis-v3-add-value-f1')).toBeNull()
    expect(screen.getByText('checked by you')).toBeInTheDocument()
  })

  it('a missing-value row shows "Add value", not "Check"', () => {
    renderRow({ reviewed: false, needsValue: true, displayText: null, rawPrefill: null })
    expect(screen.getByTestId('pre-analysis-v3-add-value-f1')).toHaveTextContent('Add value')
    expect(screen.queryByTestId('pre-analysis-v3-check-f1')).toBeNull()
  })
})

function node(id: string, kind: string, label: string, data: Record<string, unknown> = {}): Node {
  return { id, type: kind, position: { x: 0, y: 0 }, data: { kind, label, ...data } } as Node
}

describe('group meta — checked-count excludes missing-value rows', () => {
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
        node('d1', 'decision', 'Hire a tech lead or two developers?'),
        node('g1', 'goal', 'Increase delivery output', { goal_threshold: 0.8 }),
        node('o1', 'option', 'Hire a tech lead'),
        node('o2', 'option', 'Hire two developers'),
        // Valued AI estimate → checkable.
        node('f1', 'factor', 'Tech lead impact', {
          provenance: 'ai_inferred',
          observedState: { raw_value: 30, value: 0.3, unit: '%', source: 'cee_inference' },
        }),
        // No value at all → needs a value, excluded from the checkable count.
        node('f2', 'factor', 'Onboarding time', { provenance: 'ai_inferred' }),
      ],
      edges: [],
      preAnalysisSensitivity: null,
      draftCoaching: null,
      currentBriefText: null,
      goalThreshold: 0.8,
    })
  })

  it('reports "0 of 1 checked" (f2 has no value, so it is not counted as checkable)', () => {
    render(
      <ToastProvider>
        <PreAnalysisPanelV3 onAnalyse={vi.fn()} isAnalysing={false} canRun blockedReason={undefined} />
      </ToastProvider>,
    )
    expect(screen.getByTestId('pre-analysis-v3-bar-estimates')).toHaveAccessibleName(/0 of 1 checked/)
  })
})
