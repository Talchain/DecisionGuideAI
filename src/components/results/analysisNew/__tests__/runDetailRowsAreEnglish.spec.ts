/**
 * No wire token reaches the "Deeper analysis" rows.
 *
 * ── THE DEFECT ─────────────────────────────────────────────────────────────
 * Five rows printed the producer's own vocabulary verbatim:
 *
 *     Analysis status                 partial
 *     Drivers status                  skipped
 *     Robustness status               not_assessed
 *     Result completeness             partial
 *     Not included in this result     win_probability, sensitivity
 *
 * ── WHY THIS IS THE SAME DEFECT TWICE, AND WHY THAT MATTERS ────────────────
 * The gap-code group on this same surface was fixed days ago, and the copy file
 * states outright (`analysisNewCopy.ts:743-748`) that an unrecognised
 * completeness key is "DROPPED rather than shown raw". That is TRUE of the
 * status ribbon and FALSE here: this row joins the raw array. One rule, two
 * consumers, one of which never got it — so the guard below asserts the
 * PROPERTY over every row the capture in this file emits
 * (`manyFragileEdges()`), not over the five strings I happened to be shown.
 * That capture does not emit the `Not included in this result` row itself;
 * that row is pinned by identity in `missingResultsNamedInWords.spec.tsx`.
 *
 * ── THE LABELS ARE NOT INVENTED ────────────────────────────────────────────
 * `missingResultLabels` already maps the closed completeness vocabulary to what
 * this surface calls those things, and the ribbon already uses it. This makes
 * the second consumer read the same map, rather than minting a second one.
 */
import { describe, expect, it } from 'vitest'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { makeData, manyFragileEdges } from './analysisNewFixtures'

/**
 * A lowercase wire token, with or without underscores.
 *
 * ⚠ TWO WRONG VERSIONS BEFORE THIS ONE, IN OPPOSITE DIRECTIONS, AND THE PAIR IS
 * THE LESSON.
 *
 * (1) Required an underscore — so `computed` and `full`, the two a healthy run
 *     actually prints, sailed past it. Written against the failure I had been
 *     shown (`not_assessed`, `win_probability`).
 * (2) Fixed that by naming the five mapped tokens in an alternation — which
 *     made the pattern a MIRROR OF `plainStatus`'s MAP rather than of the
 *     producer's vocabulary. Review found the hole: `failed`, `blocked`,
 *     `error` and `suppressed` are real enum members that map to nothing, so
 *     they matched neither branch and would have been waved through by the very
 *     guard that exists to catch a row bypassing `plainStatus`.
 *
 * The property is "no producer vocabulary reaches a value cell", and producer
 * vocabulary is lowercase-only — so that is what the pattern says. Every
 * humanised output is title-cased or is a phrase with spaces, both of which
 * this rejects; the assertions below pin that in both directions.
 */
const WIRE_TOKEN = /^[a-z][a-z0-9]*(_[a-z0-9]+)+$|^[a-z]+$/

/**
 * One of the exceptions in the set below. `Run reference` is an opaque support handle
 * — a hash. It is not producer vocabulary being read as English, and rendering
 * it is the row's whole point.
 */
const OPAQUE_ROWS = new Set([
  'Run reference',
  'Seed',
  // ⚠ NAMED, NOT PATTERN-MATCHED. `'yes, provisional'` is ordinary English whose
  // parts are indistinguishable from wire tokens. Exempting the ROW keeps the
  // pattern honest about the class it detects, instead of carving a hole in it
  // that also lets four real producer tokens through — which is what the
  // previous attempt did.
  'Automatic noise applied',
  'Some factors unassessed',
])

const deeperOf = (data: ReturnType<typeof makeData>) =>
  buildAnalysisNewViewModel({
    data,
    recommendations: [],
    isPreRun: false,
    isRunning: false,
    isStale: false,
    responseHash: 'run_x',
  }).deeper

describe('the run-detail rows speak English', () => {
  it('CONTROL: the fixture produces deeper-analysis rows at all', () => {
    // Without this, every assertion below passes over an empty list — the
    // shape that makes an absence claim vacuous.
    const groups = deeperOf(manyFragileEdges()).groups
    const total = groups.reduce((n, g) => n + g.rows.length, 0)
    expect(total, 'no rows to inspect — the guard would be vacuous').toBeGreaterThan(3)
    // ⚠ AND THE ROWS THE DEFECT LIVED IN, BY NAME. A row count alone would let
    // this pass over a fixture that never produces a status row at all, which
    // is an absence probe pointed at nothing.
    const labels = groups.flatMap((g) => g.rows.map((r) => r.label))
    for (const needed of ['Analysis status', 'Drivers status', 'Result completeness']) {
      expect(labels, `fixture must produce "${needed}"`).toContain(needed)
    }
  })

  it('no VALUE is a snake_case wire token', () => {
    const offenders = deeperOf(manyFragileEdges())
      .groups.flatMap((g) => g.rows.map((r) => ({ label: r.label, value: String(r.value ?? '') })))
      .filter((r) => !OPAQUE_ROWS.has(r.label))
      .filter((r) => r.value.split(/,\s*/).some((part) => WIRE_TOKEN.test(part.trim())))
    expect(
      offenders.map((r) => `${r.label} = ${r.value}`),
      'producer vocabulary rendered verbatim',
    ).toEqual([])
  })

  it('DISCRIMINATOR: the probe would SEE a wire token if one were there', () => {
    // Proves the regex is not simply failing to match anything. If this ever
    // stops matching, the assertion above is measuring nothing.
    expect(WIRE_TOKEN.test('win_probability')).toBe(true)
    expect(WIRE_TOKEN.test('not_assessed')).toBe(true)
    // The two the healthy run actually prints, and the two my first pattern missed.
    expect(WIRE_TOKEN.test('computed')).toBe(true)
    expect(WIRE_TOKEN.test('full')).toBe(true)
    // ⚠ The four the SECOND pattern missed: real enum members that `plainStatus`
    // does not map, so a mirror-of-the-map pattern waved them through.
    for (const t of ['failed', 'blocked', 'error', 'suppressed']) {
      expect(WIRE_TOKEN.test(t), `"${t}" is producer vocabulary`).toBe(true)
    }
    expect(WIRE_TOKEN.test('the win share')).toBe(false)
    /**
     * ⚠⚠ THIS BLOCK CARRIED A DESCRIPTION OF THE SUPERSEDED PATTERN, under a
     * file header that contradicted it. It said the pattern "catches snake_case OR the five
     * status tokens by name" — the SECOND of three attempts, and the one whose
     * hole let `failed`, `blocked`, `error` and `suppressed` through. Removed
     * on review; the header carries the full three-attempt history once.
     *
     * `'yes, provisional'` is a legitimate value whose parts ARE ordinary
     * lowercase words, so the pattern matches each of them by design. What must
     * not flag it is the ROW, and the exemption is by LABEL in `OPAQUE_ROWS` —
     * visible and named, rather than a hole carved in a pattern pretending to be
     * general.
     */
    expect(WIRE_TOKEN.test('yes')).toBe(true)
    expect(WIRE_TOKEN.test('Partial')).toBe(false)
    expect(WIRE_TOKEN.test('Not assessed')).toBe(false)
  })

  it('no row renders an EMPTY value', () => {
    // `String(undefined ?? '')` produced a row with a label and a blank cell —
    // a heading pointing at nothing, which reads as a rendering failure.
    const blanks = deeperOf(manyFragileEdges())
      .groups.flatMap((g) => g.rows)
      .filter((r) => String(r.value ?? '').trim() === '')
    expect(blanks.map((r) => r.label), 'a labelled row with no value').toEqual([])
  })
})
