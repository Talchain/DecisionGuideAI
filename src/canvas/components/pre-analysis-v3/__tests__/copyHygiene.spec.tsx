/**
 * Copy hygiene (defect pass, task 5): the roadmap/internal line "Effect
 * strengths appear here once value handling is finalised" must not appear on
 * the user surface. A user-facing, non-implementation note lives behind
 * Advanced instead.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import type { Node } from '@xyflow/react'
import { PreAnalysisPanelV3 } from '../PreAnalysisPanelV3'
import { ToastProvider } from '../../../ToastContext'
import { useCanvasStore } from '../../../store'
import { useReadinessStore } from '../../../stores/readinessStore'

function node(id: string, kind: string, label: string, data: Record<string, unknown> = {}): Node {
  return { id, type: kind, position: { x: 0, y: 0 }, data: { kind, label, ...data } } as Node
}

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
      node('d1', 'decision', 'Decide hiring'),
      node('g1', 'goal', 'Increase output', { goal_threshold: 0.8 }),
      node('o1', 'option', 'Hire a tech lead'),
      node('o2', 'option', 'Hire two developers'),
      node('f1', 'factor', 'Tech lead impact', {
        provenance: 'ai_inferred',
        observedState: { raw_value: 30, value: 0.3, unit: '%', source: 'cee_inference' },
      }),
    ],
    edges: [],
    preAnalysisSensitivity: null,
    draftCoaching: null,
    currentBriefText: null,
    goalThreshold: 0.8,
  })
})

function renderPanel() {
  return render(
    <ToastProvider>
      <PreAnalysisPanelV3 onAnalyse={vi.fn()} isAnalysing={false} canRun blockedReason={undefined} />
    </ToastProvider>,
  )
}

describe('copy hygiene — no roadmap/internal language on the user surface', () => {
  it('does not render the effect-strength roadmap line anywhere (disclosures stay mounted)', () => {
    renderPanel()
    expect(screen.queryByText(/Effect strengths appear here/i)).toBeNull()
    expect(screen.queryByText(/value handling is finalised/i)).toBeNull()
  })

  it('houses a user-facing technical-detail note in Advanced (no implementation wording)', () => {
    renderPanel()
    // PanelDisclosure bodies stay mounted, so the note is present (in Advanced).
    expect(
      screen.getByText('More technical relationship detail will appear here when available.'),
    ).toBeInTheDocument()
  })
})
