/**
 * WITNESSED COPY RULINGS - the two draft-path strings driven on a deployed build.
 *
 * WHY THIS FILE IS A MANIFEST AND NOT A SWEEP. A repo-wide sweep finds 237
 * `the result` literals and 759 em dashes across the estate. Fixing by grep is
 * how this keeps failing: two PRs on 10 Sep 2026 each satisfied one ruling
 * while breaching another, and a third rewrote three strings nobody renders
 * while leaving the most-rendered ones untouched. Both strings governed here
 * were witnessed RENDERING at the DOM on a fresh guest journey against
 * deployed `2fbadee3`. Nothing is added on the strength of a grep hit.
 *
 * THE RULING (Paul, raised numerous times):
 *   NO EM DASHES in product copy. Split into sentences or cut. An em dash is
 *   where a hedge gets bolted on; tight, not waffly.
 *
 * SCOPE, AND WHY IT IS THIS NARROW. This guard originally governed nine
 * strings. Seven of them lived on the ANALYSIS tab (`src/components/results/`,
 * excluding `analysisNew/`), which Paul ruled OUT OF SCOPE on 7 Sep 2026:
 * "you shouldn't touch anything on the analysis. You should just be looking to
 * improve reasoning and the model tabs" - because Reasoning may SUPERSEDE
 * Analysis, so work on the older surface may be deleted rather than shipped.
 * Those seven were reverted. Verified at the deployed build: none of them
 * renders on the Reasoning tab, so none was salvageable as in-scope work.
 *
 * The two that remain are NOT on any tab. They render on the fresh-user draft
 * path, before a tab is chosen, so the scope ruling does not reach them.
 *
 * WHAT THIS GUARD DOES NOT DO. It does not ban em dashes repo-wide, and it
 * pins NO string it is not fixing - newly freezing a breach verbatim in a spec
 * is its own defect. It binds BY IDENTITY (a named export, a named entry in a
 * declared stage list) so a rewording fails loudly rather than sliding past a
 * predicate some other string could satisfy.
 *
 * RUNG. This reads SOURCE, so it earns CODE EXISTS, never MOUNTED. The
 * mounted-surface evidence is the live journey named above; the behaviour-bound
 * pins live beside the components (`DraftLoadingAnimation.spec.ts`,
 * `aiPanelV2.polish.spec.tsx`).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const DRAFT_ANIM = 'src/canvas/components/DraftLoadingAnimation.tsx'
const FIRST_MODEL = 'src/canvas/components/FirstModelNotice.tsx'

/**
 * Read-only control source. NOT governed and NOT edited by this change - it is
 * on the out-of-scope Analysis tab. It carries em dashes in its COMMENTS, which
 * no user reads, and is used here solely as a standing presence the detector
 * must be able to find.
 */
const EM_DASH_PRESENCE_CONTROL = 'src/components/results/ConditionalWinnerCards.tsx'

const GOVERNED = [DRAFT_ANIM, FIRST_MODEL] as const

/** U+2014. */
const EM_DASH = '—'

const read = (f: string) => readFileSync(f, 'utf8')

/**
 * Every extraction asserts its anchor was FOUND before it asserts anything
 * about what it extracted. A regex that matches nothing returns `null`, and a
 * guard built on `null` agrees with every other guard that also extracted
 * nothing - an absence probe with no positive control.
 */
function must(src: string, re: RegExp, what: string): RegExpMatchArray {
  const m = src.match(re)
  expect(m, `ANCHOR LOST: ${what} - this guard can no longer see the string it governs`).toBeTruthy()
  return m as RegExpMatchArray
}

describe('the guard can see what it claims to govern', () => {
  it('every governed file is tracked and substantial', () => {
    for (const f of GOVERNED) {
      expect(execFileSync('git', ['ls-files', f], { encoding: 'utf8' }).trim(), `${f} is not tracked`).toBe(f)
      expect(read(f).length, `${f} is too small to be the real file`).toBeGreaterThan(500)
    }
  })

  it('POSITIVE CONTROL - the em-dash detector is not blind', () => {
    // Without this, every `not.toContain(EM_DASH)` below could pass by testing
    // nothing if EM_DASH were the wrong codepoint.
    expect(EM_DASH).toHaveLength(1)
    expect(EM_DASH.codePointAt(0)).toBe(0x2014)
    expect(
      read(EM_DASH_PRESENCE_CONTROL),
      'the detector found no em dash where one certainly exists',
    ).toContain(EM_DASH)
  })
})

describe('draft-path copy carries no em dash', () => {
  it('(1) the 45-second drafting line - the first sentence a new user reads on a slow draft', () => {
    const msg = must(
      read(DRAFT_ANIM),
      /\{ afterSeconds: 45,\s*message: '([^']*)' \}/,
      'PROGRESSIVE_STAGES 45s entry',
    )[1]
    expect(msg).not.toContain(EM_DASH)
    expect(msg).toBe('Still drafting. Complex decisions can take a while…')
  })

  it('(2) the first-model notice - SUBSTANCE PRESERVED, punctuation only', () => {
    // THIS LINE IS THE HUMAN-IS-THE-AUTHOR FRAMING and is the reason the notice
    // exists. Both clauses are asserted verbatim so a future "tidy-up" cannot
    // quietly drop the half that does the work.
    const copy = must(
      read(FIRST_MODEL),
      /export const FIRST_MODEL_NOTICE_COPY =\s*'([^']*)'/,
      'FIRST_MODEL_NOTICE_COPY',
    )[1]
    expect(copy).not.toContain(EM_DASH)
    expect(copy).toContain('This is a first model, not a conclusion')
    expect(copy).toContain('Nothing in it carries your judgement yet')
    expect(copy).toBe('This is a first model, not a conclusion. Nothing in it carries your judgement yet.')
  })
})
