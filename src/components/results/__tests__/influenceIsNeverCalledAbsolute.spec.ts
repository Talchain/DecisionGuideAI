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
 * trust — but the sentence that used to sit here overstated what was measured,
 * and a reviewer refuted it with a counterexample already in this tree.
 *
 * ⚠⚠ WITHDRAWN: "every capture in this repo carrying `influence_score` has a
 * maximum of EXACTLY 1.0 — twelve files". Two errors. The count was wrong (21
 * JSON files under `src/` carry the field, not twelve), and the universal was
 * false: `src/lib/coherence/__tests__/fixtures/captures/seeded-2026-08-17-w2d-analysis-turn.json`
 * is a real `response_version: 2` analysis turn whose three factors all carry
 * `influence_score: 0` (one stamped `input_quality: "degenerate_fallback"`).
 * Its maximum is 0.
 *
 * WHAT IS ACTUALLY MEASURED, and it is now DERIVED by the sweep below rather
 * than asserted in prose: of the JSON files under `src/` carrying the field,
 * EVERY ONE whose maximum is non-zero maxes at EXACTLY 1.0; none exceeds 1.0;
 * and none sits strictly between 0 and 1. Exactly one file is all-zero, and the
 * sweep names it. A quantity that is either exactly 1 at its top or uniformly
 * zero is a ratio to its own maximum, not an absolute — and the degenerate run
 * is the case where there is no maximum to be a ratio to, which is why the
 * panel fails closed there rather than claiming a 100% top row.
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
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
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

const SRC_ROOT = join(__dirname, '..', '..', '..')

/** Every `*.json` under `src/`, walked rather than listed (no hand-kept mirror). */
function jsonFilesUnderSrc(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) jsonFilesUnderSrc(full, out)
    else if (entry.isFile() && entry.name.endsWith('.json')) out.push(full)
  }
  return out
}

/** Every numeric `influence_score` anywhere in a parsed payload, at any depth. */
function collectInfluenceScores(node: unknown, out: number[] = []): number[] {
  if (Array.isArray(node)) {
    for (const v of node) collectInfluenceScores(v, out)
  } else if (node !== null && typeof node === 'object') {
    const rec = node as Record<string, unknown>
    if (typeof rec.influence_score === 'number') out.push(rec.influence_score)
    for (const v of Object.values(rec)) collectInfluenceScores(v, out)
  }
  return out
}

/**
 * The corpus, DERIVED at the tip the test runs on. Returns one row per JSON file
 * under `src/` that actually carries a numeric `influence_score`, plus the
 * all-zero subset — so the finding and the sentence describing it are the same
 * object.
 */
function sweepInfluenceScoreCaptures(): {
  files: Array<{ path: string; count: number; max: number }>
  allZero: string[]
} {
  const files: Array<{ path: string; count: number; max: number }> = []
  for (const full of jsonFilesUnderSrc(SRC_ROOT)) {
    const raw = readFileSync(full, 'utf8')
    // Cheap pre-filter, then parse. A file that names the field but will not
    // parse is a HARD ERROR, never a silent skip: a swallowed parse failure
    // would shrink the corpus and make every universal below easier to satisfy.
    if (!raw.includes('"influence_score"')) continue
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch (err) {
      throw new Error(`${relative(SRC_ROOT, full)} names influence_score but does not parse: ${String(err)}`)
    }
    const values = collectInfluenceScores(parsed)
    if (values.length === 0) continue
    files.push({ path: relative(SRC_ROOT, full), count: values.length, max: Math.max(...values) })
  }
  return {
    files,
    allZero: files.filter((f) => f.max === 0).map((f) => f.path).sort(),
  }
}

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

  it('THE EVIDENCE: no capture exceeds 1.0, and every non-zero one tops out at exactly 1.0', () => {
    /**
     * ⚠ THIS TEST USED TO READ ONE FILE AND ITS NAME CLAIMED THE WHOLE CORPUS
     * ("every capture normalises to exactly 1.0"). A reviewer refuted the claim
     * with a file the test never opened. The sweep is now DERIVED — it walks
     * `src/` — so the sentence and the measurement cannot drift apart, and it
     * REDs if the corpus ever contradicts either half of the finding.
     */
    const { files, allZero } = sweepInfluenceScoreCaptures()

    // POSITIVE CONTROL + MAGNITUDE. A sweep that found nothing would satisfy
    // every universal below vacuously; a sweep that found four files when the
    // tree holds twenty-one is a blind instrument reporting on itself. The
    // floor is checked against the count derived at this tip (21).
    expect(files.length, 'the sweep found no captures at all — the probe is blind').toBeGreaterThanOrEqual(20)

    // THE FINDING, stated as exactly what is measured.
    for (const f of files) {
      expect(f.max, `${f.path} exceeds 1.0 — influence_score is not a ratio to its own maximum`).toBeLessThanOrEqual(1)
      if (f.max > 0) {
        expect(f.max, `${f.path} tops out strictly between 0 and 1`).toBe(1)
      }
    }

    // AND THE COUNTEREXAMPLE, PINNED BY NAME rather than glossed over. A real
    // response_version 2 turn whose every influence_score is 0: there is no
    // maximum for the others to be a ratio to, which is the degenerate state the
    // panel fails closed on (DriversSection, gate Q3). The set is asserted
    // EXACTLY, so it REDs if it grows OR shrinks.
    expect(allZero).toEqual([
      'lib/coherence/__tests__/fixtures/captures/seeded-2026-08-17-w2d-analysis-turn.json',
    ])
  })

  it('THE CASE: the demoted lever the wording is about', () => {
    const capture = JSON.parse(
      readFileSync(
        join(__dirname, '..', '..', '..', 'test', 'fixtures', 'live-influence-score-one-2026-08-23.json'),
        'utf8',
      ),
    ) as { factors: Array<{ influence_score: number; elasticity: number }> }
    expect(capture.factors.length, 'the capture must carry factors').toBeGreaterThan(1)
    expect(Math.max(...capture.factors.map((f) => f.influence_score))).toBe(1)
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
