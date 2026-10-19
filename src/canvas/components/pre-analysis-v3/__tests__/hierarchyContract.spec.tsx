/**
 * Visual-hierarchy contract (commit 6e40b04f). Behaviour is covered elsewhere;
 * this locks the structural invariants the section-separation pass established,
 * so a future edit can't silently re-blur the sections:
 *   - NO element in the panel carries a one-sided rule (`border-t/b/l/r/x/y`
 *     or `divide-x/y`): Design System v5 §6, Paul 18 Oct 2026, "we don't use
 *     single-sided borders ever". Sections are separated by space;
 *   - Hero owns no rule (neither border-b nor border-t);
 *   - Sharpen and the Footer keep their own vertical padding, so the space
 *     that replaced each rule is still there;
 *   - exactly ONE neutral `bg-panel-hover` section-header strip (Sharpen);
 *     the disclosure triggers must NOT carry it as a static fill;
 *   - PanelDisclosure bodies are always mounted with `hidden` when closed
 *     (valid aria-controls target; no focusable leakage when collapsed).
 *
 * Class-token assertions are intentional here — pinning the exact structural
 * decisions is the point. `classList.contains('bg-panel-hover')` matches the
 * static token only, never `hover:bg-panel-hover`.
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

const hasToken = (el: Element | null | undefined, token: string) =>
  el != null && el.classList.contains(token)

describe('pre-analysis v3 — visual hierarchy contract', () => {
  it('no element in the panel carries a one-sided rule (DS v5 §6)', () => {
    renderPanel()
    const panel = screen.getByTestId('pre-analysis-v3')
    const oneSided = [...panel.querySelectorAll('*')].filter(el =>
      [...el.classList].some(t => /^(?:[a-z0-9-]+:)*(?:border-[tblrxy]|divide-[xy])(?:-|$)/.test(t)))
    expect(oneSided.map(el => el.className)).toEqual([])
    // CONTRAST: the header row is present and carries its own vertical padding.
    expect(hasToken(screen.getByTestId('pre-analysis-v3-header'), 'py-2.5')).toBe(true)
  })

  it('Hero owns no separator rule', () => {
    renderPanel()
    const hero = screen.getByTestId('pre-analysis-v3-hero')
    expect(hasToken(hero, 'border-b')).toBe(false)
    expect(hasToken(hero, 'border-t')).toBe(false)
  })

  it('Sharpen, the two disclosures and the Footer carry no top rule; Sharpen and the Footer keep their padding', () => {
    renderPanel()
    for (const testid of ['pre-analysis-v3-sharpen', 'pre-analysis-v3-your-decision', 'pre-analysis-v3-advanced', 'pre-analysis-v3-footer']) {
      expect(hasToken(screen.getByTestId(testid), 'border-t'), testid).toBe(false)
    }
    expect(hasToken(screen.getByTestId('pre-analysis-v3-sharpen'), 'py-4')).toBe(true)
    expect(hasToken(screen.getByTestId('pre-analysis-v3-footer'), 'py-3')).toBe(true)
  })

  it('exactly one neutral header strip: Sharpen carries static bg-panel-hover; disclosure triggers do not', () => {
    renderPanel()
    const sharpenStrip = screen.getByTestId('pre-analysis-v3-sharpen').firstElementChild
    expect(hasToken(sharpenStrip, 'bg-panel-hover')).toBe(true)

    // Disclosure trigger buttons rely on chevron + border, not a static fill
    // (a static bg-panel-hover would swallow their hover affordance).
    for (const testid of ['pre-analysis-v3-your-decision', 'pre-analysis-v3-advanced']) {
      const trigger = screen.getByTestId(testid).querySelector('button')
      expect(trigger).not.toBeNull()
      expect(hasToken(trigger, 'bg-panel-hover')).toBe(false)
    }
  })

  it('PanelDisclosure bodies stay mounted and use hidden when closed (no focusable leakage)', () => {
    renderPanel()
    // Both sections render collapsed by default.
    for (const testid of ['pre-analysis-v3-your-decision', 'pre-analysis-v3-advanced']) {
      const section = screen.getByTestId(testid)
      const trigger = section.querySelector('button')!
      const bodyId = trigger.getAttribute('aria-controls')
      expect(bodyId).toBeTruthy()
      const body = section.querySelector(`#${CSS.escape(bodyId!)}`) as HTMLElement | null
      expect(body).not.toBeNull() // always mounted (valid aria-controls target)
      expect(body!.hidden).toBe(true) // collapsed → hidden → inert/non-focusable
      expect(trigger.getAttribute('aria-expanded')).toBe('false')
    }
  })
})
