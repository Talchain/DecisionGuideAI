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
 * WHAT IT DELIBERATELY DOES NOT CLAIM. This proves the links compose, in-process.
 * It is NOT a journey witness: nothing here renders the deployed surface, drives
 * a browser, or touches the wire. The rung this evidence reaches is TESTED, and
 * the deploy/journey rungs are named in the lane report as still owed.
 */
import { describe, it, expect } from 'vitest'
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
    weightSource: 'cee',
    provenanceDisplay: 'ai_inferred',
    origin: 'ai',
  },
})

const fragileEdges = [
  { from_id: 'n_demand', to_id: 'n_rev', switch_probability: ABOVE, alternative_winner_label: 'Consolidate' },
]

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

  it('HONESTY — confirming the placeholder AS-IS is not an analytical change, so no rerun is promised', () => {
    // The interaction must not promise a consequence it cannot deliver. If the
    // user looks at the placeholder and decides 0.5 was right all along, the
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
