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

// ⚠ `isGhostNode(id: string)` — it takes the ID, not the node. Passing the node
// threw a TypeError on every call, so the three tests below FAILED AT PRISTINE
// and could not have redded on a regression: the half of this file that asserts
// doors get produced was already red. `tsc` never saw it, because the typecheck
// gate excludes test files — a type error inside a spec is invisible to it.
const doorsIn = (nodes: Node[]) => nodes.filter((n) => isGhostNode(n.id))

/**
 * ⭐ RE-POINTED, NOT RELAXED (Paul's ruling, 1 Sep 2026: the post-analysis
 * reasoning frontier must be reachable OUTSIDE Expert view).
 *
 * The previous version of this block pinned the OPPOSITE rule — that the doors
 * DISAPPEAR after an analysis in the ordinary view — and pinned it deliberately,
 * with a comment saying the behaviour was "raised as a product question
 * separately". That question has now been answered, so the assertion is turned
 * around to pin the answer rather than deleted to make room for it. The old
 * expectation REDs against this build, which is the point: nobody can restore
 * the Expert-only gate without a named test saying so.
 *
 * ⚠ AND NOTE WHAT THIS COSTS, because the old block's own comment named it: the
 * predicate is no longer DISCRIMINATING, and "returns the same answer for every
 * input" is the exact vacuity this file was rewritten to eliminate. It is not
 * vacuity here — it is the product rule — but an enumeration that agrees with
 * itself cannot tell you it is complete, so two things carry the weight instead:
 *
 *   1. The matrix below is EXHAUSTIVE over the real input space, not a sample.
 *      `ViewMode = 'standard' | 'expert'` (`store.ts:7489`) has exactly two
 *      members, so every combination that can reach this predicate is listed.
 *      Reintroduce a gate on EITHER axis and a named row REDs.
 *   2. The matrix asserts its own size first. An empty `it.each` table passes
 *      beautifully and agrees with every other table that ran nothing.
 *
 * The file's real discrimination now lives where it belongs — in
 * `withGhostTiers`, whose CONTRAST CONTROL below still proves an empty tier gets
 * no door. That function takes no view mode and no results status, so the axes
 * removed here cannot re-enter through it without a signature change.
 */
describe('the frontier is visible when the product says it is', () => {
  // Every (resultsStatus, viewMode) pair the mount can hand this predicate.
  // Named rows, not a loop over a computed product, so a failure names the state.
  const MATRIX: ReadonlyArray<readonly [string, string, string]> = [
    ['before an analysis, in the ordinary view', 'idle', 'standard'],
    ['before an analysis, in Expert view', 'idle', 'expert'],
    ['AFTER an analysis, in the ordinary view — Paul, 1 Sep 2026', 'complete', 'standard'],
    ['after an analysis, in Expert view', 'complete', 'expert'],
  ]

  it('POSITIVE CONTROL: the matrix is non-empty and covers both view modes', () => {
    // Without this, deleting the table's rows would leave every assertion below
    // passing by running zero times.
    expect(MATRIX.length).toBe(4)
    expect(new Set(MATRIX.map(([, , view]) => view))).toEqual(new Set(['standard', 'expert']))
    expect(new Set(MATRIX.map(([, status]) => status))).toEqual(new Set(['idle', 'complete']))
  })

  it.each(MATRIX)('renders %s', (_name, resultsStatus, viewMode) => {
    expect(frontierIsVisible(resultsStatus, viewMode)).toBe(true)
  })

  it('the Expert-only gate is GONE — not merely defaulted off', () => {
    // The single assertion the old rule turned on, inverted. This is the row
    // that REDs if `viewMode !== 'expert'` ever returns to the predicate.
    expect(frontierIsVisible('complete', 'standard')).toBe(true)
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
    const passedThrough = out.filter((n) => !isGhostNode(n.id)).map((n) => n.id)
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
 * ⚠ WHAT IS STILL OWED, and a review has now measured exactly how much.
 *
 * Stripping comments closes ONE of the two holes: the call is now proven to be
 * live code rather than prose. It does NOT prove the mount EXECUTES it. The
 * reviewer's mutant was a comment PLUS an unconditional `return nodes`, and only
 * the first half is caught here — a live call sitting in a branch that never
 * fires would still pass, which is precisely the shape that made the original
 * defect invisible.
 *
 * The close is a CALL-COUNT assertion against a mocked module, since a comment
 * cannot satisfy a call count and neither can an unreached branch. That needs a
 * harness that renders the graph, and NOTHING in this repo renders
 * `ReactFlowGraph` today — both existing "mount path" specs are source-text
 * specs like this one. So it is a lane, not a line, and it is named here rather
 * than implied to be done.
 *
 * Read this file as: behaviour of the two functions, PROVEN; the call site is
 * live code, PROVEN; the mount reaches it, NOT PROVEN.
 */
describe('the mount still calls the functions this file tests', () => {
  const GRAPH = resolve(__dirname, '../../ReactFlowGraph.tsx')

  /**
   * ⚠ COMMENTS STRIPPED, AND THIS IS THE WHOLE POINT OF THE HELPER.
   *
   * Without it, `/frontierIsVisible\s*\(/` matches a call sitting inside a
   * COMMENT. A review proved it by mutation: it replaced the gate with a comment
   * carrying the same call text plus an unconditional `return nodes` — frontier
   * completely dead, no door ever produced — and all three tests below stayed
   * GREEN. Delta pristine to dead-frontier: zero.
   *
   * The irony is worth recording rather than quietly fixing: the spec I DELETED
   * to write this one had a `codeOnly()` helper doing exactly this, and I
   * dropped it while removing that file's real defect. Its comment-stripping was
   * the sound half of a spec whose fault lay elsewhere.
   */
  const source = (): string => {
    const text = readFileSync(GRAPH, 'utf8')
    // An absence assertion against an empty read passes beautifully, and an
    // extraction that silently produced nothing agrees with every other
    // extraction that produced nothing.
    if (text.length < 10_000) {
      throw new Error(`refusing to assert: read ${text.length} chars from ReactFlowGraph.tsx`)
    }
    const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    if (code.trim().length < 10_000) {
      throw new Error(`comment strip left ${code.trim().length} chars — refusing to assert`)
    }
    return code
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
