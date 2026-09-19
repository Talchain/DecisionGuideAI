/**
 * ⭐⭐ THE REFERENCE AND THE SELF-TEST MUST CAPTURE THE SAME WAY, OR THE NUMBER
 * BETWEEN THEM IS NOT PRODUCT DRIFT.
 *
 * `e2e/visual/selftest.visual.spec.ts` drives the state that
 * `fresh-draft--1440x900` was captured from and diffs its own screenshot
 * against that committed reference. It reports the result as "drift from
 * reference (unmodified)", and the whole visual job's calibration rests on that
 * number being small.
 *
 * For eleven days it was not. The reference is written by `captureState`, which
 * waits for three identity anchors to be VISIBLE before it freezes the page.
 * The self-test's helper waited for none of them. Measured 4 Sep 2026,
 * immediately after a re-bless that WORKED (drift 5.4851% → 0.4060%, a 13-fold
 * improvement): a residual floor of 5,262 px survived, against a self-test
 * assertion needing it under 64.8 px. **81× over, on a reference blessed that
 * same day** — so re-blessing could never close it, and four separate attempts
 * to fix this job by re-blessing were doomed before they started.
 *
 * ⚠ THE MECHANISM, because "it waits less" is not sufficient to explain it.
 * `waitForVisualQuiescence` samples the bounding boxes of
 * `[data-testid], .react-flow__node` and returns once N consecutive samples
 * agree. On a page whose nodes have not mounted, that sample is EMPTY — every
 * sample agrees with the last, and it reports quiescence instantly, on a blank
 * board. The anchor wait is what guarantees there is something to be quiet
 * about. So the two paths did not differ by a margin of patience; one of them
 * could return before the product existed.
 *
 * ⚠⚠ WHY THIS GUARD LIVES HERE AND NOT IN THE VISUAL SUITE. `Visual Regression
 * (advisory)` is `continue-on-error: true` and is absent from `Staging Gate`'s
 * `needs`. A guard inside it cannot stop anything. This file runs in the
 * ordinary vitest shards, which ARE required — so a future divergence reds a
 * gate that actually blocks. (CLAUDE.md trap 7: an advisory red is
 * indistinguishable from a broken one, and this job spent two weeks proving it.)
 *
 * ⚠ ASSERTED OVER CODE WITH COMMENTS STRIPPED. A `toContain` against raw source
 * is a value predicate that a comment satisfies — and the prose above names
 * every symbol this file checks for, so an unstripped assertion here would pass
 * on a tree where the code had been deleted entirely. That exact vacuity was
 * found in a sibling spec this week; it is not repeated here, and the stripping
 * has its own positive control below.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')
const HARNESS = join(ROOT, 'e2e', 'visual', 'harness.ts')
const SELFTEST = join(ROOT, 'e2e', 'visual', 'selftest.visual.spec.ts')
const STATES = join(ROOT, 'e2e', 'visual', 'states.visual.spec.ts')

/** Strip block comments, line comments and string-free whitespace lines. */
function codeOnly(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter(l => !l.trim().startsWith('//'))
    .join('\n')
}

const harness = readFileSync(HARNESS, 'utf8')
const selftest = readFileSync(SELFTEST, 'utf8')
const states = readFileSync(STATES, 'utf8')

describe('the two visual capture paths bind one anchor source', () => {
  it('POSITIVE CONTROL: the comment stripper removes prose but keeps code', () => {
    const sample = '/* FRESH_DRAFT_ANCHORS in prose */\nconst x = FRESH_DRAFT_ANCHORS\n// FRESH_DRAFT_ANCHORS again\n'
    const stripped = codeOnly(sample)
    expect(
      (stripped.match(/FRESH_DRAFT_ANCHORS/g) ?? []).length,
      'the stripper must leave exactly the one CODE occurrence — otherwise every assertion below is measuring prose',
    ).toBe(1)
  })

  it('POSITIVE CONTROL: the three files were read and are substantive', () => {
    for (const [name, src] of [['harness', harness], ['selftest', selftest], ['states', states]] as const) {
      expect(src.length, `${name} read as empty — this guard would pass on a missing file`).toBeGreaterThan(2_000)
    }
  })

  it('harness exports one anchor list and one wait, in code', () => {
    const code = codeOnly(harness)
    expect(code, 'FRESH_DRAFT_ANCHORS is not exported as code').toMatch(/export\s+const\s+FRESH_DRAFT_ANCHORS\s*=/)
    expect(code, 'waitForAnchors is not exported as code').toMatch(/export\s+async\s+function\s+waitForAnchors\s*\(/)
  })

  it('⭐ BOTH capture paths call waitForAnchors with the shared constant', () => {
    for (const [name, src] of [['selftest', selftest], ['states', states]] as const) {
      const code = codeOnly(src)
      expect(
        code,
        `${name} does not reference FRESH_DRAFT_ANCHORS in code — if it has gone back to a hand-copied anchor list, the two captures can drift apart again and the drift number stops meaning product change`,
      ).toContain('FRESH_DRAFT_ANCHORS')
    }
    expect(
      codeOnly(selftest),
      'the self-test no longer calls waitForAnchors — its capture can then be taken before the board has mounted, because quiescence on an empty page is instant',
    ).toMatch(/await\s+waitForAnchors\s*\(/)
  })

  it('the self-test waits for anchors BEFORE it freezes motion', () => {
    const code = codeOnly(selftest)
    const anchorAt = code.indexOf('await waitForAnchors(')
    const freezeAt = code.indexOf('await freezeMotion(')
    expect(anchorAt, 'waitForAnchors call not found in code').toBeGreaterThan(-1)
    expect(freezeAt, 'freezeMotion call not found in code').toBeGreaterThan(-1)
    expect(
      anchorAt,
      'freezeMotion runs before the anchor wait — the page would be pinned mid-layout and the anchors would then pass against a frozen intermediate state, which is the ordering captureState deliberately avoids',
    ).toBeLessThan(freezeAt)
  })

  it('captureState still routes through the shared wait rather than its own loop', () => {
    const code = codeOnly(harness)
    expect(
      code,
      'captureState no longer calls waitForAnchors — if it has re-inlined its own anchor loop, the self-test is once again matching a lookalike instead of the real path',
    ).toMatch(/await\s+waitForAnchors\s*\(\s*page\s*,\s*opts\.anchors\s*\)/)
  })
})
