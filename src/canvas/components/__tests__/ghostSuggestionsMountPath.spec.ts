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
 *   `frontierFor(resultsStatus)` — WHICH frontier is on screen. It replaced a
 *      `frontierIsVisible(resultsStatus, viewMode)` gate that removed every
 *      door after an analysis outside Expert view; the questions now change
 *      with the phase instead of the doors vanishing with it.
 *   `withGhostTiers(nodes)` — whether doors are produced for a real graph.
 *
 * Delete either behaviour and this file REDS. That is the property the old one
 * lacked.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Node } from '@xyflow/react'
import {
  frontierFor,
  withGhostTiers,
  isGhostNode,
  GHOST_TIERS,
  POST_ANALYSIS_TIERS,
} from '../../utils/ghostTiers'

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

/** A model with every tier populated — the shape the density claim is about. */
function richModel(): Node[] {
  const at = (id: string, type: string, label: string, x: number): Node =>
    ({ id, type, position: { x, y: 0 }, data: { label } }) as Node
  return [
    at('d1', 'decision', 'Replace our CDP', 0),
    at('o1', 'option', 'Segment', 0),
    at('f1', 'factor', 'Migration cost', 0),
    at('r1', 'risk', 'Migration overruns', 0),
    at('x1', 'outcome', 'Analytics restored', 0),
  ]
}

const tiersOf = (nodes: Node[]) =>
  nodes.filter((n) => isGhostNode(n.id)).map((d) => (d.data as { tier?: string }).tier).sort()

describe('the frontier survives the answer, and changes its questions', () => {
  it('is unchanged before an analysis — the case that already worked', () => {
    // ⚠ THE OPPOSITE-DIRECTION TWIN. The post-analysis fix must not be bought
    // by regressing the phase that was never broken, so this asserts IDENTITY
    // with the shipped set rather than merely "four of something".
    const { tiers, usesLegacyOptionDoor } = frontierFor('idle')
    expect(tiers).toBe(GHOST_TIERS)
    expect(tiers).toHaveLength(4)
    expect(usesLegacyOptionDoor).toBe(true)
  })

  it('APPEARS after an analysis — the defect this file previously PINNED as correct', () => {
    // The assertion that stood here was `frontierIsVisible('complete',
    // 'standard') === false`, measured live at `65866cd7` as 0 doors against 13
    // real nodes at zoom 1.0. It was pinned deliberately, flagged as a product
    // question, and this is the answer to it.
    expect(frontierFor('complete').tiers.length).toBeGreaterThan(0)
  })

  it('asks the POST-ANALYSIS questions: options and risks, not factors and outcomes', () => {
    expect(frontierFor('complete').tiers.map((t) => t.siblingType).sort()).toEqual([
      'option',
      'risk',
    ])
  })

  it('DENSITY: the frontier after a result is strictly SMALLER than before one', () => {
    // The bar this change was held to — a canvas more useful and no busier.
    // Asserted as an inequality rather than as `=== 2`, so it keeps biting if
    // either set is resized later.
    expect(frontierFor('complete').tiers.length).toBeLessThan(frontierFor('idle').tiers.length)
  })

  it('DENSITY, at the doors rather than at the tier list', () => {
    // The count above is of tier DEFINITIONS. This is the thing a user sees:
    // real nodes in, real doors out, on a model that populates every tier.
    const before = tiersOf(withGhostTiers(richModel(), frontierFor('idle').tiers))
    const after = tiersOf(withGhostTiers(richModel(), frontierFor('complete').tiers))
    expect(before).toEqual(['factor', 'option', 'outcome', 'risk'])
    expect(after).toEqual(['option', 'risk'])
  })

  it('is not a constant — the two phases do not return the same frontier', () => {
    // Guards the failure mode this whole file exists to correct. The predicate
    // it replaced was pinned the same way; a `frontierFor` that ignored its
    // argument would satisfy every individually-plausible assertion above.
    expect(frontierFor('complete').tiers).not.toBe(frontierFor('idle').tiers)
  })

  it('VIEW MODE NO LONGER DECIDES — it is not an argument at all', () => {
    // The old gate returned false for `('complete', 'standard')` and true for
    // `('complete', 'expert')`: whether a team could ask "what might we be
    // missing?" turned on how much numeric detail they had asked to see.
    // Asserting arity is what stops a second parameter being reintroduced
    // quietly — a behavioural test cannot see an argument nobody passes.
    expect(frontierFor).toHaveLength(1)
  })

  it('only a COMPLETE run switches frontiers — a failed or in-flight one does not', () => {
    // Bound to the real `ResultsStatus` union (`resultsStore.ts:26`). A
    // cancelled or errored run leaves no result to interrogate, so the
    // model-completion questions remain the right ones.
    for (const status of ['idle', 'preparing', 'connecting', 'streaming', 'error', 'cancelled']) {
      expect(frontierFor(status).tiers).toBe(GHOST_TIERS)
    }
    expect(frontierFor('complete').tiers).toBe(POST_ANALYSIS_TIERS)
  })

  it('the post-analysis option door does NOT come from the legacy node', () => {
    // `GhostOptionNode` hardcodes "Suggest an additional option I haven't
    // considered for this decision" and cannot vary it, so an option door
    // routed through it post-analysis would silently drop the reframing.
    expect(frontierFor('complete').usesLegacyOptionDoor).toBe(false)
  })
})

describe('the post-analysis prompts are about the RESULT, not about the model', () => {
  const ctx = { namedSiblings: ['Segment', 'Rudderstack'], siblingCount: 2, subject: 'Replace our CDP' }
  const promptFor = (tiers: readonly { siblingType: string; prompt: (c: typeof ctx) => string }[], t: string) =>
    tiers.find((x) => x.siblingType === t)!.prompt(ctx)

  it('differs from the pre-analysis prompt for the SAME tier', () => {
    // The set change alone would be satisfied by post-analysis doors that ask
    // the identical pre-analysis question. This is what proves the reframing
    // actually shipped, and it fails if either sentence is copied onto the
    // other.
    for (const tier of ['option', 'risk']) {
      expect(promptFor(POST_ANALYSIS_TIERS, tier)).not.toEqual(promptFor(GHOST_TIERS, tier))
    }
  })

  it('states the run as a fact and still ends in a question', () => {
    // The file's standing line: report what is demonstrably there, then ASK.
    // "I have run an analysis" is exactly the `results.status === 'complete'`
    // that selected this set; neither sentence may assert the result is wrong.
    for (const tier of ['option', 'risk']) {
      const p = promptFor(POST_ANALYSIS_TIERS, tier)
      expect(p).toContain('I have run an analysis')
      expect(p.trim().endsWith('?')).toBe(true)
    }
  })

  it('still carries the model inventory — specificity is not lost in the reframe', () => {
    // CONTRAST CONTROL for the two assertions above: they would both pass on a
    // generic sentence that mentioned an analysis and ended in a question mark.
    // This binds the prompt to THIS model by identity.
    expect(promptFor(POST_ANALYSIS_TIERS, 'option')).toContain('Segment, Rudderstack')
    expect(promptFor(POST_ANALYSIS_TIERS, 'option')).toContain('Replace our CDP')
  })

  it('every post-analysis door is a challenge, every pre-analysis door an extension', () => {
    expect(POST_ANALYSIS_TIERS.every((t) => t.variant === 'challenge')).toBe(true)
    expect(GHOST_TIERS.every((t) => t.variant === 'extend')).toBe(true)
  })

  it('the variant reaches the rendered node, not just the tier table', () => {
    // A variant nothing carries onto the node decides nothing — the
    // `enableGhostSuggestions` shape this file was rewritten to stop repeating.
    const doors = withGhostTiers(richModel(), POST_ANALYSIS_TIERS).filter((n) => isGhostNode(n.id))
    expect(doors).toHaveLength(2)
    expect(doors.every((d) => (d.data as { variant?: string }).variant === 'challenge')).toBe(true)
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
 * Everything above calls `frontierFor()` and `withGhostTiers()` directly.
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
   * Without it, `/frontierFor\s*\(/` matches a call sitting inside a
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

  it('invokes frontierFor', () => {
    expect(source()).toMatch(/frontierFor\s*\(/)
  })

  it('does NOT still call the gate this change replaced', () => {
    // A leftover `frontierIsVisible` call would mean two authorities deciding
    // one thing — the shape that produced the leader-claim seam. It is deleted
    // from `ghostTiers.ts`, so a surviving call would not compile; this asserts
    // it at the mount anyway, because the typecheck gate is the thing most
    // likely to be routed around.
    expect(source()).not.toMatch(/frontierIsVisible\s*\(/)
  })

  it('invokes withGhostTiers', () => {
    expect(source()).toMatch(/withGhostTiers\s*\(/)
  })

  it('POSITIVE CONTROL: the same probe finds a symbol that is genuinely absent', () => {
    // Proves the two assertions above can FAIL. Without it, a regex that never
    // matches anything would pass them both by matching nothing — the exact
    // vacuity that let the previous version of this file stay green while the
    // prop it asserted decided nothing.
    expect(source()).not.toMatch(/frontierForV99Fabricated\s*\(/)
    expect(source()).toMatch(/withGhostTiers\s*\(/)
  })
})
