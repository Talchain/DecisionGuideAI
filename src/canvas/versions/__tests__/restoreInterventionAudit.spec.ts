/**
 * restoreInterventionAudit — the post-condition that earns the success claim.
 *
 * The load-bearing pin here is the AUTHORITY one: the audit reads
 * `graph.nodes[].interventions` and must be BLIND to
 * `graph.analysis_ready.options[].interventions`. Both ship in a real restore
 * receipt and they disagree on real traffic (measured: node-root
 * `0.3 user_specified` vs embedded analysis_ready `0.7 cee_hypothesis` for the
 * same option in `shared-return-response185.json`). An audit that consulted the
 * embedded copy would certify a canvas showing 0.7 as correctly restored — the
 * exact defect, wearing the fix's clothes.
 */

import { describe, it, expect } from 'vitest'
import { findRestoredInterventionMismatches } from '../restoreInterventionAudit'

const PILOT = '70180763'
const BASELINE = '4bba0554'
const FACTOR = '0d2a1d17'

function wireOption(id: string, entry: unknown, target = FACTOR) {
  return { id, kind: 'option', label: id, interventions: { [target]: entry } }
}
function canvasOption(id: string, entry: unknown, target = FACTOR) {
  return { id, data: { type: 'option', interventions: { [target]: entry } } }
}
const rich = (value: number, source = 'cee_hypothesis') => ({ value, source, raw_value: value })

describe('findRestoredInterventionMismatches', () => {
  it('is silent when the canvas carries the restored values (bare number vs rich object are the same number)', () => {
    const graph = { nodes: [wireOption(PILOT, rich(0.7)), wireOption(BASELINE, 0.4)] }
    const live = [canvasOption(PILOT, 0.7), canvasOption(BASELINE, rich(0.4))]
    expect(findRestoredInterventionMismatches(graph, live)).toEqual([])
  })

  it('reports the option that did not take its restored value, bound by id', () => {
    const graph = { nodes: [wireOption(PILOT, rich(0.7)), wireOption(BASELINE, 0.4)] }
    // BASELINE is correct; only PILOT reverted.
    const live = [canvasOption(PILOT, 0.2), canvasOption(BASELINE, 0.4)]
    const out = findRestoredInterventionMismatches(graph, live)
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({
      optionId: PILOT,
      targetNodeId: FACTOR,
      restored: 0.7,
      onCanvas: 0.2,
      missingFromCanvas: false,
    })
  })

  /**
   * IDENTITY BINDING (trap 19). Two options carry the SAME value, so a check
   * that matched on value alone would be satisfied by the wrong node. Here the
   * restored values are swapped between the two options: every number the
   * restore asked for is present on the canvas, just on the wrong option.
   * A value-predicate check sees nothing; an id-bound check sees two faults.
   */
  it('binds by node id — swapped values between two options are TWO mismatches, not zero', () => {
    const graph = { nodes: [wireOption(PILOT, 0.7), wireOption(BASELINE, 0.4)] }
    const live = [canvasOption(PILOT, 0.4), canvasOption(BASELINE, 0.7)]
    const out = findRestoredInterventionMismatches(graph, live)
    expect(out).toHaveLength(2)
    expect(out.map((m) => m.optionId).sort()).toEqual([BASELINE, PILOT].sort())
  })

  it('binds by intervention TARGET id — the right option with the number under the wrong factor is a mismatch', () => {
    const graph = { nodes: [wireOption(PILOT, 0.7, FACTOR)] }
    const live = [canvasOption(PILOT, 0.7, 'some-other-factor')]
    const out = findRestoredInterventionMismatches(graph, live)
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ optionId: PILOT, targetNodeId: FACTOR, onCanvas: undefined })
  })

  it('reports an option the restore states but the canvas does not carry at all', () => {
    const graph = { nodes: [wireOption(PILOT, 0.7)] }
    const out = findRestoredInterventionMismatches(graph, [])
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ optionId: PILOT, missingFromCanvas: true, onCanvas: undefined })
  })

  /**
   * ⭐ THE AUTHORITY PIN. The embedded `analysis_ready` states 0.7 while the
   * nodes state 0.3 — the real disagreement measured on staging. The canvas
   * correctly shows 0.3. The audit must report NOTHING; if it ever consults the
   * embedded copy this goes RED, which is the only thing standing between the
   * fix and a re-run of the original defect from a new source.
   */
  it('reads the NODES, never the embedded analysis_ready, when the two disagree', () => {
    const graph = {
      nodes: [wireOption(PILOT, rich(0.3, 'user_specified'))],
      analysis_ready: {
        status: 'ready',
        options: [{ id: PILOT, interventions: { [FACTOR]: rich(0.7) } }],
      },
    }
    const live = [canvasOption(PILOT, rich(0.3, 'user_specified'))]
    expect(findRestoredInterventionMismatches(graph, live)).toEqual([])
  })

  it('the same disagreement the other way round: canvas matching analysis_ready instead of the nodes IS a mismatch', () => {
    const graph = {
      nodes: [wireOption(PILOT, rich(0.3, 'user_specified'))],
      analysis_ready: { options: [{ id: PILOT, interventions: { [FACTOR]: rich(0.7) } }] },
    }
    const live = [canvasOption(PILOT, rich(0.7))]
    const out = findRestoredInterventionMismatches(graph, live)
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ restored: 0.3, onCanvas: 0.7 })
  })

  it('a stated 0 is a real value, not absence — a canvas showing 0.2 against a restored 0 is a mismatch', () => {
    const graph = { nodes: [wireOption(PILOT, 0)] }
    const out = findRestoredInterventionMismatches(graph, [canvasOption(PILOT, 0.2)])
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ restored: 0, onCanvas: 0.2 })
  })

  it('a restored entry stating NO usable number is not a mismatch — absence is never a zero to invent', () => {
    const graph = { nodes: [wireOption(PILOT, { value: null })] }
    expect(findRestoredInterventionMismatches(graph, [canvasOption(PILOT, 0.2)])).toEqual([])
  })

  it('ignores non-option nodes and tolerates junk shapes without throwing', () => {
    const graph = {
      nodes: [
        { id: 'f1', kind: 'factor', interventions: { [FACTOR]: 0.9 } },
        null,
        { kind: 'option', interventions: { [FACTOR]: 0.9 } },
        wireOption(PILOT, 0.7),
      ],
    }
    const out = findRestoredInterventionMismatches(graph, [canvasOption(PILOT, 0.7), null])
    expect(out).toEqual([])
  })

  it('returns nothing for a graph with no usable nodes array', () => {
    expect(findRestoredInterventionMismatches(null, [])).toEqual([])
    expect(findRestoredInterventionMismatches({ nodes: 'nope' }, [])).toEqual([])
  })
})
