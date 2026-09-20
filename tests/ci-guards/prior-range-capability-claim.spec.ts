/**
 * ⭐⭐ "NO RANGE EDITOR IS REACHABLE ANYWHERE IN THE PRODUCT" — A CLAIM THAT WAS
 * FALSE BY NINE MINUTES, SPREAD TO FOUR FILES, AND COST TWO SESSIONS.
 *
 * ── WHAT HAPPENED ──────────────────────────────────────────────────────────
 * `d720f551` (#1454, *"the external-factor range becomes operable"*) merged at
 * 2026-09-10T22:19:53. `9c7a5caf` (#1451) merged at 22:28:39 carrying the
 * sentence *"no range editor is reachable anywhere in the product (all four
 * `prior_range_edit` mount paths are dead)"*. #1515 copied it into
 * `FactorControllablePanel.tsx` two days later, and a spec header took it too.
 *
 * Nobody was careless. Two lanes landed nine minutes apart and the loser's
 * premise was already stale when its commit was written — which is precisely
 * the case a review cannot catch, because the claim was true when the branch
 * was cut.
 *
 * ── WHAT IT COST ───────────────────────────────────────────────────────────
 * The Reasoning tab still ships a coaching card labelled *"Set a range"*
 * (`strengthen:lehi`) whose route reaches no range editor, and two sessions
 * re-derived the capability from scratch because the record said it did not
 * exist. A false premise in a comment is more expensive than a false premise in
 * code: code has tests.
 *
 * ── WHAT THIS GUARD DOES, AND WHY IT IS THREE THINGS AND NOT ONE ───────────
 * A comment cannot be tested, so this pins the FACT the comment was about and
 * bans the sentence that overstates it:
 *
 *   1 · POSITIVE — the external route EXISTS. If `FactorExternalPanel` stops
 *       calling `setPriorRange`, the general claim becomes true again and this
 *       guard must stop enforcing the ban. It REDs instead, so the ban is never
 *       enforced against a product where it would be wrong.
 *   2 · CONTRAST — the controllable and Model-tab routes DO NOT exist. Without
 *       this, (1) alone would be satisfied by a tree where every panel could
 *       set a range, and the narrowed claim in those files would be the stale
 *       one. The two together are what make "external only" a measurement.
 *   3 · THE BAN — no source file may assert the general form again.
 *
 * ⚠ (3) alone would be a style rule. (1) and (2) alone would pass in silence
 * while the sentence spread. This estate's own lesson: derivation proves the
 * copies agree, a corpus proves the list is right, and neither substitutes.
 */
import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = process.cwd()

/**
 * ⚠⚠ EVERY SWEEP HERE IS A `git` CALL, AND THAT IS A CORRECTION, NOT A STYLE
 * CHOICE. The first version of this guard read EVERY tracked `src/` file in
 * Node to run its ban regex. It worked, and it cost about **54 seconds** —
 * which took `Full Test Suite (shard 2/4)` from 853s to **906.81s** against a
 * **900s** step timeout, and the shard was killed before it could write its
 * artifact. The failure surfaced as "vitest-output.txt missing", i.e. it did
 * not look like a slow test at all.
 *
 * ⭐ The shard was already 5% from its limit (853 / 846 / 830 seconds measured
 * across three other PRs the same night). A guard that walks the tree in JS is
 * affordable exactly once; `git grep` and `git ls-files` do the same work in
 * one process and cost milliseconds. **The instrument must be cheap enough that
 * nobody is tempted to delete it.**
 */
function git(args: readonly string[]): string[] {
  try {
    return execFileSync('git', [...args], { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
      .split('\n')
      .filter((l) => l.length > 0)
  } catch (e) {
    // `git grep` exits 1 when it matches nothing. That is a RESULT, not a
    // failure — but any other status is a broken instrument and must not read
    // as a clean sweep.
    const status = (e as { status?: number }).status
    if (status === 1) return []
    throw e
  }
}

const callSitesOf = (rel: string, symbol: string): number =>
  readFileSync(resolve(ROOT, rel), 'utf8').split(`.${symbol}(`).length - 1

describe('the prior-range capability, measured rather than remembered', () => {
  /**
   * ⚠ POSITIVE CONTROL. An absence claim needs a presence it can see; this is
   * the presence, and it is also the precondition for the ban below.
   */
  it('EXTERNAL factors CAN have a range set — the route the record denied', () => {
    const sites = callSitesOf('src/canvas/ui/inspector-v2/panels/FactorExternalPanel.tsx', 'setPriorRange')
    expect(
      sites,
      'FactorExternalPanel no longer calls setPriorRange — if the external route has gone, the general claim is true again and the ban below must be RETIRED, not kept',
    ).toBeGreaterThan(0)
  })

  /**
   * ⛔ CONTRAST CONTROL. This is what makes the claim "external ONLY" rather
   * than "somewhere". Without it the positive above is satisfied by a tree in
   * which every panel can set a range.
   */
  it('CONTROLLABLE factors cannot, and neither can the Model tab', () => {
    expect(
      callSitesOf('src/canvas/ui/inspector-v2/panels/FactorControllablePanel.tsx', 'setPriorRange'),
      'a controllable factor gained a range editor — the notices that refuse one are now the stale claim',
    ).toBe(0)

    const modelTab = git(['ls-files', 'src/canvas/model-tab-v2/*.ts', 'src/canvas/model-tab-v2/*.tsx'])
      .filter((f) => !f.includes('__tests__'))
    expect(modelTab.length, 'the model-tab-v2 listing went blind').toBeGreaterThan(3)
    for (const f of modelTab) {
      expect(callSitesOf(f, 'setPriorRange'), `${f} now sets a prior range`).toBe(0)
    }
  })

  /**
   * ⛔ THE BAN. Bound to the general form only: a file may still say the route
   * is absent FOR ITS OWN SURFACE, which is true and load-bearing in three of
   * them. What may not return is the unqualified scope.
   *
   * ⚠ SCOPED TO PRODUCT SOURCE, AND THE EXCLUSION IS A RULING, NOT A GAP. A
   * spec header QUOTING the sentence the product once carried is a historic
   * record, and such records are append-only here — rewriting one falsifies the
   * evidence of what was believed and when (CLAUDE.md trap 14b). Three spec
   * headers quote it for exactly that reason. What may not exist is the
   * sentence ASSERTED, in a file that ships.
   *
   * ⛔ NOT A QUOTATION DETECTOR. This estate spent five rounds proving that
   * distinguishing a verdict from a quotation of one by pattern is unwinnable;
   * the same applies here. Position — which tree the file is in — is a property
   * that cannot be argued with.
   */
  it('no source file claims a range editor is reachable NOWHERE', () => {
    const offenders = git([
      'grep', '-lIiE', 'no range editor is reachable (anywhere|nowhere)',
      '--', 'src/*.ts', 'src/*.tsx',
    ]).filter((f) => !f.includes('__tests__'))
    expect(
      offenders,
      'this sentence was false by nine minutes once already; say which SURFACE cannot set a range',
    ).toEqual([])
  })

  /**
   * ⛔ CONTRAST CONTROL FOR THE BAN ITSELF, and it is load-bearing twice over:
   * a regex that matched nothing would pass the test above on any tree, AND a
   * `git grep` invocation that silently matched nothing — a bad pathspec, a
   * wrong flag — would look identical to a clean sweep.
   */
  it('PRECONDITION: the pattern still bites, and the sweep can still see files', () => {
    const banned = /no range editor is reachable (anywhere|nowhere)/i
    expect(banned.test('It is not a model failing: no range editor is reachable anywhere in the product.')).toBe(true)
    // …and is narrow enough to permit the per-surface form the files now use.
    expect(banned.test('no range editor is reachable FOR A CONTROLLABLE FACTOR')).toBe(false)
    // A same-shape sweep for a phrase that IS present, proving the pathspec and
    // the flags reach the tree at all.
    const control = git(['grep', '-lIi', 'setPriorRange', '--', 'src/*.ts', 'src/*.tsx'])
    expect(control.length, 'the git grep pathspec reaches nothing — the ban above proves nothing').toBeGreaterThan(2)
  })
})
