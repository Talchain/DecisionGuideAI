/**
 * Header-row contract: the four setup meters now sit on ONE compact row, to
 * the left of the Actions menu, with no separate "Before analysis" eyebrow.
 * Each meter is a vertical segmented gauge — discrete segments whose lit count
 * is driven by the bar fill. This locks that structure so a future edit can't
 * quietly restack it or desync the gauge from its data-lit count.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import type { Node } from '@xyflow/react'
import { PreAnalysisPanelV3 } from '../PreAnalysisPanelV3'
import { ToastProvider } from '../../../ToastContext'
import { useCanvasStore } from '../../../store'
import { useReadinessStore } from '../../../stores/readinessStore'
import { GAUGE_SEGMENTS } from '../constants'

function node(id: string, kind: string, label: string, data: Record<string, unknown> = {}): Node {
  return { id, type: kind, position: { x: 0, y: 0 }, data: { kind, label, ...data } } as Node
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })))
  useReadinessStore.setState({
    readiness: {
      readiness_score: 72,
      readiness_level: 'ready', // ROADMAP 2.635 — was 'strong', the local heuristic's spelling of the top band; that heuristic is deleted and the level with it. `ready` is the producer's own top band at this score.
      can_run_analysis: true,
      confidence_explanation: 'Looks consistent.',
      improvements: [],
    },
    loading: false,
    error: null,
  })
  useCanvasStore.setState({
    nodes: [
      node('d1', 'decision', 'Hire a tech lead or two developers?'),
      node('g1', 'goal', 'Increase delivery output', {
        goal_threshold: 0.8,
        goal_threshold_raw: 20,
        goal_threshold_unit: '%',
      }),
      node('o1', 'option', 'Hire a tech lead'),
      node('o2', 'option', 'Hire two developers'),
      node('r1', 'risk', 'Onboarding drag', { provenance: 'ai_inferred' }),
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

describe('pre-analysis v3 — single-row status header', () => {
  it('puts the four meters and the Actions menu on the one header row', () => {
    renderPanel()
    // The header is the single border-b row (locked unique by hierarchyContract);
    // both the meters and the Actions trigger share it.
    const header = screen.getByTestId('pre-analysis-v3-bar-frame').closest('.border-b') as HTMLElement
    expect(header).not.toBeNull()
    expect(header.className).toContain('flex')
    expect(header.contains(screen.getByTestId('pre-analysis-v3-actions'))).toBe(true)
  })

  it('drops the standalone "Before analysis" eyebrow', () => {
    renderPanel()
    expect(screen.queryByText('Before analysis')).toBeNull()
  })

  it('renders each meter as a stack of GAUGE_SEGMENTS segments whose lit count matches data-lit', () => {
    renderPanel()
    for (const key of ['frame', 'options', 'risks', 'estimates'] as const) {
      const gauge = screen.getByTestId(`pre-analysis-v3-gauge-${key}`)
      const segs = gauge.querySelectorAll(':scope > span')
      expect(segs).toHaveLength(GAUGE_SEGMENTS)
      const lit = [...segs].filter(s => !s.classList.contains('bg-track-neutral')).length
      expect(String(lit)).toBe(gauge.getAttribute('data-lit'))
    }
  })

  it('maps count-driven fills to the right number of lit segments', () => {
    renderPanel()
    // 4-segment gauge. Options: 2 of 3 → 0.667 → round(2.67) = 3 lit.
    // Risks: 1 of 3 → 0.333 → round(1.33) = 1 lit.
    expect(screen.getByTestId('pre-analysis-v3-gauge-options').getAttribute('data-lit')).toBe('3')
    expect(screen.getByTestId('pre-analysis-v3-gauge-risks').getAttribute('data-lit')).toBe('1')
  })

  it('keeps the state word in the accessible name, not the visible label (one line)', () => {
    renderPanel()
    // No visible state word — the label stays "Risks:" so the meters stay on one line.
    expect(screen.getByTestId('pre-analysis-v3-bar-risks')).toHaveTextContent('Risks:')
    expect(screen.getByTestId('pre-analysis-v3-bar-risks')).not.toHaveTextContent('low')
    expect(screen.getByTestId('pre-analysis-v3-bar-frame')).not.toHaveTextContent('good')
    // The state word + count still live in the accessible name (Risks = 1 of 3 → low).
    expect(screen.getByTestId('pre-analysis-v3-bar-risks')).toHaveAccessibleName(/^Risks: low\. /)
  })
})
