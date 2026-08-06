/**
 * ROADMAP 2.376 — the contested-relationship surface in the V3 pre-analysis panel.
 *
 * WHY THIS SUITE EXISTS. #571 shipped `selectSurfacedContestedEdges` and wired it into the
 * LEGACY pre-analysis panel. Deployed staging runs `preAnalysisV3`, whose tree had ZERO
 * contested consumers — so on the surface a user actually sees, CEE's live validation
 * metadata (#808) was dark. This suite pins the V3 mount.
 *
 * WHAT EACH PIN IS FOR (every assertion is a mutant's tombstone):
 *  · MOUNT       — deleting `<ContestedSection>` from PreAnalysisPanelV3 must go RED.
 *  · IDENTITY    — the pins name the SPECIFIC surviving edge id and the SPECIFIC capped-out
 *                  edge id. Trap 19: never `getAllByTestId(...).toHaveLength(1)`, which a
 *                  different edge could satisfy.
 *  · SELECTOR    — three edges that a naive `status === 'contested'` filter WOULD render and
 *                  the selector does NOT (resolved / suppressed / capped). Rendering from any
 *                  field other than `selectSurfacedContestedEdges`'s output goes RED here.
 *  · EMPTY       — no contested edges renders NOTHING, not an empty section.
 *
 * jsdom proves PRESENCE, never visibility (trap 3). The on-screen witness rides walk phase 2.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { Edge, Node } from '@xyflow/react'
import { PreAnalysisPanelV3 } from '../PreAnalysisPanelV3'
import { ToastProvider } from '../../../ToastContext'
import { useCanvasStore } from '../../../store'
import { useReadinessStore } from '../../../stores/readinessStore'
import { useUIStore } from '../../../../stores/uiStore'
import { makeContestedEdge, makeContestedValidation } from '../../../../__fixtures__/contestedEdge'
import { CONTESTED_COPY } from '../constants'
import { getBasisLabel, getContestedReasonLabel } from '../../model-tab/strengthBands'
import { findBannedTerm } from '../../../../test/glossaryBannedTerms'
import type { ContestedReason, EstimateBasis } from '../../../domain/validation'
import type { EdgeData } from '../../../domain/edges'

function node(id: string, kind: string, label: string, data: Record<string, unknown> = {}): Node {
  return { id, type: kind, position: { x: 0, y: 0 }, data: { kind, label, ...data } } as Node
}

/** Base graph: enough for the panel to render, plus the factors our edges join. */
const BASE_NODES: Node[] = [
  node('d1', 'decision', 'Hire a tech lead or two developers?'),
  node('g1', 'goal', 'Increase delivery output', { goal_threshold: 0.8 }),
  node('o1', 'option', 'Hire a tech lead'),
  node('o2', 'option', 'Hire two developers'),
  node('f_lead', 'factor', 'Tech lead impact'),
  node('f_cost', 'factor', 'Salary cost'),
  node('f_speed', 'factor', 'Delivery speed'),
  node('f_morale', 'factor', 'Team morale'),
]

function setGraph(edges: Edge[]) {
  useCanvasStore.setState({
    nodes: BASE_NODES,
    // The shared `__fixtures__/contestedEdge` builder returns a plain `Edge` (it is also used
    // by Model-tab and telemetry suites that never touch the store); the store's slice is
    // `Edge<EdgeData>`. Narrowing at the boundary rather than forking the fixture — the fields
    // under test (`data.validation`, `source`, `target`, `id`) are identical either way.
    edges: edges as Edge<EdgeData>[],
    preAnalysisSensitivity: null,
    draftCoaching: null,
    currentBriefText: null,
    goalThreshold: 0.8,
  })
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
  useUIStore.setState({ activeOutputTab: 'results', pendingModelTabSection: null })
  setGraph([])
})

function renderPanel() {
  return render(
    <ToastProvider>
      <PreAnalysisPanelV3 onAnalyse={vi.fn()} isAnalysing={false} canRun blockedReason={undefined} />
    </ToastProvider>,
  )
}

const SECTION = 'pre-analysis-v3-contested'
const row = (edgeId: string) => `pre-analysis-v3-contested-row-${edgeId}`

describe('pre-analysis v3 — contested relationships mount', () => {
  it('renders the section when the selector surfaces a contested connection', () => {
    setGraph([
      makeContestedEdge('e_lead_speed', 'f_lead', 'f_speed', makeContestedValidation()),
    ])
    renderPanel()
    expect(screen.getByTestId(SECTION)).toBeInTheDocument()
    expect(screen.getByText(CONTESTED_COPY.title)).toBeInTheDocument()
  })

  it('names both ends of the connection in plain language, and why the reviews disagree', () => {
    setGraph([
      makeContestedEdge(
        'e_lead_speed',
        'f_lead',
        'f_speed',
        makeContestedValidation({ contested_reasons: ['sign_flip'] }),
      ),
    ])
    renderPanel()
    const rowEl = screen.getByTestId(row('e_lead_speed'))
    // Both node labels render VERBATIM (V3 never rewrites shared graph labels).
    expect(rowEl).toHaveTextContent('Tech lead impact')
    expect(rowEl).toHaveTextContent('Delivery speed')
    // The "why" is the plain-language reason, not a reason enum value.
    expect(rowEl).toHaveTextContent(
      'Our reviews disagree on whether this effect is positive or negative',
    )
    expect(rowEl.textContent).not.toContain('sign_flip')
  })

  it('puts the expert detail behind a disclosure, closed by default', () => {
    setGraph([
      makeContestedEdge('e_lead_speed', 'f_lead', 'f_speed', makeContestedValidation()),
    ])
    renderPanel()
    const trigger = screen.getByTestId(`pre-analysis-v3-contested-detail-e_lead_speed`)
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Based on general domain knowledge')).toBeNull()
    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Based on general domain knowledge')).toBeInTheDocument()
    expect(
      screen.getByText('Typical B2B ROI shows moderate conversion effects'),
    ).toBeInTheDocument()
  })
})

describe('pre-analysis v3 — contested section renders the SELECTOR output, nothing else', () => {
  /**
   * The cap. Two contested connections into the SAME target: the selector keeps exactly one,
   * by `max_divergence` desc. The pins are IDENTITY-BOUND — a count assertion would pass on
   * the wrong survivor.
   */
  it('the higher-divergence connection into a shared target survives; the other does NOT render', () => {
    setGraph([
      makeContestedEdge(
        'e_lead_speed',
        'f_lead',
        'f_speed',
        makeContestedValidation({ max_divergence: 0.2 }),
      ),
      makeContestedEdge(
        'e_cost_speed',
        'f_cost',
        'f_speed',
        makeContestedValidation({ max_divergence: 0.8 }),
      ),
    ])
    renderPanel()
    expect(screen.getByTestId(row('e_cost_speed'))).toBeInTheDocument()
    expect(screen.queryByTestId(row('e_lead_speed'))).toBeNull()
  })

  it('an ALREADY-RESOLVED contested connection does not render (a raw status filter would show it)', () => {
    setGraph([
      makeContestedEdge(
        'e_resolved',
        'f_lead',
        'f_speed',
        makeContestedValidation({ user_action: 'accepted_pass2' }),
      ),
      makeContestedEdge('e_open', 'f_cost', 'f_morale', makeContestedValidation()),
    ])
    renderPanel()
    expect(screen.getByTestId(row('e_open'))).toBeInTheDocument()
    expect(screen.queryByTestId(row('e_resolved'))).toBeNull()
  })

  it('an explicit `surfaced: false` from CEE is honoured (absent still means eligible)', () => {
    setGraph([
      makeContestedEdge(
        'e_suppressed',
        'f_lead',
        'f_speed',
        makeContestedValidation({ surfaced: false }),
      ),
      // `surfaced` ABSENT — the live wire shape. Must render.
      makeContestedEdge('e_absent', 'f_cost', 'f_morale', makeContestedValidation()),
    ])
    renderPanel()
    expect(screen.getByTestId(row('e_absent'))).toBeInTheDocument()
    expect(screen.queryByTestId(row('e_suppressed'))).toBeNull()
  })

  it('an AGREED connection never renders', () => {
    setGraph([
      makeContestedEdge(
        'e_agreed',
        'f_lead',
        'f_speed',
        makeContestedValidation({ status: 'agreed', contested_reasons: [] }),
      ),
    ])
    renderPanel()
    expect(screen.queryByTestId(SECTION)).toBeNull()
  })

  it('orders rows deterministically by the exported cap comparator', () => {
    setGraph([
      makeContestedEdge('e_a', 'f_lead', 'f_speed', makeContestedValidation({ max_divergence: 0.2 })),
      makeContestedEdge('e_b', 'f_cost', 'f_morale', makeContestedValidation({ max_divergence: 0.9 })),
      makeContestedEdge('e_c', 'f_speed', 'g1', makeContestedValidation({ max_divergence: 0.5 })),
    ])
    renderPanel()
    const ids = [...screen.getByTestId(SECTION).querySelectorAll('[data-contested-edge-id]')].map(
      el => el.getAttribute('data-contested-edge-id'),
    )
    expect(ids).toEqual(['e_b', 'e_c', 'e_a'])
  })
})

describe('pre-analysis v3 — contested section empty state', () => {
  it('renders NOTHING when there are no contested connections (no empty-section noise)', () => {
    setGraph([makeContestedEdge('e_plain', 'f_lead', 'f_speed')])
    renderPanel()
    expect(screen.queryByTestId(SECTION)).toBeNull()
    expect(screen.queryByText(CONTESTED_COPY.title)).toBeNull()
  })

  it('renders NOTHING on an edgeless model', () => {
    setGraph([])
    renderPanel()
    expect(screen.queryByTestId(SECTION)).toBeNull()
  })
})

describe('pre-analysis v3 — contested section routes to the ONE adjudication surface', () => {
  /**
   * DISPLAY-ONLY BY RULING. The legacy pre-analysis panel's contested resolve handler was
   * deleted in the Brief 4 Task 6 dead-code sweep (`PreAnalysisPanel.tsx:76,1106`), so there
   * is no pre-analysis write path to reuse; the only live adjudication surface is the Model
   * tab (`ModelTabBody::handleResolveContested` → `RelationshipsSection` →
   * `ContestedEdgeCard`). This slice does NOT invent a second one. It reuses the EXISTING,
   * non-mutating cross-panel handoff the legacy panel already uses for the same destination
   * (`PreAnalysisPanel.tsx:2304`).
   */
  it('the review affordance navigates to the Model tab relationships section and mutates no graph data', () => {
    const edges = [makeContestedEdge('e_open', 'f_lead', 'f_speed', makeContestedValidation())]
    setGraph(edges)
    const edgesBefore = JSON.stringify(useCanvasStore.getState().edges)
    renderPanel()

    fireEvent.click(screen.getByTestId('pre-analysis-v3-contested-review'))

    expect(useUIStore.getState().pendingModelTabSection).toBe('relationships')
    expect(useUIStore.getState().activeOutputTab).toBe('diagnostics')
    // Display-only: the click must not touch the graph.
    expect(JSON.stringify(useCanvasStore.getState().edges)).toBe(edgesBefore)
  })
})

/**
 * The borrowed copy is scanned too.
 *
 * `CONTESTED_COPY` rides the panel's own banned-terms sweep (registry.spec.ts), but the
 * sentences a user actually reads as the "why" come from `model-tab/strengthBands.ts`, which
 * that sweep does not reach. Deliberately reused rather than copied (trap 12) — so the sweep
 * has to follow them here.
 *
 * The maps below are the TYPE's key set, not a hand-kept list: `Record<ContestedReason, true>`
 * makes a new union member a COMPILE error rather than a silently unscanned sentence. That is
 * the union-assertion form of trap 12d — derivation alone could not notice a missing key.
 */
const ALL_CONTESTED_REASONS: Record<ContestedReason, true> = {
  sign_flip: true,
  strength_band_change: true,
  confidence_band_change: true,
  existence_boundary_crossing: true,
  raw_magnitude: true,
}
const ALL_BASES: Record<EstimateBasis, true> = {
  brief_explicit: true,
  structural_inference: true,
  domain_prior: true,
  weak_guess: true,
}

describe('pre-analysis v3 — the borrowed reason and basis copy passes the same glossary sweep', () => {
  it.each(Object.keys(ALL_CONTESTED_REASONS) as ContestedReason[])(
    'reason %s reads as plain language with no banned term',
    reason => {
      const label = getContestedReasonLabel(reason)
      expect(label.length).toBeGreaterThan(0)
      expect(findBannedTerm(label)).toBeNull()
      expect(label).not.toContain('—')
      // Never the enum value itself leaking onto the surface.
      expect(label).not.toContain(reason)
    },
  )

  it.each(Object.keys(ALL_BASES) as EstimateBasis[])(
    'basis %s reads as plain language with no banned term',
    basis => {
      const label = getBasisLabel(basis)
      expect(label.length).toBeGreaterThan(0)
      expect(findBannedTerm(label)).toBeNull()
      expect(label).not.toContain(basis)
    },
  )
})

describe('pre-analysis v3 — contested section respects the panel hierarchy contract', () => {
  it('owns a single top rule and introduces no second border-b', () => {
    setGraph([makeContestedEdge('e_open', 'f_lead', 'f_speed', makeContestedValidation())])
    renderPanel()
    const section = screen.getByTestId(SECTION)
    expect(section.classList.contains('border-t')).toBe(true)
    expect(section.classList.contains('border-b')).toBe(false)
    const panel = screen.getByTestId('pre-analysis-v3')
    const borderB = [...panel.querySelectorAll('*')].filter(el => el.classList.contains('border-b'))
    expect(borderB).toHaveLength(1)
  })
})
