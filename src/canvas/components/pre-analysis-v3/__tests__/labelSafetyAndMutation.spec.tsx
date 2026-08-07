/**
 * Scope guard for the CEE text protection: it applies to panel-only coaching
 * strings ONLY. It must never (a) rewrite shared graph labels (option / factor
 * / risk) — those are shared with the canvas and inspector, so a panel-only
 * rewrite would diverge naming; the permanent fix belongs in the draft_graph
 * prompt/glossary lane — nor (b) mutate any underlying graph data.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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
      // Shared labels deliberately contain terms the coaching guard would catch.
      node('o1', 'option', 'Keep the current graph'),
      node('o2', 'option', 'Hire two developers'),
      node('r1', 'risk', 'Edge failures pile up'),
      node('f1', 'factor', 'Graph density', {
        provenance: 'ai_inferred',
        observedState: { raw_value: 30, value: 0.3, unit: '%', source: 'cee_inference' },
      }),
    ],
    edges: [],
    preAnalysisSensitivity: null,
    // Coaching DOES contain banned terms — the guard should sanitise it.
    draftCoaching: {
      summary: 'The decision graph has several nodes.',
      strengthenItems: [],
      wideningLog: [],
      biasSignals: [],
    },
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

describe('panel guard: coaching only — never rewrites labels or mutates graph data', () => {
  it('sanitises CEE coaching but leaves shared graph labels verbatim, graph data unchanged', () => {
    const before = JSON.parse(JSON.stringify(useCanvasStore.getState().nodes.map(n => n.data)))

    renderPanel()

    // The guard IS active on coaching (sanitised in place).
    const slot = screen.getByTestId('pre-analysis-v3-coaching-slot')
    expect(slot).toHaveTextContent('The decision model has several factors.')
    expect(slot).not.toHaveTextContent('decision graph')
    expect(slot).not.toHaveTextContent('nodes')

    // Reveal the model view and every group.
    fireEvent.click(screen.getByTestId('pre-analysis-v3-your-decision').querySelector('button')!)
    fireEvent.click(screen.getByTestId('pre-analysis-v3-groups-toggle-all'))

    // Shared graph labels render VERBATIM, banned terms intact — not panel-rewritten.
    expect(screen.getByText('Keep the current graph')).toBeInTheDocument()
    expect(screen.getByText('Edge failures pile up')).toBeInTheDocument()
    expect(screen.getByText('Graph density')).toBeInTheDocument()

    // No underlying graph data was mutated by rendering / guarding.
    const after = useCanvasStore.getState().nodes.map(n => n.data)
    expect(after).toEqual(before)
  })
})
