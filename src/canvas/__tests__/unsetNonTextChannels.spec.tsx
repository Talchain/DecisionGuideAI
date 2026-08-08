/**
 * The NON-TEXT channels must not speak a value nobody set.
 *
 * WHAT THIS PINS
 * --------------
 * #472–#476 closed the TEXT channel and then the EdgePanel's COLOUR. This file
 * pins the channels those PRs did not reach — ORDER, a shared row component's
 * bar/band, an edge's stroke colour and thickness — and the registry gap that
 * left `strengthStd` with no marker to consult at all.
 *
 * CLAIM TYPE — read before adding an assertion here.
 * -------------------------------------------------
 * Assertions are of exactly three kinds, and nothing here claims more:
 *   1. **Pure-function return values** (`compareEdgeValueDisplays`,
 *      `aggregateEdgeSignedStrength`, `computeDirectionStroke`,
 *      `resolveEdgeValueDisplay`) — the strongest claims in the file.
 *   2. **Rendered text / DOM-node presence** (`ConnectionRow`).
 *   3. **Rendered order** — the sequence of `data-testid` nodes in the DOM.
 * jsdom cannot prove VISIBILITY, contrast or layout (platform trap 3). "Not
 * coloured green" below means *the returned token is not the positive one* or
 * *the element does not carry that class*, nothing more.
 *
 * REACHABILITY POSITIVE CONTROL
 * -----------------------------
 * Two defects in this exact area were branches that could never fire while
 * their comments claimed otherwise (`OutcomeNode`'s `weight != null`;
 * `computeDirectionStroke`'s `rawWeight === undefined` yellow arm). So every
 * "unset" fixture here is built by `drawEdgeThroughProduct()`, which calls
 * `useCanvasStore.addEdge` with `USER_EDGE_DEFAULTS` — the exact call
 * `ReactFlowGraph.tsx` makes when a user drags a connection — and asserts the
 * fabricated number IS present and the stamp is NOT before anything is
 * rendered. Each block also proves the same path still discriminates the other
 * way, so a gate that simply returned "unset" for everything would fail too.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useCanvasStore } from '../store'
import { USER_EDGE_DEFAULTS } from '../domain/edges'
import {
  resolveEdgeValueDisplay,
  resolveEdgeSignedStrengthDisplay,
  resolveEdgeDirectionDisplay,
  type EdgeDirectionDisplay,
  compareEdgeValueDisplays,
  compareEdgeValueAggregates,
  aggregateEdgeSignedStrength,
  edgeSourceKey,
  EDGE_PROVENANCED_FIELDS,
  EDGE_VALUE_SOURCE_KEYS,
  type EdgeValueDisplay,
} from '../domain/edgeValueProvenance'
import { computeDirectionStroke } from '../edges/directionStroke'
import { ConnectionRow } from '../ui/inspector-v2/shared/ConnectionRow'

const NODES = [
  { id: 'fac1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Marketing budget' } },
  { id: 'out1', type: 'outcome', position: { x: 100, y: 0 }, data: { label: 'Revenue' } },
]

beforeEach(() => {
  useCanvasStore.setState({
    ...useCanvasStore.getState(),
    nodes: NODES,
    edges: [],
    results: { status: 'none', report: null },
  } as never)
})

/**
 * REACHABILITY: build the edge the way the product does. No hand-authored
 * `data` — whatever `addEdge` + `USER_EDGE_DEFAULTS` produce is what the
 * surfaces under test see.
 */
function drawEdgeThroughProduct(): Record<string, unknown> {
  const result = useCanvasStore
    .getState()
    .addEdge({ source: 'fac1', target: 'out1', data: { ...USER_EDGE_DEFAULTS } } as never)
  expect((result as { created: boolean }).created).toBe(true)
  const drawn = useCanvasStore.getState().edges
  expect(drawn).toHaveLength(1)
  return drawn[0].data as unknown as Record<string, unknown>
}

describe('reachability positive control — a user-drawn edge really is unset', () => {
  it('carries fabricated numbers and NO source stamps', () => {
    const data = drawEdgeThroughProduct()
    // The fabrication is real: numbers are present…
    expect(typeof data.weight).toBe('number')
    expect(typeof data.beliefExists).toBe('number')
    expect(typeof data.strengthStd).toBe('number')
    // …and a direction is present too, which is why gating on `weight`
    // alone would still let "Raises"/green through.
    expect(data.direction).toBe('positive')
    // …but nothing proves any of them was set by anyone.
    for (const key of EDGE_VALUE_SOURCE_KEYS) expect(data[key]).toBeUndefined()

    expect(resolveEdgeSignedStrengthDisplay(data).show).toBe(false)
    expect(resolveEdgeValueDisplay(data, 'weight').show).toBe(false)
    expect(resolveEdgeValueDisplay(data, 'beliefExists').show).toBe(false)
  })
})

describe('EDGE_PROVENANCED_FIELDS — the registry, not a call site', () => {
  it('covers strengthStd, and its marker key is DERIVED from the field name', () => {
    expect([...EDGE_PROVENANCED_FIELDS]).toContain('strengthStd')
    // Derivation, not a hand-written ternary: every field maps to its own key.
    for (const field of EDGE_PROVENANCED_FIELDS) {
      expect(edgeSourceKey(field)).toBe(`${field}Source`)
    }
    // `directionSource` joined in ROADMAP 2.263: `direction` defaults exactly
    // like the numbers do (`USER_EDGE_DEFAULTS.direction: 'positive'`, and all
    // three ingestion paths fall through to `'positive'`), and the Model tab
    // was rendering that default as "Strong positive effect".
    expect([...EDGE_VALUE_SOURCE_KEYS]).toEqual([
      'beliefExistsSource',
      'weightSource',
      'strengthStdSource',
      'directionSource',
    ])
  })

  it('reports a user-drawn strengthStd as unset, and a stamped one as set', () => {
    const data = drawEdgeThroughProduct()
    // USER_EDGE_DEFAULTS fabricates 0.15 — the number KeyRelationships turned
    // into a "Moderate confidence" dot.
    expect(data.strengthStd).toBe(0.15)
    expect(resolveEdgeValueDisplay(data, 'strengthStd').show).toBe(false)

    // Discriminates: a std the user actually set is reportable.
    const set = resolveEdgeValueDisplay(
      { strengthStd: 0.4, strengthStdSource: 'user' },
      'strengthStd',
    )
    expect(set).toEqual({ show: true, value: 0.4, source: 'user' })
  })
})

describe('ORDER — unset sorts last in BOTH directions', () => {
  const unset: EdgeValueDisplay = { show: false, reason: 'not_set' }
  const low: EdgeValueDisplay = { show: true, value: 0.1, source: 'cee' }
  const high: EdgeValueDisplay = { show: true, value: 0.9, source: 'cee' }

  it('does not use a sentinel that flips with the sort direction', () => {
    // This is the property `-Infinity` / `+Infinity` could not hold. The old
    // sites hand-compensated the sentinel's SIGN against the comparator, two
    // lines apart in ModelTabBody.
    expect(compareEdgeValueDisplays(unset, high, 'desc')).toBeGreaterThan(0)
    expect(compareEdgeValueDisplays(unset, high, 'asc')).toBeGreaterThan(0)
    expect(compareEdgeValueDisplays(unset, low, 'desc')).toBeGreaterThan(0)
    expect(compareEdgeValueDisplays(unset, low, 'asc')).toBeGreaterThan(0)
    expect(compareEdgeValueDisplays(high, unset, 'asc')).toBeLessThan(0)
    expect(compareEdgeValueDisplays(unset, unset, 'desc')).toBe(0)
  })

  it('still orders SET values by magnitude in the requested direction', () => {
    expect(compareEdgeValueDisplays(high, low, 'desc')).toBeLessThan(0)
    expect(compareEdgeValueDisplays(high, low, 'asc')).toBeGreaterThan(0)
  })

  it('sorts a real drawn edge below a measured one', () => {
    const drawn = drawEdgeThroughProduct()
    const measured = { weight: 0.05, direction: 'positive', weightSource: 'user' }
    const sorted = [drawn, measured].sort((a, b) =>
      compareEdgeValueDisplays(
        resolveEdgeSignedStrengthDisplay(a),
        resolveEdgeSignedStrengthDisplay(b),
        'desc',
      ),
    )
    // 0.05 is far WEAKER than the drawn edge's fabricated 0.3, and still ranks
    // above it: "we measured a small effect" outranks "we know nothing".
    expect(sorted[0]).toBe(measured)
  })
})

describe('AGGREGATE — a rank built from nothing is not a rank', () => {
  it('counts only sourced contributions', () => {
    const drawn = drawEdgeThroughProduct()
    const agg = aggregateEdgeSignedStrength(
      [drawn, { weight: 0.6, direction: 'positive', weightSource: 'cee' }],
      { magnitude: true },
    )
    expect(agg).toEqual({ show: true, value: 0.6, sourcedCount: 1, unsourcedCount: 1 })
  })

  it('reports no evidence when nothing is sourced', () => {
    const drawn = drawEdgeThroughProduct()
    expect(aggregateEdgeSignedStrength([drawn, drawn])).toEqual({
      show: false,
      reason: 'not_set',
    })
    expect(aggregateEdgeSignedStrength([])).toEqual({ show: false, reason: 'absent' })
  })

  it('sums magnitudes so a strong negative counts as leverage', () => {
    const agg = aggregateEdgeSignedStrength(
      [
        { weight: 0.5, direction: 'negative', weightSource: 'cee' },
        { weight: 0.5, direction: 'positive', weightSource: 'cee' },
      ],
      { magnitude: true },
    )
    expect(agg.show && agg.value).toBeCloseTo(1.0)
  })

  it('ranks no-evidence aggregates last in both directions', () => {
    const none = aggregateEdgeSignedStrength([])
    const some = aggregateEdgeSignedStrength([{ weight: 0.2, weightSource: 'cee' }])
    expect(compareEdgeValueAggregates(none, some, 'desc')).toBeGreaterThan(0)
    expect(compareEdgeValueAggregates(none, some, 'asc')).toBeGreaterThan(0)
  })
})

describe('STROKE COLOUR — computeDirectionStroke', () => {
  // ⭐ ROADMAP 2.928 member b — the first parameter is now an
  // `EdgeDirectionDisplay`, resolved by `resolveEdgeDirectionDisplay`, not the
  // raw `direction` field. `stated()` below is the only way to express a
  // licensed claim; a defaulted `'positive'` is no longer expressible.
  const stated = (direction: 'positive' | 'negative'): EdgeDirectionDisplay => ({
    show: true,
    direction,
    source: 'user',
  })

  it('gives an edge drawn through the product NO verdict colour', () => {
    const data = drawEdgeThroughProduct()
    const stroke = computeDirectionStroke(
      // Both channels resolved from the SAME edge data the product produced —
      // no hand-supplied direction, which is what let the old call site pass
      // the fabricated default in.
      resolveEdgeDirectionDisplay(data),
      resolveEdgeSignedStrengthDisplay(data),
      false,
    )
    // The defaulted `direction: 'positive'` must NOT reach the green.
    expect(stroke).not.toBe('var(--edge-positive)')
    expect(stroke).toBe('var(--edge-neutral)')
  })

  it('gives NO verdict colour even once the STRENGTH has been set', () => {
    // ROADMAP 2.928: the reachable half-fix state. Setting the strength in the
    // inspector stamps `weightSource` and leaves `direction` unstamped, which
    // used to unlock the green while the glyph stayed correctly hidden.
    const data = { ...drawEdgeThroughProduct(), weightSource: 'user' }
    const stroke = computeDirectionStroke(
      resolveEdgeDirectionDisplay(data),
      resolveEdgeSignedStrengthDisplay(data),
      false,
    )
    expect(resolveEdgeSignedStrengthDisplay(data).show).toBe(true) // precondition
    expect(stroke).toBe('var(--edge-neutral)')
  })

  it('still discriminates when the strength IS sourced', () => {
    const set: EdgeValueDisplay = { show: true, value: 0.6, source: 'user' }
    expect(computeDirectionStroke(stated('positive'), set, false)).toBe('var(--edge-positive)')
    expect(computeDirectionStroke(stated('negative'), set, false)).toBe('var(--edge-negative)')
    expect(computeDirectionStroke(stated('positive'), set, true)).toBe('var(--edge-positive-dark)')
    // weight 0 is a valid user choice → neutral, unchanged.
    expect(
      computeDirectionStroke(stated('positive'), { show: true, value: 0, source: 'user' }, false),
    ).toBe('var(--edge-neutral)')
  })
})

describe('ConnectionRow — the prop type is the gate', () => {
  it('renders "Not set" and NO strength bar for an unset connection', () => {
    const data = drawEdgeThroughProduct()
    render(
      <ConnectionRow
        nodeKind="factor"
        label="Marketing budget"
        strength={resolveEdgeSignedStrengthDisplay(data)}
      />,
    )
    expect(screen.getByTestId('connection-row-strength-not-set')).toBeTruthy()
    expect(screen.queryByTestId('connection-row-strength')).toBeNull()
    // The band label and the ± glyph are both part of the same claim.
    expect(screen.queryByText(/Moderate/)).toBeNull()
    expect(screen.queryByText(/Slight/)).toBeNull()
  })

  it('still renders the bar and band label for a sourced connection', () => {
    render(
      <ConnectionRow
        nodeKind="factor"
        label="Marketing budget"
        strength={{ show: true, value: 0.62, source: 'cee' }}
      />,
    )
    const bar = screen.getByTestId('connection-row-strength')
    expect(bar).toBeTruthy()
    expect(bar.querySelector('.bg-success')).toBeTruthy()
    expect(screen.queryByTestId('connection-row-strength-not-set')).toBeNull()
    expect(screen.getByText(/Strong/)).toBeTruthy()
  })

  it('renders no strength affordance at all when there is no value', () => {
    render(
      <ConnectionRow
        nodeKind="option"
        label="Ship it"
        strength={{ show: false, reason: 'absent' }}
      />,
    )
    expect(screen.queryByTestId('connection-row-strength')).toBeNull()
    expect(screen.queryByTestId('connection-row-strength-not-set')).toBeNull()
  })
})
