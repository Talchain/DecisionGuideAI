/**
 * The panel never prints an influence figure as an absolute share.
 *
 * ── THE DEFECT, AND IT IS THE ROOT CAUSE OF A SCREENSHOT ───────────────────
 * Paul witnessed **"Structural influence 100%"** on the deployed panel and I
 * told Primary the UI was faithfully printing an absolute 1.0 the producer had
 * sent. **That was wrong.** The producer sends a SET-RELATIVE 1.0 — it divides
 * every factor by `max|influence|`, so the top row is 1.0 by construction: of
 * the 21 JSON files under `src/` carrying the field, every one whose maximum is
 * non-zero maxes at exactly 1.0 and none exceeds it (one real degenerate turn is
 * uniformly 0 — narrowed 6 Sep 2026 from a universal a reviewer refuted). The
 * absolute claim is made HERE.
 *
 * ── THE PREDICATE IS INVERTED AGAINST ITS OWN STATED RULE ──────────────────
 * `driverFinding` carries the rule three lines above the branch:
 *
 *   "Under a set-relative basis this says 'among the strongest in this run' —
 *    a RANK claim. It never says 'drives N% of the outcome', which would be an
 *    absolute causal share the basis does not license."
 *
 * Correct. But the flag deciding it was
 *
 *   setRelative = rows.some((d) => d.displayProvenance !== 'influence_score')
 *
 * — FALSE exactly when every row IS `influence_score`. So the run where the
 * basis is set-relative for ALL rows took the ABSOLUTE branch. The rule was
 * right and the predicate implementing it was upside down.
 *
 * Measured by execution before this spec was written: two rows on
 * `influence_score` at 1.0 and 0.88 produced `Structural influence 100%.` and
 * `Structural influence 88%.`, with the relativity caveat suppressed.
 *
 * ── WHAT MUST NOT COLLAPSE ─────────────────────────────────────────────────
 * The SCALE question ("is this a share of the outcome?") is now answered the
 * same way for both provenances, because both are set-relative. The GROUNDING
 * question ("which quantity is this?") is NOT — `influence_score` and
 * `normalised_elasticity` are different measurements, and saying so is honest.
 * Two questions; only one of them had a wrong answer.
 */
import { describe, expect, it } from 'vitest'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { makeData, makeDriver } from './analysisNewFixtures'

const build = (provenances: readonly string[]) => {
  const rows = provenances.map((p, i) =>
    makeDriver({
      factorKey: `f${i}`,
      factorLabel: `Factor ${i}`,
      displayInfluence: i === 0 ? 1 : 0.88,
      displayProvenance: p as never,
    }),
  )
  return buildAnalysisNewViewModel({
    data: makeData({
      drivers: {
        drivers: rows,
        topDrivers: rows,
        driversStatus: 'computed',
        totalCount: rows.length,
        hasMagnitudeData: true,
      },
    } as never),
    recommendations: [],
    isPreRun: false,
    isRunning: false,
    isStale: false,
    responseHash: 'abc123',
  }).drivers
}

describe('the scale claim matches the scale', () => {
  it('CONTROL: the fixture produces findings at all', () => {
    // Without this every assertion below passes over an empty list — and my
    // first probe DID produce zero drivers, because the fixture option is a
    // section object and I passed a bare array. The count caught it.
    const d = build(['influence_score', 'influence_score'])
    expect(d.findings.length, 'no findings — the guard would be vacuous').toBe(2)
  })

  it('THE WITNESSED STRING: a producer-basis run never says "Structural influence N%"', () => {
    const d = build(['influence_score', 'influence_score'])
    const implications = d.findings.map((f) => String(f.implication ?? ''))
    expect(
      implications.filter((s) => /Structural influence \d+%/.test(s)),
      `an absolute share on a set-relative basis: ${implications.join(' | ')}`,
    ).toEqual([])
  })

  it('THE FIGURE SURVIVES — only the false noun goes', () => {
    /**
     * ⚠ THIS ASSERTED THE RANK CLAIM AND WAS WRONG TO. My first fix dropped the
     * percentage entirely, and `buildAnalysisNewViewModel.spec.ts` caught it —
     * it carries an opposite-direction twin arguing "the figure is what a BAR
     * LENGTH cannot state — a bar is a rank comparison, never a number — so it
     * must survive". Removing a true number to remove a false noun is a bad
     * trade, and that spec existed precisely to stop it.
     *
     * The property is: the number stays, and the noun stops claiming a share.
     */
    const d = build(['influence_score', 'influence_score'])
    const top = String(d.findings[0]!.implication)
    expect(top, 'the figure a bar cannot state').toMatch(/\d+%/)
    expect(top).toContain('Relative influence')
  })

  it('the relativity caveat is NOT suppressed on a producer-basis run', () => {
    // The caveat — "Influence is relative to the other factors in this run, not
    // a share of the outcome" — was gated on the same inverted flag, so it went
    // missing on exactly the runs that needed it.
    expect(build(['influence_score', 'influence_score']).influenceIsSetRelative).toBe(true)
  })

  it('DISCRIMINATOR: the GROUNDING still distinguishes the two quantities', () => {
    // The scale is the same; the measurement is not. Collapsing both would
    // trade a false claim for a vague one.
    const producer = build(['influence_score', 'influence_score']).findings[0]!
    const elasticity = build(['normalised_elasticity', 'normalised_elasticity']).findings[0]!
    expect(String(producer.groundedIn)).toContain('structural influence score')
    expect(String(elasticity.groundedIn)).toContain('sensitivity')
    expect(producer.groundedIn).not.toBe(elasticity.groundedIn)
  })

  it('DISCRIMINATOR: a mixed list is still set-relative, as it always was', () => {
    // The pre-existing behaviour this must not regress: one row on a different
    // basis made the whole list set-relative, and still does.
    expect(build(['influence_score', 'normalised_elasticity']).influenceIsSetRelative).toBe(true)
  })

  it('an EMPTY list asserts nothing either way', () => {
    expect(build([]).influenceIsSetRelative).toBe(false)
    expect(build([]).findings).toEqual([])
  })
})
