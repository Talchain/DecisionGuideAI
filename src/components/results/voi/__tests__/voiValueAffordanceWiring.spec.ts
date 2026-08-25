/**
 * ⚠ WRITTEN BECAUSE A MUTANT SURVIVED, and the mutant was a real hole.
 *
 * The act's whole honesty property lives at the CALLER: the hero component only
 * renders the wording `valueAffordance` tells it, and the caller is what decides
 * that. Mutating the caller to a constant left the component suite 7/7 GREEN.
 *
 * ⭐ WHAT THE CONSTANT NOW COSTS HAS CHANGED, AND BOTH DIRECTIONS ARE LIVE.
 * A constant `'review'` promises a value the destination may not display (a FALSE
 * PROMISE); a constant `'set'` tells a user to set a value that is already there
 * (a false statement about their own model). The old boolean's failure was
 * asymmetric — only over-offering was priced — which is exactly why it was
 * replaced. Both directions are asserted below.
 *
 * A component spec cannot see its caller. So this asserts the wiring structurally:
 * the resolver must consult the ONE exported authority, by name, and must not
 * hand back a constant.
 *
 * WHAT THIS CANNOT SEE: a caller that imports the authority and then ignores its
 * result. That would need the hook under test, which is not proportionate here —
 * so it is named rather than implied.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const CALLER = 'src/components/results/useResultsSectionData.ts'
// The destination's OWN display projection. NOT `factorHasConfirmableValue`:
// that answers "may the authority stamp a confirmation?" and reads
// `observedState.value`, while the mounted row displays via `raw_value`. Binding
// the wording to the wrong one is the defect this suite now guards.
const AUTHORITY = 'factorDisplaysValue'
const KIND_AUTHORITY = 'resolveNodeTypeLiteral'

describe('valueAffordance is decided by the destination\'s own projection', () => {
  const source = readFileSync(CALLER, 'utf8')

  it('the caller is tracked and readable (positive control)', () => {
    const tracked = execFileSync('git', ['ls-files', CALLER], { encoding: 'utf8' }).trim()
    expect(tracked, `${CALLER} is not tracked — this guard would read a stale or absent file`).toBe(CALLER)
    expect(source.length).toBeGreaterThan(1000)
  })

  it('imports the authority rather than re-spelling the predicate', () => {
    expect(
      new RegExp(`import\\s*\\{[^}]*\\b${AUTHORITY}\\b`).test(source),
      `${CALLER} must import ${AUTHORITY}. Five surfaces once answered this question `
        + 'four ways; that module exists to end it, and a local re-spelling would restart it.',
    ).toBe(true)
  })

  it('consults it when resolving a voi row, and does not hand back a constant', () => {
    // The resolver block, bounded so an unrelated use elsewhere cannot satisfy this.
    const start = source.indexOf('resolveLabel: (factorId)')
    expect(start, 'the voi resolveLabel resolver was not found — has it been renamed?').toBeGreaterThan(-1)
    // ⚠ WIDE ON PURPOSE. The resolver carries a long correction comment above the
    // code; a window that stops short of the code reads as "authority absent" and
    // this guard would fail for the wrong reason — or, if the assertions were
    // inverted, pass while seeing nothing. Asserted non-empty and containing the
    // return, so a future comment cannot silently push the code out of view.
    const block = source.slice(start, start + 6000)
    expect(block.includes('valueAffordance:'), 'the resolver window does not reach the returned object — widen it').toBe(true)

    expect(
      block.includes(`${AUTHORITY}(`),
      `the voi resolver must call ${AUTHORITY}; without it the "review" wording can be `
        + 'used on a factor whose row displays nothing — an act describing something '
        + 'that is not there.',
    ).toBe(true)

    expect(
      block.includes(`${KIND_AUTHORITY}(`),
      `the voi resolver must check node kind via ${KIND_AUTHORITY}; the write authority `
        + 'returns \'not_encodable\' for a non-factor one line above the predicate this '
        + 'resolver used to borrow, so offering an act there is a button that does nothing.',
    ).toBe(true)

    /*
     * ⭐ THE GUARD MUST BITE, NOT MATCH ONE SPELLING.
     *
     * The first version of this assertion was `/valueAffordance:\s*'(review|set|none)'\s*,/`
     * — and it was EVADED BY THE IDIOM THIS FILE'S OWN SUBJECT USES. The resolver
     * writes `('none' as const)`; the regex required a bare quoted literal followed
     * by a comma, so a parenthesised `as const`, a double-quoted value, or a final
     * property with no trailing comma all slipped past. The mutant that motivated
     * this whole spec would have survived if written in the house style.
     *
     * So the pattern is widened AND SELF-TESTED: the corpus below is spellings a
     * constant could plausibly take, and the guard must catch EVERY one. If a
     * future edit narrows the pattern, the corpus REDs rather than the guard
     * silently ceasing to discriminate (CLAUDE.md 13b — a control whose power is
     * unpinned at rest).
     */
    const CONSTANT_SPELLINGS = [
      "valueAffordance: 'review',",
      "valueAffordance: 'set',",
      'valueAffordance: "none",',
      "valueAffordance: 'none' as const,",
      "valueAffordance: ('none' as const),",
      "valueAffordance:   'review'  ,",
      "valueAffordance: 'set'",
      "valueAffordance: ('review' as const)",
    ]
    const CONSTANT_RE = /valueAffordance\s*:\s*\(?\s*['"](?:review|set|none)['"]/

    for (const spelling of CONSTANT_SPELLINGS) {
      expect(
        CONSTANT_RE.test(spelling),
        `the anti-constant guard does not catch \`${spelling}\` — it would let a `
          + 'hard-coded affordance through in that spelling, which is how the '
          + 'original mutant survived.',
      ).toBe(true)
    }

    // A DERIVED value must NOT trip it — otherwise the guard is unfalsifiable.
    expect(CONSTANT_RE.test("valueAffordance: factorDisplaysValue(node?.data) ? 'review' : 'set',")).toBe(false)

    expect(
      CONSTANT_RE.test(block),
      'valueAffordance must be derived, never a literal. A constant `review` promises a '
        + 'value the row may not display; a constant `set` tells a user to set one that '
        + 'is already there. Both are false statements about their own model.',
    ).toBe(false)
  })
})
