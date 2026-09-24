/**
 * A connection says WHAT IT JOINS, not which ids it joins.
 *
 * Measured on the deployed build (staging `e5a62322`, live model, 10 Sep 2026):
 * **21 of 21** `.react-flow__edge` groups carried React Flow's own default
 * name, `"Edge from 2891dabb to c12af5de"` — our internal node ids, spoken to
 * anyone who cannot see the canvas. Contrast control in the same probe: node
 * cards announced prose, so the surface can carry it; and `edgesWithInnerAria`
 * was **0**, so the rich name `StyledEdge` composes was not in the document at
 * all — it lives on an element that exists only while the label is visible.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildEdgeAccessibleName,
  withEdgeAccessibleNames,
  UNTITLED_NODE_NAME,
  EDGE_ARIA_ROLE,
  type NameableEdge,
} from '../edgeAccessibleName'
import { edgeStrengthEditIsAssertable } from '../../conversation/edgeStrengthEdit'
import {
  EDGE_AFFORDANCE_EDITABLE,
  EDGE_AFFORDANCE_READ_ONLY,
} from '../../edges/edgeAffordance'

const labels = new Map<string, string>([
  ['2891dabb', 'Outsource Overflow to a Third-Party Logistics Provider'],
  ['c12af5de', '3PL Overflow Capacity'],
  ['2a9eb771', 'Carrier Cut-off Compliance'],
  ['ac02582c', 'Next-Day Delivery Rate'],
])

/** Endpoint ids and labels taken from the real model the defect was measured on. */
const edges: NameableEdge[] = [
  { id: 'e-0', source: '2891dabb', target: 'c12af5de', data: {} },
  { id: 'e-1', source: '2a9eb771', target: 'ac02582c', data: {} },
]

describe('the sentence a connection answers to', () => {
  it('names both endpoints and keeps the direction explicit', () => {
    expect(
      buildEdgeAccessibleName({ sourceLabel: 'Carrier Cut-off Compliance', targetLabel: 'Next-Day Delivery Rate' }),
    ).toBe('Connection from Carrier Cut-off Compliance to Next-Day Delivery Rate')
  })

  it('appends the edge’s own painted description when it has one', () => {
    expect(
      buildEdgeAccessibleName({ sourceLabel: 'A', targetLabel: 'B', description: 'Moderate boost (likelihood not set)' }),
    ).toBe('Connection from A to B. Moderate boost (likelihood not set)')
  })

  /**
   * ⛔ THE HONESTY ARM. An edge nobody has estimated must contribute NO clause.
   * A fabricated "Raises 50%" spoken to someone who cannot see the canvas is as
   * false as one drawn on it, and harder to challenge — there is nothing on
   * screen to contradict it.
   */
  it('says nothing extra when the edge describes nothing', () => {
    for (const empty of [undefined, null, '', '   ']) {
      expect(buildEdgeAccessibleName({ sourceLabel: 'A', targetLabel: 'B', description: empty })).toBe(
        'Connection from A to B',
      )
    }
  })

  it('falls back to the estate’s existing word for an unlabelled node', () => {
    expect(buildEdgeAccessibleName({ sourceLabel: null, targetLabel: '  ' })).toBe(
      `Connection from ${UNTITLED_NODE_NAME} to ${UNTITLED_NODE_NAME}`,
    )
  })
})

describe('every edge gets named, and no id survives', () => {
  it('names all of them — this is the property the defect violated', () => {
    // Floor: an empty input would satisfy every assertion in the loop vacuously.
    expect(edges.length, 'fixture is empty').toBeGreaterThan(0)
    const named = withEdgeAccessibleNames(edges, labels, 'human')
    expect(named).toHaveLength(edges.length)
    for (const e of named) {
      expect(e.ariaLabel, `${e.id} has no accessible name`).toBeTruthy()
      // The precise regression: a raw endpoint id reaching the spoken name.
      expect(e.ariaLabel).not.toContain(e.source)
      expect(e.ariaLabel).not.toContain(e.target)
    }
  })

  /**
   * ⭐⭐ BOUND BY IDENTITY, PROVEN BY A DISCRIMINATING PAIR.
   *
   * A name built from the wrong endpoint is still a well-formed sentence, so a
   * "contains prose" assertion cannot see the defect. Arm 1: this edge's name
   * carries ITS OWN endpoints' labels. Arm 2 — the discrimination — renaming a
   * node this edge does NOT touch must leave its name byte-identical. One arm
   * alone proves sensitivity to something; the pair proves it is bound to the
   * named object.
   */
  it('uses its own endpoints, not another edge’s', () => {
    const [first] = withEdgeAccessibleNames(edges, labels, 'human')
    expect(first.ariaLabel).toContain('Outsource Overflow to a Third-Party Logistics Provider')
    expect(first.ariaLabel).toContain('3PL Overflow Capacity')
    // Arm 2: perturb a node that is NOT an endpoint of this edge.
    const perturbed = new Map(labels)
    perturbed.set('2a9eb771', 'RENAMED — NOT AN ENDPOINT OF e-0')
    const [firstAgain] = withEdgeAccessibleNames(edges, perturbed, 'human')
    expect(firstAgain.ariaLabel).toBe(first.ariaLabel)
    // ...and the edge that DOES touch it must move, or arm 2 proved nothing.
    const [, second] = withEdgeAccessibleNames(edges, perturbed, 'human')
    expect(second.ariaLabel).toContain('RENAMED — NOT AN ENDPOINT OF e-0')
  })

  it('never flattens a name a caller already chose', () => {
    const withOwn: NameableEdge[] = [{ ...edges[0], ariaLabel: 'A considered name' }]
    expect(withEdgeAccessibleNames(withOwn, labels, 'human')[0].ariaLabel).toBe('A considered name')
  })
})

/**
 * ⭐⭐ ROW 35 — contract §01: "edges focusable … role=button". Read at the
 * INSTALLED `@xyflow/react@12.10.2` runtime bytes (`dist/esm/index.mjs`,
 * `EdgeWrapper`): `role: edge.ariaRole ?? (isFocusable ? 'group' : 'img')` —
 * every focusable edge announced the generic `group` because nothing ever
 * supplied `ariaRole`. Named at the SAME seam as the accessible name
 * (`withEdgeAccessibleNames`), for the same reason (CLAUDE.md trap 12): a
 * second construction site would silently ship `group` again.
 */
describe('every edge also gets role=button (contract §01), independently of the name', () => {
  it('names the role, EDGE_ARIA_ROLE, so the seam and this pin cannot drift on the literal', () => {
    expect(EDGE_ARIA_ROLE).toBe('button')
  })

  it('sets ariaRole to EDGE_ARIA_ROLE on an edge that had none', () => {
    const [named] = withEdgeAccessibleNames(edges, labels, 'human')
    expect(named.ariaRole).toBe(EDGE_ARIA_ROLE)
  })

  it('names ALL of them — the same completeness property as the accessible name', () => {
    const named = withEdgeAccessibleNames(edges, labels, 'human')
    for (const e of named) {
      expect(e.ariaRole, `${e.id} has no role`).toBe(EDGE_ARIA_ROLE)
    }
  })

  it('⛔ a caller-supplied ariaRole is NEVER overwritten', () => {
    const withOwn: NameableEdge[] = [{ ...edges[0], ariaRole: 'img' }]
    expect(withEdgeAccessibleNames(withOwn, labels, 'human')[0].ariaRole).toBe('img')
  })

  /**
   * ⭐⭐ THE INDEPENDENCE CASE. `ariaLabel` and `ariaRole` are checked
   * SEPARATELY (`hasOwnAriaLabel` / `hasOwnAriaRole`) rather than as one
   * "already named" bit — a caller could supply a considered NAME with no
   * opinion on ROLE. Without this case, collapsing the two checks into one
   * early return (`if (hasOwnAriaLabel) return edge`) would leave this
   * edge's role un-set and still pass every case above.
   */
  it('supplying only ariaLabel still gets the role — the two fields are independent', () => {
    const withOwnLabelOnly: NameableEdge[] = [{ ...edges[0], ariaLabel: 'A considered name' }]
    const [named] = withEdgeAccessibleNames(withOwnLabelOnly, labels, 'human')
    expect(named.ariaLabel).toBe('A considered name')
    expect(named.ariaRole).toBe(EDGE_ARIA_ROLE)
  })

  /** And the mirror: a caller's own role must not block the NAME from being built. */
  it('supplying only ariaRole still gets the built name — the two fields are independent', () => {
    const withOwnRoleOnly: NameableEdge[] = [{ ...edges[0], ariaRole: 'img' }]
    const [named] = withEdgeAccessibleNames(withOwnRoleOnly, labels, 'human')
    expect(named.ariaRole).toBe('img')
    expect(named.ariaLabel).toContain('Outsource Overflow to a Third-Party Logistics Provider')
  })
})

/**
 * ⭐⭐ THE MOUNT-PATH GUARD — a value assertion cannot prove a reference.
 *
 * Every assertion above passes on a module nothing imports. The measured defect
 * was never that this logic was wrong; it was that **no name reached the
 * element React Flow labels**. So this reads the seam's SOURCE and pins that it
 * applies the naming, and pins its own precondition so it cannot pass by
 * pointing at a file that has moved.
 */
describe('the seam that feeds <ReactFlow> actually applies it', () => {
  const seam = resolve(__dirname, '../../ReactFlowGraph.tsx')
  const src = readFileSync(seam, 'utf8')

  it('precondition — this really is the file that builds memoizedEdges', () => {
    expect(src).toContain('const memoizedEdges')
    expect(src).toContain('<ReactFlow')
  })

  it('memoizedEdges names the edges before they reach React Flow', () => {
    expect(src).toContain('withEdgeAccessibleNames')
    expect(src).toContain("from './domain/edgeAccessibleName'")
  })
})


/**
 * ⭐⭐ THE OUTER GROUP IS WHERE THE AFFORDANCE HAS TO LAND — and #1782 put it on
 * the inner element, which is the very defect THIS module was written to close.
 *
 * This file's header records the original finding: `StyledEdge` composes a
 * careful accessible name, *"on an inner element that only exists while the
 * edge's label is visible"*, so the probe found `edgesWithInnerAria: 0` while
 * every outer group carried React Flow's hex default. `withEdgeAccessibleNames`
 * exists because the outer group is the element assistive technology names.
 *
 * #1782 added the double-click affordance to `StyledEdge`'s sentence — the
 * INNER one. So it reaches an edge only while that edge's label renders.
 *
 * ── MEASURED ON THE DEPLOYED BUILD (`7ec3fed2`, guest session, 20 Sep 2026) ──
 *   · 39 connections on screen
 *   · **39 of 39** outer groups carry an `aria-label` and announce a strength —
 *     so every one is server-stated
 *   · **3 of 39** render a label, and only those 3 carry the hover `title`
 *   · **0 of 39** announce the affordance on the assistive channel
 *
 * And the three that DO carry a tooltip contradict themselves in two lines:
 *
 *   "Estimate not yet confirmed — the strength of this connection was filled in
 *    for you. Open the details to set or confirm it.  …  Double-click to inspect"
 *
 * The double-click opens a panel whose strength control is NOT disabled —
 * verified in the same session: `input[type=range]` "Effect on target", value
 * 0.33, "Confirm this estimate" beside it. The edit worked; nothing said so.
 *
 * ⛔ SO THIS IS NOT A SECOND VOCABULARY. It is the SAME
 * `edgeDoubleClickAffordance` derivation reaching the channel that has none —
 * and putting it only on the tooltip would leave this module's two channels
 * saying different things, which is the drift its header forbids by name.
 *
 * ⚠ AND IT IS ASSERTED BY EXECUTION. #1782's own assistive-channel test is
 * `expect(SOURCE).toMatch(...)` — a source scan, which that PR's own docblock
 * says cannot prove behaviour. These run the function.
 */
describe('the accessible name carries what a double-click does', () => {
  /** Verbatim from the founder's capture — an edge that CAN take an edit. */
  const CARRIABLE: NameableEdge = {
    id: 'e-0',
    source: '2891dabb',
    target: 'c12af5de',
    data: { strength_mean: 1, effect_direction: 'positive' },
  }
  /** Verbatim from the same capture — an edge the builder refuses. */
  const REFUSED: NameableEdge = {
    id: 'e-10',
    source: '2a9eb771',
    target: 'ac02582c',
    data: { strength_mean: 0.35, effect_direction: 'negative' },
  }

  it('⭐ PRECONDITION: the two fixtures genuinely divide, or every claim below is vacuous', () => {
    expect(edgeStrengthEditIsAssertable(CARRIABLE as never)).toBe(true)
    expect(edgeStrengthEditIsAssertable(REFUSED as never)).toBe(false)
    expect(EDGE_AFFORDANCE_EDITABLE).not.toBe(EDGE_AFFORDANCE_READ_ONLY)
  })

  it('an editable connection SAYS it can be set, on the assistive channel', () => {
    const [named] = withEdgeAccessibleNames([CARRIABLE], labels, 'human')
    expect(named.ariaLabel).toContain(EDGE_AFFORDANCE_EDITABLE)
  })

  it('CONTRAST: a connection whose edit cannot land keeps the read-only word', () => {
    // The discriminating half. Without it, a function appending the editable
    // sentence UNCONDITIONALLY passes the test above — and over-promising is the
    // worse of the two failures, because the user acts on it.
    const [named] = withEdgeAccessibleNames([REFUSED], labels, 'human')
    expect(named.ariaLabel).toContain(EDGE_AFFORDANCE_READ_ONLY)
    expect(named.ariaLabel).not.toContain(EDGE_AFFORDANCE_EDITABLE)
  })

  it('the affordance is ADDED, never substituted for the name or the description', () => {
    const [named] = withEdgeAccessibleNames([CARRIABLE], labels, 'human')
    expect(named.ariaLabel).toContain(
      'Connection from Outsource Overflow to a Third-Party Logistics Provider to 3PL Overflow Capacity',
    )
    // The painted description still survives alongside it — the regression this
    // module's "both channels agree" rule is really about.
    expect(named.ariaLabel).toMatch(/boost|drag|raises|lowers/i)
  })

  it('⛔ a caller-supplied ariaLabel is STILL never overwritten', () => {
    const [named] = withEdgeAccessibleNames(
      [{ ...CARRIABLE, ariaLabel: 'A considered name' }],
      labels,
      'human',
    )
    expect(named.ariaLabel).toBe('A considered name')
  })
})
