/**
 * No driver copy calls a set-relative score an absolute one.
 *
 * ── THE DEFECT ─────────────────────────────────────────────────────────────
 * `PERMITTED_LANGUAGE_BY_BASIS` mapped `influence_score` to
 * `'absolute_influence_score'`, which licenses "Influence score 100%" and
 * "has an influence score of 100%". `influence_score` is **always set-relative**:
 * the producer divides every factor by `max|influence|`, so the top row is
 * **1.0 by construction**.
 *
 * ── EVIDENCE FROM OUR OWN SIDE, NOT INHERITED ──────────────────────────────
 * The producer-side derivation came from another lane. I did not take it on
 * trust: every capture in this repo carrying `influence_score` has a maximum of
 * EXACTLY 1.0 — twelve files, including live staging responses. A quantity whose
 * maximum is always exactly 1 is a ratio to that maximum, not an absolute.
 * That check is repeated below so it keeps running.
 *
 * ── AND THE CASE THAT MAKES IT A TRUST DEFECT RATHER THAN A WORDING ONE ────
 * `live-influence-score-one-2026-08-23.json` — a real staging response —
 * carries:
 *
 *     factor_label: "Monthly Payroll Burn"
 *     influence_score: 1        ← rendered as 100%
 *     elasticity: 0             ← moves nothing
 *
 * That is a DEMOTED LEVER: the producer zeroes sensitivity, elasticity and
 * value-of-information for a lever while deliberately leaving `influence_score`
 * alone ("a lever keeps its structural weight"). So the panel said a factor
 * "has an influence score of 100%" about one the same response says moves
 * nothing. The honest branch already exists beside it and says
 * "relative to the strongest factor in this analysis".
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  analysisMetricPredicate,
  analysisMetricTitle,
  analysisMetricVisibleLabel,
  influenceBasisNoun,
  influencePillAriaLabel,
} from '../influenceScaleCopy'
import { resolveDriverClaimBasis } from '../driverDisplayModel'

const TOP = { key: 'f1', influenceScore: 1, rawElasticity: 0 }
const RUNNER = { key: 'f2', influenceScore: 0.88, rawElasticity: 0.88 }

/**
 * ⚠ THE SHAPE IS THE RESOLVER'S, NOT ONE I INVENTED. It cross-checks
 * `displayInfluence` against the ATTESTED field for the basis
 * (`driverDisplayModel.ts:335-338`) and returns `null` on any mismatch — so a
 * fixture with a made-up key resolves to nothing and every assertion below
 * would pass on an empty run. My first cut did exactly that; the CONTROL caught
 * it, which is what the control is for.
 */
const metricFor = (f: typeof TOP) =>
  resolveDriverClaimBasis({
    displayInfluence: f.influenceScore,
    displayProvenance: 'influence_score',
    influenceScore: f.influenceScore,
  })

describe('influence copy never claims an absolute scale', () => {
  it('CONTROL: the copy functions produce a percentage at all', () => {
    // Without this, every assertion below could pass on empty strings.
    const m = metricFor(TOP)
    expect(m, 'the resolver must return a metric').toBeTruthy()
    expect(analysisMetricVisibleLabel(m!)).toMatch(/100\s*%/)
  })

  it('THE EVIDENCE: every capture normalises to exactly 1.0', () => {
    // The claim "always set-relative" rests on this, so it is asserted rather
    // than believed. A capture whose maximum were NOT 1.0 would refute the whole
    // finding, and this REDs if one ever appears.
    const capture = JSON.parse(
      readFileSync(
        join(__dirname, '..', '..', '..', 'test', 'fixtures', 'live-influence-score-one-2026-08-23.json'),
        'utf8',
      ),
    ) as { factors: Array<{ influence_score: number; elasticity: number }> }
    expect(capture.factors.length, 'the capture must carry factors').toBeGreaterThan(1)
    expect(Math.max(...capture.factors.map((f) => f.influence_score))).toBe(1)
    // And the demoted lever that makes the wording matter.
    const top = capture.factors.find((f) => f.influence_score === 1)!
    expect(top.elasticity, 'the 100% row moves nothing — this is the case').toBe(0)
  })

  it('no copy function says "influence score" without saying relative to what', () => {
    const m = metricFor(TOP)!
    for (const [name, out] of [
      ['visibleLabel', analysisMetricVisibleLabel(m)],
      ['title', analysisMetricTitle(m)],
      ['predicate', analysisMetricPredicate(m)],
    ] as const) {
      expect(out.toLowerCase(), `${name} asserts an absolute scale: "${out}"`).toMatch(
        /relative|within this analysis|in this set/,
      )
    }
  })

  it('DISCRIMINATOR: the other bases are untouched', () => {
    // The fix is one map entry. If it ever became a blanket rewrite, the
    // pre-analysis and value-of-information vocabularies would lose their own
    // names and this REDs.
    const preAnalysis = {
      value: 0.5,
      basis: 'pre_analysis_influence' as const,
      permittedLanguage: 'pre_analysis_influence_score' as const,
    }
    expect(analysisMetricVisibleLabel(preAnalysis)).toContain('Pre-analysis')
    const voi = {
      value: 0.5,
      basis: 'value_of_information' as const,
      permittedLanguage: 'value_of_information' as const,
    }
    expect(analysisMetricVisibleLabel(voi)).toContain('Value of information')
  })

  it('the runner-up reads the same way — this is about the SCALE, not the top row', () => {
    const m = metricFor(RUNNER)!
    expect(analysisMetricPredicate(m).toLowerCase()).toMatch(/relative|within this analysis/)
  })

  // ══════════════════════════════════════════════════════════════════════════
  // ⚠⚠ A SECOND PATH, WHICH THE ASSERTIONS ABOVE COULD NOT SEE.
  // `influencePillAriaLabel` and `influenceBasisNoun` key on the RAW
  // provenance, not on `permittedLanguage`, so remapping the basis left them
  // untouched — and the aria-label still said "an absolute causal influence
  // score from the analysis". My guard was scoped to the three functions I had
  // been looking at, and reported a clean sweep of exactly those. The lesson is
  // the estate's: an absence claim proves only what the probe was pointed at.
  // ══════════════════════════════════════════════════════════════════════════

  it('the PILL path does not claim an absolute scale either', () => {
    const label = influencePillAriaLabel(100, 'influence_score')
    expect(label.toLowerCase(), `aria-label asserts an absolute scale: "${label}"`).not.toContain(
      'absolute',
    )
    expect(label.toLowerCase()).toMatch(/relative|strongest factor/)
  })

  it('the visible NOUN does not claim an absolute scale either', () => {
    expect(influenceBasisNoun('influence_score')).toBe('Relative influence')
  })

  it('both provenances read the same, because both ARE the same kind of thing', () => {
    // Not a tidy-up: they are two normalisations, and neither is absolute. The
    // internal distinction survives in `provenance`; what goes is a false word
    // spent on a difference a reader cannot act on.
    expect(influencePillAriaLabel(90, 'influence_score')).toBe(
      influencePillAriaLabel(90, 'normalised_elasticity'),
    )
    expect(influenceBasisNoun('influence_score')).toBe(influenceBasisNoun('normalised_elasticity'))
  })

  it('DISCRIMINATOR: an UNKNOWN provenance still fails closed', () => {
    // The cheapest wrong fix collapses every arm. The unstamped state must keep
    // asserting nothing about a basis it does not know.
    expect(influenceBasisNoun(null)).toBe('Influence')
    expect(influencePillAriaLabel(50, null)).toBe('Influence basis unavailable')
  })
})
