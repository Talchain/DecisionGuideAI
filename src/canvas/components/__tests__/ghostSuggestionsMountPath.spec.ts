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
 * The functions that actually decide, called directly:
 *
 *   `frontierFor(resultsStatus)` — WHICH frontier is on screen. It replaced a
 *      `frontierIsVisible(resultsStatus, viewMode)` gate that removed every
 *      door after an analysis outside Expert view; the questions now change
 *      with the phase instead of the doors vanishing with it.
 *   `withGhostTiers(nodes)` — whether doors are produced for a real graph.
 *   `composeFrontier(nodes, resultsStatus)` — ⭐ THE WHOLE MOUNT PATH, and the
 *      one this file previously approximated instead of calling. See the
 *      "doors the MOUNT actually produces" block for what that cost.
 *
 * Delete any of those behaviours and this file REDS. That is the property the
 * old one lacked.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Node } from '@xyflow/react'
import {
  frontierFor,
  composeFrontier,
  withGhostTiers,
  isGhostNode,
  GHOST_TIERS,
  GHOST_OPTION_NODE_ID,
  POST_ANALYSIS_TIERS,
} from '../../utils/ghostTiers'
import type { GhostPromptContext, GhostTier } from '../../utils/ghostTiers'

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

/**
 * ⭐⭐ THE DOORS THE MOUNT ACTUALLY PRODUCES — the M4 repair.
 *
 * ── WHAT WAS WRONG, MEASURED ──
 *
 * This file's density claim used to be `withGhostTiers(richModel(), GHOST_TIERS)`
 * — i.e. `withGhostTiers` called with its DEFAULT tier set. The mount never did
 * that. It filtered the option tier OUT (`t.siblingType !== 'option'`) and
 * supplied the option door separately, as the legacy `ghost-option` node with
 * `data: {}`. `withGhostTiers` was called with its default set nowhere in the
 * product — only here.
 *
 * ⚠ THE CONSEQUENCE, PROVEN BY MUTATION: deleting the legacy option door from
 * the mount left **46/46 GREEN**. Pre-analysis would have gone from 4 doors to
 * 3 — losing the OPTION door, the most valuable tier and the one the whole
 * frontier grew out of — and nothing in this suite would have moved. A spec
 * green about a path the canvas does not take is this estate's signature test
 * defect, and it was sitting in the file written to end exactly that.
 *
 * ── THE REPAIR ──
 *
 * The composition moved out of `ReactFlowGraph`'s `useMemo` into
 * `composeFrontier`, and every count below calls THAT. The mount and the spec
 * are now the same function, so there is no second path left to drift — which
 * is a stronger property than any additional assertion against the old split.
 *
 * These are also the COUNT assertions the review found missing (F1): the
 * pre-analysis frontier's content was pinned byte-for-byte, but nothing said
 * how many doors it produced.
 */
describe('the doors the MOUNT actually produces', () => {
  const doorsOf = (nodes: Node[]) => nodes.filter((n) => isGhostNode(n.id))
  /**
   * Which tier a door belongs to, ACROSS BOTH DOOR KINDS.
   *
   * ⚠ THE LEGACY NODE CARRIES NO `tier` — its `data` is literally `{}`, which
   * is precisely why the deleted `tiersOf` helper (which read `data.tier` and
   * nothing else) could not see it, and why deleting the door was invisible.
   * Its tier is carried by its TYPE instead.
   */
  const tierKeyOf = (n: Node) =>
    n.type === 'ghost-option' ? 'option' : ((n.data as { tier?: string }).tier ?? '(none)')

  it('PRE-ANALYSIS: FOUR doors, one per tier — the count, not just the content', () => {
    const doors = doorsOf(composeFrontier(richModel(), 'idle'))
    expect(doors).toHaveLength(4)
    expect(doors.map(tierKeyOf).sort()).toEqual(['factor', 'option', 'outcome', 'risk'])
  })

  it('PRE-ANALYSIS: the option door is the LEGACY node, and deleting it REDS here', () => {
    // ⭐ THIS IS THE ASSERTION THAT WAS MISSING. The mutant is
    // `withGhostTiers([...nodes, ghostNode], tierGhosts)` →
    // `withGhostTiers(nodes, tierGhosts)`: one argument, four doors to three,
    // previously 46/46 green.
    //
    // Bound by IDENTITY — id AND node type — not by "there are some doors".
    // The type matters on its own: routing this door through `ghost-tier`
    // would silently make it model-aware, which is a real improvement and a
    // SEPARATE change, so a quiet swap should red rather than pass.
    const optionDoors = doorsOf(composeFrontier(richModel(), 'idle')).filter(
      (n) => n.id === GHOST_OPTION_NODE_ID,
    )
    expect(optionDoors).toHaveLength(1)
    expect(optionDoors[0].type).toBe('ghost-option')
  })

  it('PRE-ANALYSIS: THE MOUNT PATH ITSELF — no tier is served twice', () => {
    // ⚠ THIS IS THE "assert the mount path so the binding fails loud if a tier
    // filter moves" half. Drop `tiers.filter(t => t.siblingType !== 'option')`
    // and the option tier is served BOTH by the legacy node and by
    // `withGhostTiers` — two React Flow nodes sharing `GHOST_OPTION_NODE_ID`.
    // The count assertion above cannot see that on its own (it would read 5 and
    // could be "fixed" by loosening it); a duplicate-id assertion can.
    const doors = doorsOf(composeFrontier(richModel(), 'idle'))
    expect(new Set(doors.map((n) => n.id)).size).toBe(doors.length)
    expect(doors.filter((n) => tierKeyOf(n) === 'option')).toHaveLength(1)
  })

  it('POST-ANALYSIS: TWO doors, both model-aware, and the legacy node is gone', () => {
    // The headline capability, at the mount rather than at the tier table. The
    // mutant this closes is the post-analysis branch returning `nodes`
    // unchanged — the exact defect this PR exists to fix, previously invisible.
    const doors = doorsOf(composeFrontier(richModel(), 'complete'))
    expect(doors).toHaveLength(2)
    expect(doors.map(tierKeyOf).sort()).toEqual(['option', 'risk'])
    expect(doors.every((n) => n.type === 'ghost-tier')).toBe(true)
    // ⚠ MODEL-AWARE, BOUND PER DOOR BY IDENTITY. My first attempt here asserted
    // every door named 'Segment' and RED — correctly: the risk door names the
    // RISKS. A door that named another tier's members would be describing the
    // wrong part of the model back to the user, so each is bound to its own.
    const promptOf = (tier: string) =>
      (doors.find((n) => tierKeyOf(n) === tier)!.data as { prompt?: string }).prompt ?? ''
    expect(promptOf('option')).toContain('Segment')
    expect(promptOf('risk')).toContain('Migration overruns')
    // CONTRAST CONTROL: not merely "contains some label" — the wrong tier's
    // members must be ABSENT, which is what makes the two lines above bind.
    expect(promptOf('option')).not.toContain('Migration overruns')
    expect(promptOf('risk')).not.toContain('Segment')
    // And both are the post-analysis sentence, not the pre-analysis one.
    expect(promptOf('option')).toContain('I have run an analysis')
    expect(promptOf('risk')).toContain('I have run an analysis')
  })

  it('DENSITY AT THE MOUNT: the frontier after a result is strictly smaller', () => {
    // The bar this change was held to — more useful and no busier — measured
    // in doors a user would get rather than in tier definitions.
    expect(doorsOf(composeFrontier(richModel(), 'complete')).length).toBeLessThan(
      doorsOf(composeFrontier(richModel(), 'idle')).length,
    )
  })

  it('CONTRAST CONTROL: a model with no options still gets its other doors', () => {
    // The global `if (optionNodes.length === 0) return nodes` that used to
    // swallow every tier's door. Without this, the counts above are equally
    // satisfied by a mount that gives up whenever options are absent — which is
    // the sparse, early-stage model the frontier is worth most on.
    const noOptions = richModel().filter((n) => n.type !== 'option')
    const doors = doorsOf(composeFrontier(noOptions, 'idle'))
    expect(doors.map(tierKeyOf).sort()).toEqual(['factor', 'outcome', 'risk'])
    expect(doors.map(tierKeyOf)).not.toContain('option')
  })

  it('leaves the real model untouched — every input node survives, in order', () => {
    const input = richModel()
    const out = composeFrontier(input, 'complete')
    expect(out.filter((n) => !isGhostNode(n.id)).map((n) => n.id)).toEqual(input.map((n) => n.id))
  })

  it('ADDS NOTHING TO THE MODEL: every door is unselectable and undraggable', () => {
    for (const status of ['idle', 'complete']) {
      for (const door of doorsOf(composeFrontier(richModel(), status))) {
        expect(door.selectable).toBe(false)
        expect(door.draggable).toBe(false)
        expect(door.connectable).toBe(false)
      }
    }
  })
})

/**
 * ⭐ WHAT THE POST-ANALYSIS PROMPTS ARE DERIVED FROM — named accurately, after
 * this block asserted the reverse of what the code does.
 *
 * ⚠ THE OLD NAME WAS `the post-analysis prompts are about the RESULT, not about
 * the model`, and an independent review measured it as backwards. The prompts
 * are built from the MODEL — the tier inventory and the subject — and SELECTED
 * by the PHASE (`results.status === 'complete'`). They never read the outcome:
 * a run where one option wins by a mile and a run that ends in a dead heat emit
 * BYTE-IDENTICAL door prompts. The only result-derived content in either
 * sentence is the constant "I have run an analysis", which is a restatement of
 * the status that chose the set.
 *
 * ── THE CHOICE MADE, STATED RATHER THAN LEFT IMPLICIT ──
 *
 * The review offered two exits: rename the block to what is true, or make the
 * prompts genuinely outcome-derived (the data IS reachable — `rawV2Response`,
 * `v5AnalysisFact`). **This lane renames.** Not because the other is hard, but
 * because it is a different change with a different risk: an outcome-derived
 * sentence puts a CLAIM about the result into a message that lands in the
 * user's transcript attributed to the user, and `ghostTiers.ts`'s standing line
 * is that this file states only what is demonstrably there and asks. Crossing
 * it wants the producer's fields checked for a real producer, its own review,
 * and its own witness — not a free ride on a mount fix. Rowed, not smuggled in.
 *
 * A rename alone would be prose, so the limit is PINNED below: a prompt that
 * grew an outcome argument reds here rather than quietly making this comment
 * stale.
 */
describe('the post-analysis prompts are PHASE-derived and MODEL-derived — they do not read the outcome', () => {
  /**
   * ⚠ TYPED AS THE REAL CONTRACT, AND THAT IS THE POINT OF THIS FIXTURE.
   *
   * It read `subject: 'Replace our CDP'` — a bare string — because that WAS the
   * contract when this spec was written. #1086 then merged, making the subject a
   * `ModelSubject { label, noun }` so a goal would stop being announced to the
   * user as a decision. On rebase the post-analysis door began emitting
   * **"The undefined is: undefined."** into a real user's transcript.
   *
   * ⛔ TYPECHECK COULD NOT SEE IT. `prompt: (c: typeof ctx) => string` typed the
   * callback from the FIXTURE rather than from the contract, so the fixture
   * defined its own truth and agreed with itself — the shape CLAUDE.md trap 13b
   * describes. Annotating with the real `GhostPromptContext` is what makes the
   * next contract change RED at the type checker instead of at a user.
   */
  const ctx: GhostPromptContext = {
    namedSiblings: ['Segment', 'Rudderstack'],
    siblingCount: 2,
    subject: { label: 'Replace our CDP', noun: 'decision' },
  }
  const promptFor = (tiers: readonly GhostTier[], t: string) =>
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

  it('DOES NOT READ THE OUTCOME — the limit this block is named for, pinned', () => {
    // ⚠ WHAT THIS ASSERTS AND WHAT IT DOES NOT. It cannot show that two
    // opposite results produce the same sentence, because the sentence has no
    // way to see a result at all — and that absence IS the claim. So it is
    // asserted structurally, in the two places an outcome could enter:
    //
    //   (a) the prompt takes exactly ONE argument, the model context. An
    //       outcome parameter would change the arity and red here — the same
    //       instrument that stops `viewMode` returning to `frontierFor`.
    for (const t of POST_ANALYSIS_TIERS) expect(t.prompt).toHaveLength(1)
    //   (b) it is a pure function of that context: the same model gives the
    //       same sentence, so nothing outcome-shaped is being read from
    //       elsewhere (a module-level store, a global) behind the argument.
    for (const t of POST_ANALYSIS_TIERS) {
      expect(t.prompt({ ...ctx })).toEqual(t.prompt({ ...ctx }))
    }
    // CONTRAST CONTROL for (b): the sentence is not a constant either — change
    // the model and it changes. Without this, a `prompt` that ignored its
    // argument entirely would satisfy the equality above.
    expect(POST_ANALYSIS_TIERS[0].prompt({ ...ctx, siblingCount: 9 })).not.toEqual(
      POST_ANALYSIS_TIERS[0].prompt({ ...ctx }),
    )
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
 * ⭐ THE RESIDUAL GAP — SMALLER THAN IT WAS, AND STILL NAMED WHERE IT REMAINS.
 *
 * Everything above calls `composeFrontier()` directly. Since the mount's whole
 * composition now LIVES in that function, the two mutants that used to survive
 * inside `ReactFlowGraph` — deleting the legacy option door (M4), and the
 * post-analysis branch returning `nodes` (M5) — are now behavioural failures
 * up there. That is the substantive part of the close, and it came from moving
 * the code rather than from adding assertions.
 *
 * ⚠ WHAT SOURCE IS STILL THE ONLY INSTRUMENT FOR. Whether `ReactFlowGraph`
 * REACHES `composeFrontier` is a property of the mount, and nothing in this
 * repo renders `ReactFlowGraph` — both existing "mount path" specs are
 * source-text specs like this one. A rendering harness is a lane, not a line.
 *
 * So the binding is tightened as far as source can go, and the shape of the
 * remaining hole is stated precisely rather than implied to be closed:
 *
 *   PROVEN HERE  the frontier memo IS the `composeFrontier` call — not a call
 *                sitting beside a `return nodes`, not a call in a comment, and
 *                not a call whose result is discarded. The memo body is pinned
 *                as a single expression, which is why `ReactFlowGraph` is
 *                written that way and must stay that way.
 *   PROVEN HERE  the memo re-runs when the analysis status changes. Drop
 *                `resultsStatus` from the dependency array and the frontier
 *                would freeze at whatever it was when the nodes last changed —
 *                the post-analysis doors would never arrive. That is a real
 *                and quiet failure of exactly this PR's capability.
 *   NOT PROVEN   that the memo executes at runtime, i.e. that this component
 *                mounts and React evaluates it.
 *
 * ⚠ THE LAST LINE IS A DEPLOY-VERIFY OBLIGATION, NOT A TEST DEBT TO SHRUG AT.
 * `frontierFor`/`composeFrontier` returning the right doors is not evidence
 * that a user sees them, and jsdom cannot make that claim either. The rung this
 * PR reaches on merge is DEPLOYED; the claim "the frontier survives the answer"
 * is only WIRE/JOURNEY-WITNESSED once staging is driven: run an analysis to
 * completion, then read the canvas for two `[data-testid="ghost-tier-node"]`
 * doors carrying `data-variant="challenge"`, in Standard view, at zoom 1.0 —
 * the same measurement that produced the original "4 before, 0 after" finding.
 * Until that is done the capability claim stays at DEPLOYED and says so.
 */
describe('the mount still calls the function this file tests', () => {
  const GRAPH = resolve(__dirname, '../../ReactFlowGraph.tsx')

  /**
   * ⚠ COMMENTS STRIPPED, AND THIS IS THE WHOLE POINT OF THE HELPER.
   *
   * Without it, `/composeFrontier\s*\(/` matches a call sitting inside a
   * COMMENT. A review proved it by mutation on the previous shape: it replaced
   * the gate with a comment carrying the same call text plus an unconditional
   * `return nodes` — frontier completely dead, no door ever produced — and all
   * three tests below stayed GREEN. Delta pristine to dead-frontier: zero.
   *
   * It matters more now, not less: the mount's explanatory comment NAMES both
   * `composeFrontier` and `withGhostTiers`, so an unstripped read would match
   * on prose alone.
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

  it('invokes composeFrontier', () => {
    expect(source()).toMatch(/composeFrontier\s*\(/)
  })

  it('the frontier memo IS that call — not a call standing next to a dead branch', () => {
    // ⚠ THE HALF THE PREVIOUS VERSION COULD NOT REACH. The reviewer's mutant
    // was a live call PLUS an unconditional `return nodes`; "the symbol appears
    // in code" cannot see that, because both are code. Pinning the memo as a
    // single expression can: any statement body reds here.
    expect(source()).toMatch(
      /useMemo\(\s*\(\s*\)\s*=>\s*composeFrontier\s*\(\s*nodes\s*,\s*resultsStatus\s*\)\s*,/,
    )
  })

  it('the memo re-runs when the analysis completes — resultsStatus is a dependency', () => {
    // Omit it and the doors never change phase: the post-analysis frontier
    // would arrive only if the node list happened to change too. Silent, and
    // fatal to this PR's whole point.
    expect(source()).toMatch(
      /composeFrontier\s*\(\s*nodes\s*,\s*resultsStatus\s*\)\s*,[\s\S]{0,200}?\[\s*nodes\s*,\s*resultsStatus\s*\]/,
    )
  })

  it('does NOT still call the gate this change replaced', () => {
    // A leftover `frontierIsVisible` call would mean two authorities deciding
    // one thing — the shape that produced the leader-claim seam. It is deleted
    // from `ghostTiers.ts`, so a surviving call would not compile; this asserts
    // it at the mount anyway, because the typecheck gate is the thing most
    // likely to be routed around.
    expect(source()).not.toMatch(/frontierIsVisible\s*\(/)
  })

  it('COMPOSITION HAS ONE HOME — the mount does not build a door of its own', () => {
    // ⭐ THIS IS THE GUARD AGAINST M4 COMING BACK. The defect was not that the
    // legacy door was wrong; it was that it was built at a SECOND site the spec
    // could not see. If a door is ever constructed in `ReactFlowGraph` again,
    // this reds — before it has a chance to go untested.
    expect(source()).not.toMatch(/'ghost-option'|"ghost-option"/)
    expect(source()).not.toMatch(/'ghost-tier'|"ghost-tier"/)
    expect(source()).not.toMatch(/withGhostTiers\s*\(/)
    expect(source()).not.toMatch(/GHOST_OPTION_NODE_ID/)
  })

  it('POSITIVE CONTROL: the same probe finds a symbol that is genuinely absent', () => {
    // Proves the assertions above can FAIL. Without it, a regex that never
    // matches anything would pass every negative by matching nothing — the
    // exact vacuity that let the previous version of this file stay green while
    // the prop it asserted decided nothing.
    //
    // ⚠ AND THE CONTRAST HALF: the negatives above are only evidence of absence
    // if the same probe returns a HIT on a same-family symbol that is genuinely
    // present. `useMemo` is present in this file many times over.
    expect(source()).not.toMatch(/composeFrontierV99Fabricated\s*\(/)
    expect(source()).toMatch(/useMemo\s*\(/)
  })
})
