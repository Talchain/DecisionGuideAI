/**
 * An applied option-target edit must not strip intervention provenance, on the
 * canvas or in CEE.
 *
 * WITNESSED ON SERVED STAGING, 23 Sep 2026 (UI `8f79c9e1`, CEE `29ffda8a`,
 * guest pricing example `d383e417…`; `output/canvas-completion-20260923/LOG.md`
 * § M1):
 *   1. `option_intervention_edit` → 200. The receipt's `draft_graph` carried
 *      `{value: 0.6, source: 'user_specified', target_match: {…}}`.
 *   2. `reconcileAppliedGraph` overlaid that object, then called
 *      `backfillInterventionsOntoOptionNodes` with the SAME turn's
 *      `analysis_ready`, whose interventions are BARE numbers. The backfill
 *      replaced every option's whole map with them.
 *   3. 9 ms later the post-settle `graph/register` sent that stripped canvas
 *      to CEE. The reread showed all four options' interventions as bare
 *      numbers: `source`, `display_value` and `target_match` were gone
 *      model-wide. The next edit was refused as stale.
 *
 * The invariant (`src/types/options.ts`): an explicit user fact is PRESERVED;
 * a bare number carries no provenance. So a bare number that agrees with the
 * value the canvas already holds adds nothing, and must not replace the object
 * that says who set it. Where the producer's value DIFFERS, the producer wins
 * (a bare number, no provenance invented). Membership stays the producer's.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useCanvasStore } from '../../store'
import { backfillInterventionsOntoOptionNodes } from '../applyDraftResult'
import { reconcileAppliedGraph } from '../mergeAppliedGraph'
import { buildRegistrationGraph } from '../../registration/buildRegistrationGraph'
import { seedCanvas } from './__helpers__/mergeAppliedGraphHarness'

const USER_SET = {
  value: 0.6,
  source: 'user_specified',
  target_match: { node_id: 'fac_usage', confidence: 'high', match_type: 'exact_id' },
}
const FROM_BRIEF = { value: 0.4, source: 'brief_extraction', display_value: 'Moderate (0.4)' }

function optionNode(interventions: Record<string, unknown>) {
  return {
    id: 'opt_hybrid',
    type: 'option',
    position: { x: 0, y: 0 },
    data: { kind: 'option', label: 'Hybrid', interventions, is_baseline: false },
  }
}

const FACTORS = ['fac_usage', 'fac_friction'].map((id, i) => ({
  id,
  type: 'factor',
  position: { x: 300, y: 100 * i },
  data: { kind: 'factor', label: id },
}))

function interventionsOnCanvas(): Record<string, unknown> {
  const n = useCanvasStore.getState().nodes.find((x) => x.id === 'opt_hybrid') as any
  return n?.data?.interventions
}

function readyWith(interventions: Record<string, unknown>) {
  return { options: [{ id: 'opt_hybrid', interventions, is_baseline: false }] }
}

beforeEach(() => {
  seedCanvas([optionNode({ fac_usage: USER_SET, fac_friction: FROM_BRIEF }), ...FACTORS], [])
})

describe('backfillInterventionsOntoOptionNodes — a bare number never erases who set a value', () => {
  it('keeps each existing object when analysis_ready repeats its value as a bare number', () => {
    backfillInterventionsOntoOptionNodes(readyWith({ fac_usage: 0.6, fac_friction: 0.4 }))
    expect(interventionsOnCanvas()).toEqual({ fac_usage: USER_SET, fac_friction: FROM_BRIEF })
  })

  it('replaces only the entry whose value the producer changed; the agreeing entry keeps its object', () => {
    backfillInterventionsOntoOptionNodes(readyWith({ fac_usage: 0.7, fac_friction: 0.4 }))
    expect(interventionsOnCanvas()).toEqual({ fac_usage: 0.7, fac_friction: FROM_BRIEF })
  })

  it('a key analysis_ready drops is dropped, and the key it keeps keeps its object', () => {
    backfillInterventionsOntoOptionNodes(readyWith({ fac_usage: 0.6 }))
    expect(interventionsOnCanvas()).toEqual({ fac_usage: USER_SET })
  })

  // ── Controls: behaviour this change must NOT move. Each passes at base too. ──

  it('CONTROL: every value changed → the producer map verbatim (bare, no invented provenance)', () => {
    backfillInterventionsOntoOptionNodes(readyWith({ fac_usage: 0.7, fac_friction: 0.5 }))
    expect(interventionsOnCanvas()).toEqual({ fac_usage: 0.7, fac_friction: 0.5 })
  })

  it('CONTROL: producer OBJECTS win, because they carry their own provenance', () => {
    const a = { value: 0.6, source: 'brief_extraction' }
    const b = { value: 0.4, source: 'cee_inference' }
    backfillInterventionsOntoOptionNodes(readyWith({ fac_usage: a, fac_friction: b }))
    expect(interventionsOnCanvas()).toEqual({ fac_usage: a, fac_friction: b })
  })

  it('CONTROL: membership is the producer\'s — a dropped key goes, a changed one is bare', () => {
    backfillInterventionsOntoOptionNodes(readyWith({ fac_usage: 0.7 }))
    expect(interventionsOnCanvas()).toEqual({ fac_usage: 0.7 })
  })

  it('CONTROL: a first write onto an option with no map takes the producer map verbatim', () => {
    seedCanvas([optionNode(undefined as never), ...FACTORS], [])
    backfillInterventionsOntoOptionNodes(readyWith({ fac_usage: 0.6, fac_friction: 0.4 }))
    expect(interventionsOnCanvas()).toEqual({ fac_usage: 0.6, fac_friction: 0.4 })
  })
})

describe('the served chain: applied receipt → reconcile → registration projection', () => {
  it('the applied edit\'s user provenance reaches the registration payload, not a bare number', () => {
    // Before the edit: the option holds brief-derived objects.
    seedCanvas(
      [optionNode({ fac_usage: { value: 0.5, source: 'brief_extraction', display_value: 'Moderate (0.5)' }, fac_friction: FROM_BRIEF }), ...FACTORS],
      [],
    )
    // applyV5State writes the SAME turn's analysis_ready BEFORE the reconcile
    // (mergeAppliedGraph.ts, the backfill call's own comment). On the wire it
    // carried bare numbers.
    useCanvasStore.setState({
      ceeAnalysisReady: readyWith({ fac_usage: 0.6, fac_friction: 0.4 }) as never,
    } as never)

    reconcileAppliedGraph({
      nodes: [
        { id: 'opt_hybrid', kind: 'option', label: 'Hybrid', interventions: { fac_usage: USER_SET, fac_friction: FROM_BRIEF } },
        { id: 'fac_usage', kind: 'factor', label: 'fac_usage' },
        { id: 'fac_friction', kind: 'factor', label: 'fac_friction' },
      ],
      edges: [],
    } as any)

    expect(interventionsOnCanvas()).toEqual({ fac_usage: USER_SET, fac_friction: FROM_BRIEF })

    const { nodes, edges } = useCanvasStore.getState()
    const projected = buildRegistrationGraph(nodes as any, edges as any)
    expect(projected.ok).toBe(true)
    const wireOption = (projected as any).graph.nodes.find((n: any) => n.id === 'opt_hybrid')
    expect(wireOption.interventions.fac_usage).toEqual(USER_SET)
    expect(wireOption.interventions.fac_friction).toEqual(FROM_BRIEF)
  })
})
