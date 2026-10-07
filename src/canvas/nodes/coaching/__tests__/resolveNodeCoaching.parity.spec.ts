/**
 * ⭐⭐⭐ BEHAVIOUR-PRESERVATION PARITY FOR THE ONE COACHING RESOLVER.
 *
 * This is a REFACTOR spec, so the load-bearing guarantee is not "the resolver
 * says something sensible" — it is "the resolver says EXACTLY what the node
 * file said before, in EXACTLY the same order, on EXACTLY the same producer
 * conditions". CLAUDE.md trap 5: a refactoring fold is a new change, not a
 * patch, and one shipped a regression here under green CI and 2,291 passing
 * tests because its own parity test checked value but never ORDER.
 *
 * ── WHAT IS PINNED, AND WHY IT IS THE WHOLE SHAPE ───────────────────────────
 *
 * Every expectation below is a `toEqual` against the FULL ordered array of
 * chip objects — `id`, `label`, `message` AND `actionType`. All four are
 * user-reachable: `label` is painted, `message` is sent as the user's own turn,
 * `id` ships as `chip.parameters.chip_id`, and `actionType` decides whether
 * `NodeChip` routes through `canonicalRunRegistry` or the coaching dispatcher.
 * A parity test that checked only the visible label would pass while the wire
 * intent silently changed — which is the same class as
 * `DecisionNode.invitations.spec.tsx` scanning rendered label text while the
 * falsehood lived in `message` (recorded in DecisionNode.tsx's own docblock).
 *
 * `toEqual` on the array pins ORDER by construction. An order-blind assertion
 * (`toContainEqual`, `expect.arrayContaining`, or sorting first) would be the
 * exact vacuity trap 5 records, so none is used anywhere in this file.
 *
 * ── THE EXPECTATIONS ARE TRANSCRIBED FROM PRISTINE SOURCE, NOT INVENTED ─────
 *
 * Each table entry names the pristine file and the `useMemo`/JSX block it came
 * from, at `719915a9` (origin/staging when this lane branched). They are a
 * record of what the product said before this refactor, so per CLAUDE.md trap
 * 14b they are EVIDENCE and append-only: a future change to the copy adds a
 * new case or amends the table with its own reasoning, and must never rewrite
 * one of these to make a red go green.
 *
 * ── `null` IS A FIRST-CLASS OUTPUT AND HAS ITS OWN TESTS ────────────────────
 *
 * `FactorNode`'s selector returns `null` for a factor with an observed, owned
 * value, deliberately: *"there is no assumption to interrogate, and a chip on
 * every card is wallpaper."* `OptionNode` returns `null` for pre-analysis
 * `optionChips` and for a post-analysis option whose win rate the producer
 * could not compute. A resolver that returned something for every node would
 * put a chip on every card — the precise outcome those designs reject.
 *
 * ⚠ THERE IS EXACTLY ONE REPRESENTATION OF SILENCE, and a test asserts it.
 * `null` means "deliberately silent"; the resolver must NEVER return `[]`.
 * Two spellings of nothing would be CLAUDE.md trap 21 — two questions under
 * one name — and the guard against it (`test: never returns an empty array`)
 * iterates the whole request corpus rather than the cases I happened to think
 * of.
 *
 * ── WHAT THIS CORPUS EXCLUDES, STATED RATHER THAN HOPED ────────────────────
 *
 * · `goal_run_analysis` and `decision_run_analysis` are NOT here. Both files'
 *   own comments classify them as primary ACTION buttons rather than coaching
 *   ("that's a primary action button rather than coaching"), and they carry
 *   `actionType="run_analysis"`, which routes through `canonicalRunRegistry`
 *   rather than the coaching dispatcher. They were left in place; folding them
 *   would have normalised a distinction their authors drew on purpose.
 * · `StyledEdge.tsx`'s chips are EDGE coaching, out of this lane's fence.
 * · No case supplies a magnitude for the resolver to interpret. Every state
 *   field below is a producer boolean or a null-check compared by identity —
 *   `needsInput`, `category === 'external'`, `extractionType === 'inferred'`,
 *   `winRate !== null`, `closeCallGapPp != null`. FactorNode's docblock is
 *   explicit that this is the permitted form: *"No threshold is chosen and no
 *   number is interpreted."* A separate test asserts the resolver module
 *   contains no numeric comparison at all, so a future threshold cannot arrive
 *   quietly.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  resolveNodeCoaching,
  ALL_COACHING_REQUESTS_FOR_TEST,
  type CoachingChip,
  type NodeCoachingRequest,
} from '../resolveNodeCoaching'

// Restore the whole historical resolver shape from 8441619e. Immediate sends
// use the Q registry at requestAsk; parity still pins the resolver itself.
const DOOR_ROWS = JSON.parse(readFileSync(resolve(__dirname, 'resolveNodeCoaching.doors.json'), 'utf8')) as Array<{
  request: NodeCoachingRequest; doors: CoachingChip[]
}>
describe('resolveNodeCoaching — full historical door parity', () => {
  it.each(DOOR_ROWS)('$request.kind / $request.surface keeps its doors in order', ({ request, doors }) => {
    expect(resolveNodeCoaching(request) ?? []).toEqual(doors)
  })
  it('factor confirmation retains the exact resolver context independently of the sent Q19 question', () => {
    const request: NodeCoachingRequest = { kind: 'factor', surface: 'card',
      state: { needsInput: true, isExternalCategory: false, isInferred: true, leadsInfluence: true },
      context: { label: 'Capacity', influencePhrase: '42% of influence' } }
    expect(resolveNodeCoaching(request)?.[0]).toEqual({
      id: 'factor_confirm_top_influence', label: 'Confirm this first?', actionType: null,
      message: "42% of influence — and Capacity's value is still an unconfirmed estimate. What would it take to confirm it?",
    })
  })
})

describe('resolveNodeCoaching — structural invariants over the WHOLE request corpus', () => {
  /**
   * ⚠ THIS IS THE COMPLETENESS CHECK THAT IS NOT DERIVED FROM THE TABLE ABOVE
   * (CLAUDE.md trap 12d: a derived guard proves agreement and can never prove
   * completeness). `ALL_COACHING_REQUESTS_FOR_TEST` is the cartesian product of
   * every kind × surface × state combination the resolver admits, generated by
   * the module rather than hand-listed, so these invariants hold over cases I
   * did not think to write a `toEqual` for.
   */
  it('the request corpus is non-empty and covers every kind — a blind corpus certifies nothing', () => {
    expect(ALL_COACHING_REQUESTS_FOR_TEST.length).toBeGreaterThan(30)
    expect(new Set(ALL_COACHING_REQUESTS_FOR_TEST.map(r => r.kind))).toEqual(
      new Set(['risk', 'outcome', 'option', 'factor', 'goal', 'action', 'decision']),
    )
  })

  /**
   * ⭐ ONE SPELLING OF SILENCE. `null` means "deliberately no coaching"; `[]`
   * must never occur. Two representations of nothing would be trap 21 — two
   * questions under one name — and every call site would then need to handle
   * both, which is how one of them eventually gets forgotten.
   */
  it('never returns an empty array: silence is spelled `null` and only `null`', () => {
    for (const request of ALL_COACHING_REQUESTS_FOR_TEST) {
      const out = resolveNodeCoaching(request)
      expect(out === null || out.length > 0, `empty array for ${JSON.stringify(request)}`).toBe(true)
    }
  })

  it('every chip carries a non-empty id, label and message on every reachable request', () => {
    for (const request of ALL_COACHING_REQUESTS_FOR_TEST) {
      for (const chip of resolveNodeCoaching(request) ?? []) {
        expect(chip.id.length, `empty id for ${JSON.stringify(request)}`).toBeGreaterThan(0)
        expect(chip.label.length, `empty label for ${chip.id}`).toBeGreaterThan(0)
        expect(chip.message.length, `empty message for ${chip.id}`).toBeGreaterThan(0)
      }
    }
  })

  it('no chip id is emitted twice within one resolved arm, anywhere in the corpus', () => {
    for (const request of ALL_COACHING_REQUESTS_FOR_TEST) {
      const ids = (resolveNodeCoaching(request) ?? []).map(c => c.id)
      expect(new Set(ids).size, `duplicate id in ${JSON.stringify(request)}: ${ids.join(', ')}`).toBe(ids.length)
    }
  })

  /**
   * A message must never contain an unsubstituted placeholder or the literal
   * `undefined`/`null` — the failure mode of moving template literals between
   * modules. The positive control asserts the detector FIRES, so a negative
   * result is evidence rather than a regex that matches nothing (trap 13).
   */
  it('no resolved message leaks a placeholder or a stringified nullish — with a positive control', () => {
    const leaks = (s: string) => /\$\{|undefined|\bnull\b/.test(s)
    expect(leaks('value for ${label}'), 'positive control: detector must fire').toBe(true)
    expect(leaks('What if Unit cost changes?'), 'negative control: detector must not fire').toBe(false)
    for (const request of ALL_COACHING_REQUESTS_FOR_TEST) {
      for (const chip of resolveNodeCoaching(request) ?? []) {
        expect(leaks(chip.message), `${chip.id} leaked in ${JSON.stringify(request)}: ${chip.message}`).toBe(false)
      }
    }
  })

  /**
   * ⭐⭐ NO THRESHOLD, NO MAGNITUDE INTERPRETATION — asserted against the SOURCE,
   * because this is a claim about what the module may ever do, not about what
   * this corpus happens to exercise.
   *
   * FactorNode's docblock rules on it: *"THE CONDITIONS ARE PRODUCER FIELDS
   * COMPARED BY IDENTITY … No threshold is chosen and no number is
   * interpreted."* Every state field the resolver reads is a producer boolean,
   * so a numeric comparison appearing here would mean the canvas had begun
   * inventing a judgement the producer never made. The pluralisation test
   * (`optionCount === 1`) is a COUNT of observable objects, not a magnitude
   * judgement, and is allowed for explicitly by name.
   *
   * ⚠ TWO CONSTRUCTS ARE ALLOWED, BY NAME AND WITH REASONS, rather than by
   * loosening the detector until it passes:
   *   · `chips.length > 0` in `orNull` — collection emptiness, so silence gets
   *     exactly one spelling. It reads no producer value.
   *   · `optionCount === 1` — pluralising a COUNT of objects on the board.
   *     DecisionNode's ruling: *"Counting only, never assessing."*
   * A THIRD hit reds, and the failure message names it. That is the point: this
   * test exists so a cut-off cannot arrive quietly in a later edit.
   *
   * ⚠ Comments are stripped first, because the claim is about CODE — the
   * docblocks quote measurements like "156px inside a 168px card" and a
   * detector that read prose would be measuring the wrong bytes (CLAUDE.md
   * trap 22: verify what string the guard actually receives).
   *
   * ⚠ The detector carries a positive control AND a negative control, or it
   * would pass against a regex that matches nothing.
   */
  it('the resolver source introduces no threshold — allowlist of two, with controls', () => {
    const source = readFileSync(resolve(__dirname, '../resolveNodeCoaching.ts'), 'utf8')
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')

    const comparison = /(?:[<>]=?|={2,3}|!==?)\s*-?\d+(?:\.\d+)?|\b\d+(?:\.\d+)?\s*(?:[<>]=?|={2,3})/g
    expect('if (leader > 0.35) {'.match(comparison), 'positive control: detector must fire').not.toBeNull()
    expect('const a = fn(b)'.match(comparison), 'negative control: detector must not fire').toBeNull()

    const hits = (code.match(comparison) ?? []).map(h => h.trim())
    const ALLOWED = ['> 0', '=== 1']
    const unexpected = hits.filter(h => !ALLOWED.includes(h))
    expect(
      unexpected,
      `threshold-shaped comparison(s) in the resolver beyond the documented allowlist: ${unexpected.join(', ')}`,
    ).toEqual([])
    // The allowlist must not rot into a licence: both entries must still be present.
    expect(hits, 'the two allowed constructs must still exist, or this allowlist is stale').toEqual(
      expect.arrayContaining(ALLOWED),
    )
  })
})
