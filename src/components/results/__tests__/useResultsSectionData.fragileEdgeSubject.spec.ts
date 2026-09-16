/**
 * useResultsSectionData — THE SHORT SENTENCE IS OFFERED ONLY WHERE DROPPING THE
 * SUBJECT IS A DE-DUPLICATION AND NEVER WHERE IT IS A REWORDING.
 *
 * ## ⚠ WHY THIS FILE EXISTS SEPARATELY FROM `theRowNamesItsRelationship.spec.ts`
 *
 * That file pins the BUILDER: given a row carrying `messageWithSubjectNamedAbove`,
 * does the titled row render it and the untitled row refuse it? Correct, and it
 * proves nothing about whether the field arrives on the right rows — its corpus
 * constructs `UncertaintyItem`s by hand and never runs this hook.
 *
 * ⛔ MEASURED, NOT ASSUMED. Two mutants of the hook's precondition — offering the
 * short form on a producer-authored `description`, and offering it when
 * `fe.label` makes the body's subject differ from the row's title — BOTH SURVIVED
 * the builder corpus with 9/9 green. A guard whose corpus bypasses the code under
 * test agrees with itself (trap 13b). This file drives the REAL hook so those two
 * mutants have something to bite.
 *
 * ## The rule
 *
 * The panel titles a fragile-edge row with `from_label → to_label`. A titled row
 * whose body quotes that same name back pays for the title twice — MEASURED on
 * deployed `521189fe` at the real 277px body width: the three-row section goes
 * 382px → 498px (+30%) with the title alone, and 382px → 401px (+5%) once the
 * body stops repeating the name.
 *
 * So the hook composes both forms from ONE template and offers the short one only
 * when all three hold:
 *   · the UI composed the sentence (`!fe.description`) — someone else's prose is
 *     theirs, and 'The relationship "X" is fragile…' would come out ungrammatical;
 *   · `!fe.label`, so the body's quoted subject IS the row's title;
 *   · the internal-token sanitiser did not fire, or there is no edge name in the
 *     displayed text to drop.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useResultsSectionData } from '../useResultsSectionData'
import { useCanvasStore } from '../../../canvas/store'
import type { UncertaintyItem } from '../types'

const OPTION_NODES = [
  { id: 'opt_a', type: 'option', position: { x: 0, y: 0 }, data: { kind: 'option', label: 'Hold Price' } },
  { id: 'opt_b', type: 'option', position: { x: 0, y: 0 }, data: { kind: 'option', label: 'Raise Price' } },
]

function setReportWithFragileEdges(fragileEdges: unknown[]): void {
  useCanvasStore.setState({
    results: {
      status: 'complete',
      progress: 100,
      report: {
        flip_thresholds: [],
        robustness: { fragile_edges: fragileEdges, robust_edges: [] },
      },
    } as any,
    runMeta: {} as any,
    nodes: OPTION_NODES as any,
    edges: [],
    hasCompletedFirstRun: true,
    rawV2Response: null,
  } as any)
}

const sensitiveRows = (): UncertaintyItem[] => {
  const { result } = renderHook(() => useResultsSectionData())
  return (result.current.confidence?.uncertainties ?? []).filter(
    (u) => u.code === 'SENSITIVE_ASSUMPTION',
  )
}

/** The declared shape: ten fields, and these are the ones that matter here. */
const BASE_EDGE = {
  edge_id: 'e-1',
  from_id: 'fac_price',
  from_label: 'Pro Plan Monthly Price',
  to_id: 'fac_mrr',
  to_label: 'Monthly Recurring Revenue',
  switch_probability: 0.73,
  severity: 'warning',
  alternative_winner_id: 'opt_a',
  alternative_winner_label: 'Hold Price',
}

beforeEach(() => {
  useCanvasStore.setState({ results: { status: 'idle', report: null } } as any)
})

describe('useResultsSectionData — the fragile-edge sentence and its subject', () => {
  it('control: the ordinary emission publishes a row AND both sentence forms', () => {
    setReportWithFragileEdges([BASE_EDGE])
    const rows = sensitiveRows()

    expect(rows).toHaveLength(1)
    // The long form, with the subject quoted inside it.
    expect(rows[0].displayText).toBe(
      'If "Pro Plan Monthly Price → Monthly Recurring Revenue" changes significantly, "Hold Price" could become the better choice',
    )
    // The short form, for a consumer that has the subject on screen already.
    expect(rows[0].messageWithSubjectNamedAbove).toBe(
      'If this changes significantly, "Hold Price" could become the better choice',
    )
    // ⛔ ONE TEMPLATE. Everything after the subject is byte-identical, so the
    // two cannot drift into saying different things about the same edge.
    const tail = 'changes significantly, "Hold Price" could become the better choice'
    expect(rows[0].displayText?.endsWith(tail)).toBe(true)
    expect(rows[0].messageWithSubjectNamedAbove?.endsWith(tail)).toBe(true)
  })

  it('⛔ a PRODUCER-AUTHORED description gets no short form — substituting into it would be a rewording', () => {
    setReportWithFragileEdges([
      {
        ...BASE_EDGE,
        description:
          'The relationship "Pro Plan Monthly Price → Monthly Recurring Revenue" is fragile because the elasticity estimate is thin.',
      },
    ])
    const rows = sensitiveRows()

    expect(rows).toHaveLength(1)
    // The producer's sentence survives verbatim...
    expect(rows[0].displayText).toContain('is fragile because the elasticity estimate is thin')
    // ...and nothing offers to shorten it. Absent, not empty-string.
    expect(rows[0].messageWithSubjectNamedAbove).toBeUndefined()
  })

  it('⛔ an `fe.label` makes the body’s subject differ from the row’s title, so no short form', () => {
    // The row would be titled `Pro Plan Monthly Price → Monthly Recurring Revenue`
    // from the declared ends, while the body quotes this label. Dropping the
    // subject would drop information the title does not carry.
    setReportWithFragileEdges([{ ...BASE_EDGE, label: 'price-to-revenue elasticity' }])
    const rows = sensitiveRows()

    expect(rows).toHaveLength(1)
    expect(rows[0].displayText).toContain('"price-to-revenue elasticity"')
    expect(rows[0].messageWithSubjectNamedAbove).toBeUndefined()
  })

  it('⛔ and the ends still reach the row by their declared names, resolved', () => {
    // The other half of the pair: this file must not pass by the hook emitting
    // nothing at all.
    setReportWithFragileEdges([BASE_EDGE])
    const rows = sensitiveRows()
    expect(rows[0].edgeFromLabel).toBe('Pro Plan Monthly Price')
    expect(rows[0].edgeToLabel).toBe('Monthly Recurring Revenue')
    expect(rows[0].edgeLabelsResolved).toBe(true)
  })

  /**
   * ⛔⛔ BOTH DIRECTIONS, AND THE BOTH-UNNAMED CASE CANNOT STAND IN FOR EITHER.
   *
   * MEASURED: a mutant forcing the TO-side of the gate to `true` SURVIVED a
   * corpus whose only negative case left BOTH ends unnamed — the from-side was
   * false, the ternary short-circuited, and the answer came out right for the
   * wrong reason. A corpus that tests one direction is a guard watching one door
   * (trap 22b). Each asymmetric case is its own test, and each is the other's
   * twin.
   */
  it('⛔ a NAMED source with an unnamed target is NOT resolved', () => {
    setReportWithFragileEdges([{ ...BASE_EDGE, to_label: undefined, to_id: 'unknown_b' }])
    const rows = sensitiveRows()
    expect(rows).toHaveLength(1)
    expect(rows[0].edgeFromLabel).toBe('Pro Plan Monthly Price')
    expect(rows[0].edgeLabelsResolved).toBe(false)
  })

  it('⛔ AND AN UNNAMED SOURCE WITH A NAMED TARGET IS NOT RESOLVED EITHER', () => {
    setReportWithFragileEdges([{ ...BASE_EDGE, from_label: undefined, from_id: 'unknown_a' }])
    const rows = sensitiveRows()
    expect(rows).toHaveLength(1)
    expect(rows[0].edgeToLabel).toBe('Monthly Recurring Revenue')
    expect(rows[0].edgeLabelsResolved).toBe(false)
  })

  it('⛔ an edge whose ends nothing names is NOT reported as resolved', () => {
    setReportWithFragileEdges([
      { ...BASE_EDGE, from_label: undefined, to_label: undefined, from_id: 'unknown_a', to_id: 'unknown_b' },
    ])
    const rows = sensitiveRows()
    expect(rows).toHaveLength(1)
    // ⚠ The labels are NOT empty — they fall through to `formatUnattributedId`
    // or 'Unknown …', strings that look like names and name nothing. That is
    // exactly why the resolved flag is computed here and not inferred there.
    expect(rows[0].edgeLabelsResolved).toBe(false)
  })
})
