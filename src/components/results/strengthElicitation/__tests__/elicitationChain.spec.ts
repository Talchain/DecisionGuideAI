/**
 * THE CHAIN, COMPOSED — elicitation → edit → stale → rerun-offered → loop closed.
 *
 * The acceptance for this slice is the WHOLE loop, not the card. A card that
 * names an assumption is a rung; the capability is only real if the named
 * assumption can be resolved through the authority that already owns edge
 * strength, and that edit actually reaches the staleness machinery that offers
 * the rerun.
 *
 * WHY THIS TEST USES THE REAL MODULES AND NO MOCKS. Every link here is a
 * DIFFERENT module owned by a different part of the tree, and each one is
 * individually correct today — that is precisely the configuration in which a
 * chain silently fails to compose. Mocking any link would assert my model of it
 * rather than it. So this walks the real selector, the real declared setter
 * manifest, the real analytical-change registry and the real freshness reducer.
 *
 * WHAT THE MOUNTED CONTROL ADDS. The final discriminator renders the real card
 * and inspector, drives the card CTA and preset, and observes the real store and
 * rerun control. It is still not a deployed journey or wire witness; those rungs
 * remain separate from this in-process mounted proof.
 */
import { createElement } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { afterEach, describe, it, expect, vi } from 'vitest'
import {
  selectAssumedStrengthToResolve,
  type ElicitationCanvasEdge,
} from '../selectAssumedStrengthToResolve'
import { EDGE_SETTER_FIELDS } from '../../../../canvas/ui/inspector-v2/useInspectorMutations'
import { hasAnalyticalEdgeChange } from '../../../../canvas/domain/analyticalChange'
import type { Edge } from '@xyflow/react'
import { resolveDisplayedFreshness, classifyFreshnessForDisplay } from '../../../../canvas/store/analysisFreshness'
import { DEFAULT_EDGE_DATA } from '../../../../canvas/domain/edges'
import { THRESHOLDS } from '../../../../lib/mappers/constants'
import { edgeValueSource } from '../../../../canvas/domain/edgeValueProvenance'
import { AssumedStrengthCard } from '../AssumedStrengthCard'
import { openEdgeStrengthEditor } from '../../../../canvas/utils/openEdgeStrengthEditor'
import { useCanvasStore } from '../../../../canvas/store'
import { InspectorModal } from '../../../../canvas/components/InspectorModal'
import { buildV2RequestFromAnalysisReady } from '../../../../adapters/plot/v2/adapter'
import type { CEEAnalysisReady } from '../../../../adapters/cee/types'
import { projectAutosaveData } from '../../../../canvas/store/autosaveProjection'
import { clearAutosave, loadAutosave, saveAutosave } from '../../../../canvas/store/scenarios'

vi.mock('../../../../canvas/utils/focusHelpers', async () => {
  const actual = await vi.importActual<typeof import('../../../../canvas/utils/focusHelpers')>(
    '../../../../canvas/utils/focusHelpers',
  )
  return { ...actual, focusEdgeById: vi.fn() }
})

const nodeLabels = new Map([
  ['n_demand', 'Customer demand'],
  ['n_rev', 'Revenue growth'],
])

const ABOVE = THRESHOLDS.FRAGILE_EDGE_FILTER + 0.2

/** An ordinary CEE draft: numeric strength, but explicitly AI-inferred. */
const draftedEdge = (): ElicitationCanvasEdge => ({
  id: 'e_demand_rev',
  source: 'n_demand',
  target: 'n_rev',
  data: {
    ...DEFAULT_EDGE_DATA,
    weight: 0.52,
    weightSource: 'cee',
    direction: 'negative',
    directionSource: 'cee',
    provenanceDisplay: 'ai_inferred',
    origin: 'ai',
  },
})

const fragileEdges = [
  { from_id: 'n_demand', to_id: 'n_rev', switch_probability: ABOVE, alternative_winner_label: 'Consolidate' },
]

const validAnalysisReady = {
  status: 'ready',
  goal_node_id: 'n_rev',
  suggested_seed: '71152',
  options: [{
    id: 'opt-control',
    label: 'Control',
    status: 'ready',
    interventions: {
      n_demand: { value: 0.6, source: 'user_specified' },
    },
  }],
} satisfies CEEAnalysisReady

afterEach(() => {
  clearAutosave()
})

describe('P4 chain: elicitation → resolve → stale → rerun → loop closed', () => {
  it('LINK 1 — elicitation names the assumed relationship, by edge identity', () => {
    const d = selectAssumedStrengthToResolve({
      fragileEdges,
      edges: [draftedEdge()],
      nodeLabels,
    })
    expect(d.selected?.edgeId).toBe('e_demand_rev')
  })

  it('LINK 2 — the resolve route writes the fields the elicitation depends on', () => {
    // Bound to the setter's OWN DECLARED MANIFEST, not to a hand-copied list.
    // If `setStrength` ever stops stamping provenance, this REDs here rather
    // than the elicitation silently re-asking for a value the user just set.
    expect(EDGE_SETTER_FIELDS.setStrength).toContain('weight')
    expect(EDGE_SETTER_FIELDS.setStrength).toContain('weightSource')
  })

  it('LINK 3 — that edit is an ANALYTICAL change, so it reaches the staleness machinery', () => {
    // `updateEdge` calls exactly this predicate to decide whether to invalidate
    // analysis readiness. If `weight` ever left the stale registry, the edit
    // would land and the analysis would keep claiming to be fresh.
    const before = draftedEdge() as unknown as Edge
    const patch = {
      data: { ...draftedEdge().data, weight: 0.85, weightSource: 'user' as const },
    }
    expect(hasAnalyticalEdgeChange(before, patch)).toBe(true)
  })

  it('LINK 4 — a dirty graph downgrades a FRESH analysis, which is what offers the rerun', () => {
    const fresh = { freshness: 'fresh' as const, reason: null, lastVerdictAt: null }
    expect(resolveDisplayedFreshness(fresh, false)).toBe('fresh')
    // The overlay may only DOWNGRADE. It never fabricates 'stale' — that stays
    // a producer verdict — but 'unknown' is enough to offer the rerun.
    expect(resolveDisplayedFreshness(fresh, true)).toBe('unknown')
    // 'changed' is the semantic the rerun controls gate on ("Model changed.
    // Results may be out of date."). Derived from the reducer, not assumed: the
    // first draft of this test asserted 'cannot_confirm' and was wrong —
    // cannot-confirm is reserved for the IMPORT HOLD, where the dirty overlay
    // is held by a mitigation rather than by a user edit, and asserting
    // "changed" there would be factually false about a current analysis.
    expect(classifyFreshnessForDisplay(fresh, true, false)).toBe('changed')
    expect(classifyFreshnessForDisplay(fresh, false, false)).toBe('current')
    // The contrast that proves the two are genuinely different states, so this
    // test cannot pass by the classifier having collapsed them.
    expect(classifyFreshnessForDisplay(fresh, true, true)).toBe('cannot_confirm')
  })

  it('LINK 5 — after the user sets it, the elicitation STOPS naming it (the loop closes)', () => {
    // The same graph, with the one edit the interaction asked for applied.
    const resolved: ElicitationCanvasEdge = {
      ...draftedEdge(),
      data: { ...draftedEdge().data, weight: 0.85, weightSource: 'user' },
    }
    expect(edgeValueSource(resolved.data, 'weight')).toBe('user')

    const after = selectAssumedStrengthToResolve({ fragileEdges, edges: [resolved], nodeLabels })
    expect(after.selected).toBeNull()
    expect(after.refusalReason).toBe('all_strengths_set')
  })

  it('COMPOSED — one pass through the whole loop, each link fed by the previous one', () => {
    // 1. elicit
    const edges = [draftedEdge()]
    const elicited = selectAssumedStrengthToResolve({ fragileEdges, edges, nodeLabels })
    expect(elicited.selected).not.toBeNull()
    const targetId = elicited.selected!.edgeId

    // 2. the user resolves THE EDGE THE ELICITATION NAMED — not an arbitrary one.
    const before = edges.find(e => e.id === targetId)!
    const patch = { data: { ...before.data, weight: 0.85, weightSource: 'user' as const } }

    // 3. the edit is analytical ⇒ the store marks the analysis dirty
    const dirty = hasAnalyticalEdgeChange(before as unknown as Edge, patch)
    expect(dirty).toBe(true)

    // 4. dirty ⇒ the surface can no longer confirm freshness ⇒ rerun is offered
    const fresh = { freshness: 'fresh' as const, reason: null, lastVerdictAt: null }
    expect(classifyFreshnessForDisplay(fresh, dirty, false)).toBe('changed')

    // 5. and the model has genuinely changed: the assumption is now the user's
    const nextEdges = [{ ...before, data: patch.data }]
    const after = selectAssumedStrengthToResolve({ fragileEdges, edges: nextEdges, nodeLabels })
    expect(after.selected).toBeNull()
    expect(after.refusalReason).toBe('all_strengths_set')
  })

  it('MOUNTED — CTA → editor → canonical write → stale → real rerun control', () => {
    const edges = [draftedEdge()]
    const decision = selectAssumedStrengthToResolve({ fragileEdges, edges, nodeLabels })
    expect(decision.selected?.edgeId).toBe('e_demand_rev')

    useCanvasStore.setState({
      nodes: [
        { id: 'n_demand', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Customer demand' } },
        { id: 'n_rev', type: 'outcome', position: { x: 200, y: 0 }, data: { label: 'Revenue growth' } },
      ] as never,
      edges: edges as never,
      showResultsPanel: true,
      analysisFreshness: { freshness: 'fresh' },
      analysisFreshnessDirty: false,
      selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null } as never,
    })

    // ⚠ THE PRODUCT NO LONGER WIRES THIS CARD TO THIS HANDLER. The panel now routes
    // the act to the Ask-Olumi drawer, because the Inspector cannot save an edge
    // strength (EDGE_SETTER_AUTHORITY: every setter 'disabled'). The adapter below
    // keeps this spec exercising `openEdgeStrengthEditor` itself — which retains
    // other callers (`ConnRow`, `NodeQuickActions`) — rather than deleting
    // coverage of a helper that is still live elsewhere.
    render(createElement(AssumedStrengthCard, {
      decision,
      onResolve: sel => openEdgeStrengthEditor(sel.edgeId),
    }))
    fireEvent.click(screen.getByTestId('assumed-strength-action'))

    const routed = useCanvasStore.getState()
    expect([...routed.selection.edgeIds]).toEqual(['e_demand_rev'])
    expect(routed.showResultsPanel).toBe(false)

    render(createElement(
      ReactFlowProvider,
      null,
      createElement(InspectorModal, { nodeId: null, edgeId: 'e_demand_rev', onClose: () => {} }),
    ))
    expect(screen.queryByRole('button', { name: 'Re-run the analysis' })).toBeNull()

    fireEvent.click(screen.getByTestId('strength-band-very-strong'))

    const edited = useCanvasStore.getState()
    const data = edited.edges.find(edge => edge.id === 'e_demand_rev')?.data as Record<string, unknown>
    expect(data.weight).toBe(0.85)
    expect(data.weightSource).toBe('user')
    // A preset is a magnitude choice. The existing negative causal direction
    // and its producer provenance survive because the user did not choose sign.
    expect(data.direction).toBe('negative')
    expect(data.directionSource).toBe('cee')
    // Editing the field does not rewrite the edge's creation/display provenance.
    expect(data.provenanceDisplay).toBe('ai_inferred')
    expect(data.origin).toBe('ai')
    expect(edited.analysisFreshnessDirty).toBe(true)
    expect(screen.getByRole('button', { name: 'Re-run the analysis' })).toBeInTheDocument()
    expect(screen.getByText('Re-run to see how this affects the results')).toBeInTheDocument()

    // The real canonical request builder consumes the changed store value on a
    // contract-valid readiness premise (`options[].id`, persisted goal id).
    const { request } = buildV2RequestFromAnalysisReady(
      edited.nodes as never,
      edited.edges as never,
      validAnalysisReady,
    )
    expect(request.graph.edges).toHaveLength(1)
    expect(request.graph.edges[0].strength.mean).toBe(-0.85)
  })

  it('MOUNTED — confirm-current uses the exact live estimate, preserves direction, persists, and does not false-stale', () => {
    const first = draftedEdge()
    const second: ElicitationCanvasEdge = {
      id: 'e_cost_rev',
      source: 'n_cost',
      target: 'n_rev',
      data: {
        ...DEFAULT_EDGE_DATA,
        weight: 0.34,
        weightSource: 'cee',
        direction: 'positive',
        directionSource: 'cee',
        provenanceDisplay: 'ai_inferred',
        origin: 'ai',
      },
    }
    const ranked = [
      ...fragileEdges,
      { from_id: 'n_cost', to_id: 'n_rev', switch_probability: ABOVE - 0.05 },
    ]
    const labels = new Map([...nodeLabels, ['n_cost', 'Delivery cost']])
    const decision = selectAssumedStrengthToResolve({
      fragileEdges: ranked,
      edges: [first, second],
      nodeLabels: labels,
    })
    expect(decision.selected?.edgeId).toBe(first.id)

    useCanvasStore.setState({
      currentScenarioId: '11111111-2222-4333-8444-555555555555',
      nodes: [
        { id: 'n_demand', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Customer demand' } },
        { id: 'n_cost', type: 'factor', position: { x: 0, y: 120 }, data: { label: 'Delivery cost' } },
        { id: 'n_rev', type: 'outcome', position: { x: 200, y: 0 }, data: { label: 'Revenue growth' } },
      ] as never,
      edges: [first, second] as never,
      showResultsPanel: true,
      analysisFreshness: { freshness: 'fresh' },
      analysisFreshnessDirty: false,
      history: { past: [], future: [] },
      selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null } as never,
    })

    // ⚠ THE PRODUCT NO LONGER WIRES THIS CARD TO THIS HANDLER. The panel now routes
    // the act to the Ask-Olumi drawer, because the Inspector cannot save an edge
    // strength (EDGE_SETTER_AUTHORITY: every setter 'disabled'). The adapter below
    // keeps this spec exercising `openEdgeStrengthEditor` itself — which retains
    // other callers (`ConnRow`, `NodeQuickActions`) — rather than deleting
    // coverage of a helper that is still live elsewhere.
    render(createElement(AssumedStrengthCard, {
      decision,
      onResolve: sel => openEdgeStrengthEditor(sel.edgeId),
    }))
    fireEvent.click(screen.getByTestId('assumed-strength-action'))
    render(createElement(
      ReactFlowProvider,
      null,
      createElement(InspectorModal, { nodeId: null, edgeId: first.id, onClose: () => {} }),
    ))

    expect(screen.getByText(/Olumi’s current estimate is/)).toHaveTextContent('0.52')
    expect(screen.queryByRole('button', { name: 'Re-run the analysis' })).toBeNull()

    // Server/store refresh after mount: the click must confirm 0.6147, not the
    // value captured on first render, a rounded display value, or the active
    // band's 0.55 midpoint.
    act(() => {
      const refreshedEdges = useCanvasStore.getState().edges.map((edge) => edge.id === first.id
        ? { ...edge, data: { ...edge.data, weight: 0.6147 } }
        : edge)
      // This is a controlled server/store refresh, not a user edit; bypass the
      // canonical mutation path deliberately so the test can prove the action
      // reads the live value rather than the first-render closure.
      useCanvasStore.setState({ edges: refreshedEdges } as never)
    })
    expect(screen.getByText(/Olumi’s current estimate is/)).toHaveTextContent('0.6147')
    fireEvent.click(screen.getByRole('button', { name: 'Confirm this estimate' }))

    const confirmed = useCanvasStore.getState()
    const data = confirmed.edges.find((edge) => edge.id === first.id)?.data as Record<string, unknown>
    expect(data.weight).toBe(0.6147)
    expect(data.weight).not.toBe(0.55)
    expect(data.weightSource).toBe('user')
    expect(data.direction).toBe('negative')
    expect(data.directionSource).toBe('cee')
    expect(data.provenanceDisplay).toBe('ai_inferred')
    expect(data.origin).toBe('ai')
    expect(confirmed.analysisFreshnessDirty).toBe(false)
    expect(screen.getByText('Updated')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Confirm this estimate' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Re-run the analysis' })).toBeNull()

    const next = selectAssumedStrengthToResolve({
      fragileEdges: ranked,
      edges: confirmed.edges as ElicitationCanvasEdge[],
      nodeLabels: labels,
    })
    expect(next.selected?.edgeId).toBe(second.id)

    saveAutosave(projectAutosaveData({
      nodes: confirmed.nodes,
      edges: confirmed.edges,
      scenarioId: confirmed.currentScenarioId,
      ceeAnalysisReady: validAnalysisReady,
      selectedGoalNode: 'n_rev',
      analysis: null,
      goalConstraints: null,
    }, 123))
    const restored = loadAutosave()
    const restoredData = restored?.edges.find((edge) => edge.id === first.id)?.data as Record<string, unknown>
    expect(restoredData.weight).toBe(0.6147)
    expect(restoredData.weightSource).toBe('user')
    expect(restoredData.direction).toBe('negative')
    expect(restoredData.directionSource).toBe('cee')
  })

  it('MUTANT CONTROL — a hidden default has no confirm-as-estimate action', () => {
    const data = { ...DEFAULT_EDGE_DATA } as Record<string, unknown>
    const edge: ElicitationCanvasEdge = {
      id: 'e_demand_rev',
      source: 'n_demand',
      target: 'n_rev',
      data,
    }
    useCanvasStore.setState({
      nodes: [
        { id: 'n_demand', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Customer demand' } },
        { id: 'n_rev', type: 'outcome', position: { x: 200, y: 0 }, data: { label: 'Revenue growth' } },
      ] as never,
      edges: [edge] as never,
      analysisFreshness: { freshness: 'fresh' },
      analysisFreshnessDirty: false,
    })
    render(createElement(
      ReactFlowProvider,
      null,
      createElement(InspectorModal, { nodeId: null, edgeId: edge.id, onClose: () => {} }),
    ))
    expect(screen.queryByRole('button', { name: 'Confirm this estimate' })).toBeNull()
    expect(screen.queryByText(/Olumi’s current estimate is/)).toBeNull()
  })

  it('HONESTY — confirming an AI estimate AS-IS is not an analytical change, so no rerun is promised', () => {
    // The interaction must not promise a consequence it cannot deliver. If the
    // user looks at the estimate and decides 0.52 was right all along, the
    // MODEL is more trustworthy (the value is now theirs) but the NUMBERS are
    // identical — so a rerun would show nothing, and the staleness machinery
    // correctly declines to claim otherwise. `weightSource` is deliberately NOT
    // in the analytical registry, and this pins that as intended behaviour
    // rather than an oversight.
    const before = draftedEdge() as unknown as Edge
    const confirmedAsIs = {
      data: { ...draftedEdge().data, weightSource: 'user' as const },
    }
    expect(hasAnalyticalEdgeChange(before, confirmedAsIs)).toBe(false)

    // But the elicitation still stops asking — the assumption HAS been resolved.
    const after = selectAssumedStrengthToResolve({
      fragileEdges,
      edges: [{ ...draftedEdge(), data: confirmedAsIs.data }],
      nodeLabels,
    })
    expect(after.selected).toBeNull()
    expect(after.refusalReason).toBe('all_strengths_set')
  })
})
