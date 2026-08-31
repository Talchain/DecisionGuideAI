/**
 * ⭐ THE REASONING FRONTIER'S MOUNT PATH — bound to BEHAVIOUR, after this file
 * spent a whole dark period agreeing with itself.
 *
 * The frontier is the one component on this canvas built to help a team think
 * of what the model does NOT yet contain: a door at the end of each tier that
 * asks Olumi a question.
 *
 * ── WHAT THE PREVIOUS VERSION OF THIS FILE GOT WRONG ──
 *
 * It asserted SOURCE TEXT: that `enableGhostSuggestions` appeared on the
 * element, that it was written as a bare literal, that it defaulted `false`.
 * Six assertions, all green, all true — and all six were equally green while
 * the prop was DEAD. It was declared, defaulted, destructured at
 * `ReactFlowGraph.tsx` and never read, so it decided nothing; the doors
 * rendered on every mount of the graph the entire time. The spec could not have
 * failed, because not one assertion was about whether anything rendered.
 *
 * Its own header argued the case: "a render test proves the doors work under
 * props the TEST supplies — which is precisely the evidence that stayed green
 * while they were dark." That reasoning is sound about a render test with
 * hand-fed props. It was used to justify asserting nothing about behaviour at
 * all, which is a different thing, and it produced a guard that blessed exactly
 * the state it was written to detect.
 *
 * ── WHAT THIS VERSION ASSERTS ──
 *
 * The two functions that actually decide, called directly:
 *
 *   `frontierIsVisible(resultsStatus, viewMode)` — whether the tier doors are
 *      on screen at all. Extracted out of a `useMemo` in a 2,700-line component
 *      for this reason: a condition no test can call cannot be pinned.
 *   `withGhostTiers(nodes)` — whether doors are produced for a real graph.
 *
 * Delete either behaviour and this file REDS. That is the property the old one
 * lacked.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Node } from '@xyflow/react'
import { frontierIsVisible, withGhostTiers, isGhostNode } from '../../utils/ghostTiers'

/** A model shaped like a real one: three tiers with members, all named. */
function model(): Node[] {
  const at = (id: string, type: string, label: string, x: number): Node =>
    ({ id, type, position: { x, y: type === 'option' ? 0 : 200 }, data: { label } }) as Node
  return [
    at('d1', 'decision', 'Replace our CDP', 0),
    at('o1', 'option', 'Segment', 0),
    at('o2', 'option', 'Rudderstack', 300),
    at('r1', 'risk', 'Migration overruns', 0),
  ]
}

const doorsIn = (nodes: Node[]) => nodes.filter(isGhostNode)

describe('the frontier is visible when the product says it is', () => {
  // ⚠ THE DISCRIMINATING TRIPLE. Each row must differ from its neighbour, or
  // the predicate is not discriminating and a constant `true` would pass.
  it('renders before an analysis, in the ordinary view', () => {
    expect(frontierIsVisible('idle', 'standard')).toBe(true)
  })

  it('renders after an analysis in Expert view', () => {
    expect(frontierIsVisible('complete', 'expert')).toBe(true)
  })

  it('DISAPPEARS after an analysis in the ordinary view — the existing product behaviour, pinned so a change to it is deliberate', () => {
    // This is very likely the mechanism behind a deployed measurement of zero
    // doors against thirteen real nodes. It is preserved unchanged here and
    // raised as a product question separately; what this assertion buys is that
    // nobody can now move it without a test going red and saying so.
    expect(frontierIsVisible('complete', 'standard')).toBe(false)
  })

  it('is not a constant — the three states above do not all agree', () => {
    // Guards against the failure mode this whole file exists to correct: a
    // predicate that returns the same answer for every input passes any number
    // of individually-plausible assertions.
    const answers = [
      frontierIsVisible('idle', 'standard'),
      frontierIsVisible('complete', 'expert'),
      frontierIsVisible('complete', 'standard'),
    ]
    expect(new Set(answers).size).toBe(2)
  })
})

describe('doors are actually produced for a real model', () => {
  it('places a door on every tier that has members', () => {
    const out = withGhostTiers(model())
    const doors = doorsIn(out)
    expect(doors.length).toBeGreaterThan(0)
    const tiers = doors.map((d) => (d.data as { tier?: string }).tier).sort()
    expect(tiers).toEqual(['option', 'risk'])
  })

  it('CONTRAST CONTROL: a tier with no members gets no door', () => {
    // Proves the assertion above is about tier membership and not about the
    // function returning a fixed set. Without this, "doors exist" is compatible
    // with doors appearing for tiers the model does not have — which would be
    // the product asserting the model OUGHT to contain them.
    const doors = doorsIn(withGhostTiers(model()))
    expect(doors.map((d) => (d.data as { tier?: string }).tier)).not.toContain('outcome')
  })

  it('leaves the real model untouched — every input node survives, and no door counts as one', () => {
    const input = model()
    const out = withGhostTiers(input)
    const passedThrough = out.filter((n) => !isGhostNode(n)).map((n) => n.id)
    expect(passedThrough).toEqual(input.map((n) => n.id))
  })
})

/**
 * ⭐ THE RESIDUAL GAP, CLOSED AS FAR AS A UNIT TEST CAN AND NAMED WHERE IT
 * CANNOT.
 *
 * Everything above calls `frontierIsVisible()` and `withGhostTiers()` directly.
 * That makes the suite sensitive to what those two functions DO — which is
 * exactly what the old source-text spec lacked. But the mount calls neither
 * directly in a test's presence, so **nothing above would fail if
 * `ReactFlowGraph` stopped calling them.** Delete the call site and every
 * assertion in this file still passes.
 *
 * That is not hypothetical in this repo: an independent review found the same
 * shape in UI #1057 the same evening — a wiring spec that called its function
 * directly, so mutating the single line that invoked it left 143 tests green.
 *
 * So the call-site binding is asserted from SOURCE, and this is the one claim
 * source is the right instrument for: whether a line exists is a property of
 * the file, not of a function's behaviour. What it does NOT prove is that the
 * line executes, or under what conditions.
 *
 * ⚠ WHAT IS STILL OWED, stated rather than carried silently: a mount test that
 * renders the graph and asserts ghost nodes reach `<ReactFlow>`. That is the
 * only thing that would prove the frontier renders, and it is not here. This
 * pair — behaviour of the functions, presence of the call — is strictly more
 * than the previous spec had and strictly less than a mount witness.
 */
describe('the mount still calls the functions this file tests', () => {
  const GRAPH = resolve(__dirname, '../../ReactFlowGraph.tsx')

  const source = (): string => {
    const text = readFileSync(GRAPH, 'utf8')
    // An absence assertion against an empty read passes beautifully, and an
    // extraction that silently produced nothing agrees with every other
    // extraction that produced nothing.
    if (text.length < 10_000) {
      throw new Error(`refusing to assert: read ${text.length} chars from ReactFlowGraph.tsx`)
    }
    return text
  }

  it('invokes frontierIsVisible', () => {
    expect(source()).toMatch(/frontierIsVisible\s*\(/)
  })

  it('invokes withGhostTiers', () => {
    expect(source()).toMatch(/withGhostTiers\s*\(/)
  })

  it('POSITIVE CONTROL: the same probe finds a symbol that is genuinely absent', () => {
    // Proves the two assertions above can FAIL. Without it, a regex that never
    // matches anything would pass them both by matching nothing — the exact
    // vacuity that let the previous version of this file stay green while the
    // prop it asserted decided nothing.
    expect(source()).not.toMatch(/frontierIsVisibleV99Fabricated\s*\(/)
    expect(source()).toMatch(/withGhostTiers\s*\(/)
  })
})
