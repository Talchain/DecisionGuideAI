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
 *   `withGhostTiers(nodes)` — whether doors are produced for a real graph,
 *      called directly. Delete the behaviour and this file REDS.
 *   The `nodesWithGhost` memo in `ReactFlowGraph.tsx` carries NO view-mode and
 *      NO results-status branch — read from source, brace-matched to that block.
 *
 * ⚠ THE SECOND ONE REPLACED A PREDICATE, AND THE SWAP IS THE POINT. There used
 * to be a `frontierIsVisible(resultsStatus, viewMode)` here, gating the doors to
 * Expert view after an analysis; Paul retired that rule on 1 Sep 2026. It was
 * first kept as a constant-returning function on the argument that it was the
 * only surface where a re-introduced gate could be caught — and a review
 * refuted that by execution: the original gate, re-added at the MOUNT one line
 * below the live call, left this file 12/12 green. It also only ever enumerated
 * 2 of the 7 members `ResultsStatus` admits (`store.ts:241`), so gates on
 * `streaming`, `error` and `cancelled` survived too. The function is deleted and
 * the guard now reads the address the defect actually recurs at.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Node } from '@xyflow/react'
import { withGhostTiers, isGhostNode } from '../../utils/ghostTiers'

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
 * Everything above calls `withGhostTiers()` directly. That makes the suite
 * sensitive to what that function DOES — which is exactly what the old
 * source-text spec lacked. But the mount does not call it in a test's presence,
 * so **nothing above would fail if `ReactFlowGraph` stopped calling it.** Delete
 * the call site and every assertion above still passes.
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
describe('the ghost mount carries no visibility gate', () => {
  const GRAPH = resolve(__dirname, '../../ReactFlowGraph.tsx')

  /**
   * ⚠ COMMENTS STRIPPED, AND THIS IS THE WHOLE POINT OF THE HELPER.
   *
   * Without it, a probe matches text sitting inside a COMMENT. A review proved
   * that by mutation on an earlier version of this file: it replaced the gate
   * with a comment carrying the same call text plus an unconditional
   * `return nodes` — frontier completely dead, no door ever produced — and every
   * test stayed GREEN. It matters doubly now, because the block below is
   * DESCRIBED at length in a comment that necessarily spells both banned words.
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

  /**
   * The body of the `nodesWithGhost` memo — the exact region the gate lived in.
   * Brace-matched rather than line-numbered, so it survives edits above it, and
   * it refuses rather than returns a short string if the anchor moves.
   */
  const ghostMemoBody = (): string => {
    const code = source()
    const ANCHOR = 'const nodesWithGhost = useMemo(() => {'
    const i = code.indexOf(ANCHOR)
    if (i === -1) throw new Error('anchor `const nodesWithGhost = useMemo` not found — refusing to assert')
    let depth = 0
    const from = i + ANCHOR.length - 1
    for (let j = from; j < code.length; j++) {
      if (code[j] === '{') depth++
      else if (code[j] === '}') {
        depth--
        if (depth === 0) {
          const body = code.slice(from + 1, j)
          if (body.trim().length < 400) {
            throw new Error(`extracted ${body.trim().length} chars of memo body — refusing to assert`)
          }
          return body
        }
      }
    }
    throw new Error('unbalanced braces while extracting the ghost memo — refusing to assert')
  }

  /** The detector, factored out so a positive control can run it on known-guilty text. */
  const gateAxesIn = (body: string): string[] =>
    ['viewMode', 'resultsStatus', 'results.status'].filter((axis) => body.includes(axis))

  it('CONTRAST CONTROL: the extraction found the right block', () => {
    // Proves the absence assertion below is about the ghost memo and not about
    // an empty or mis-located string. Binds by the identity of what the block
    // composes, not by a length predicate any region could satisfy.
    const body = ghostMemoBody()
    expect(body).toContain('withGhostTiers')
    expect(body).toContain('GHOST_OPTION_NODE_ID')
  })

  it('POSITIVE CONTROL: the detector fires on a gate it is meant to catch', () => {
    // Without this, a detector that matched nothing would pass the assertion
    // below by matching nothing — the exact vacuity this file exists to correct.
    // The string is the ORIGINAL gate, verbatim, at its original address.
    const guilty = `
      if (resultsStatus === 'complete' && viewMode !== 'expert') return nodes
      return withGhostTiers(nodes, tierGhosts)
    `
    expect(gateAxesIn(guilty).sort()).toEqual(['resultsStatus', 'viewMode'])
    // And it must not fire on innocent text, or "fires" means nothing.
    expect(gateAxesIn('return withGhostTiers(nodes, tierGhosts)')).toEqual([])
  })

  it('the ghost memo branches on NO view mode and NO results status', () => {
    // ⚠ THIS IS A SOURCE-TEXT GUARD, NOT BEHAVIOURAL COVERAGE, and the
    // distinction is the reason it exists. Paul ruled on 1 Sep 2026 that the
    // reasoning frontier must be reachable outside Expert view. The predicate
    // that used to gate it has been DELETED rather than neutered, because a
    // constant-returning `frontierIsVisible` was kept on the claim that it was
    // the only place a re-introduced gate could be caught, and a review refuted
    // that by execution — the original gate re-added at THIS address, one line
    // below the live call, left the suite fully green.
    //
    // So the guard is pointed at the address the defect actually recurs at.
    // What it proves: no `viewMode` or `results.status` branch exists in this
    // block. What it does NOT prove: that a door reaches a user's screen. See
    // the note at the foot of this file.
    expect(gateAxesIn(ghostMemoBody())).toEqual([])
  })

  it('the mount still calls withGhostTiers', () => {
    expect(source()).toMatch(/withGhostTiers\s*\(/)
  })

  it('POSITIVE CONTROL: the same probe finds a symbol that is genuinely absent', () => {
    expect(source()).not.toMatch(/withGhostTiersV99Fabricated\s*\(/)
    expect(source()).toMatch(/withGhostTiers\s*\(/)
  })
})

/**
 * ⭐ WHAT NO TEST IN THIS REPO CAN WITNESS, STATED PLAINLY.
 *
 * Everything above is either a direct call to `withGhostTiers` or a source-text
 * read of the mount. Neither renders anything, so neither can show that a door
 * is on a user's screen after an analysis in Standard view — which is the whole
 * of what Paul ruled. jsdom cannot prove visibility, and nothing in this repo
 * renders `ReactFlowGraph`.
 *
 * The ONE instrument that could is `e2e/geometry/ghostDoorVisibility.measure.ts`,
 * and until this change it asserted the OPPOSITE rule. It is re-pointed in the
 * same commit — but it is referenced by ZERO CI workflows, so it will not RED
 * for anyone, and this change therefore ships at the TESTED rung with no
 * instrument in CI capable of witnessing its actual claim. Wiring that file into
 * a workflow is rowed, not done here.
 */
