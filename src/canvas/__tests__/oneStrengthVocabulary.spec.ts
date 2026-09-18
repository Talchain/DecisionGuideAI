/**
 * ⭐⭐⭐ ONE STRENGTH VOCABULARY — the canvas names a connector the same way on
 * every surface, and this spec REDs when one of them stops.
 *
 * ── WHAT WAS WRONG, MEASURED AT THE BYTES ON `eb7211d7` ────────────────────
 *
 * FOUR MOUNTED tables over `|mean|`, all disagreeing — and the word MOUNTED is
 * doing the work, because this is not a count of the tables that exist. ⚠ Nor
 * is MOUNTED the same as RENDERED, which is the correction below:
 *
 *   `domain/vocabulary.getStrengthLabel`        4 words · cuts 0.70/0.40/0.20
 *   `utils/graphDisplayCalculations`            3 widths · cuts 0.70/0.40
 *   `components/CanvasLegendPopover`            3 rows · Weak/Moderate/Strong
 *   `ui/inspector/coachingText`                 5 words · cuts 0.9/0.7/0.4/0.1
 *
 * ⚠⚠ THREE MORE EXIST AND ARE **NOT** RECONCILED, ALL MEASURED DARK. An earlier
 * draft of this change recorded ONE of them and called it "a fifth", which
 * asserts it was the only leftover; it was one of three, on three different
 * sets of cuts. The full manifest — with the probe that found them, its
 * contrast control, the reachability evidence for each, and the tables
 * deliberately EXCLUDED and why — is the closing block of
 * `domain/vocabulary.ts`. It is kept in exactly one place on purpose: a count
 * copied into a second file is the hand-maintained mirror this whole change
 * exists to abolish (CLAUDE.md trap 20 — the over-read happens in the act of
 * RECORDING, and a number in a comment is what the next lane inherits).
 *
 * ⛔⛔ WHAT A USER SAW, AND WHAT THEY DID NOT — corrected 18 Sep 2026 after the
 * claim was measured rather than read. An earlier draft of this header said the
 * band pills and the coaching sentence disagreed side by side in `EdgePanel`.
 * **The sentence is DARK**: `getEffectSizeCoaching`'s only non-test call site,
 * `SignedStrengthSlider.tsx:84`, discards the result (its JSX ends on *"Value
 * display and coaching nudge removed"*, and the repo's CI typecheck baseline
 * names the dead local, `TS6133 'effectCoaching'`). Contrast control in the
 * same sweep: `getConfidenceCoaching` IS rendered at `EdgeInspector.tsx:447`.
 * A rendering claim derived from the tree is the estate's chronic failure 1,
 * and this file is where the next lane would have inherited it.
 *
 * RENDERED, and the reason this change is worth shipping: the legend taught
 * **"Weak effect"** — a word printed nowhere else in the product — for a
 * thickness the canvas drew for every `|mean| < 0.40`, i.e. for *Slight* and
 * *Moderate* edges alike, so two different findings were pixel-identical on the
 * one channel that key teaches the reader to read as strength. The words
 * themselves reach the chip, `ConnectionRow`, `InfluenceIndicator` and the band
 * pills.
 *
 * DARK, so it is a code defect this closes before it can ever be a user one:
 * the coaching sentence, whose cuts were inclusive upwards against the
 * contract's inclusive downwards and therefore INVERTED against the pills'
 * table at exactly `0.40` and exactly `0.70`.
 *
 * ⚠ The assertions below are unaffected either way — they are over PURE
 * FUNCTIONS, and a function's return value is the same whether or not a
 * component prints it. What changes is the CLAIM, and only the claim.
 *
 * ── WHAT THIS FILE PINS, AND WHAT IT DELIBERATELY DOES NOT ─────────────────
 *
 * It pins that every surface DERIVES from `CANVAS_STRENGTH_BANDS`. It does NOT pin
 * that the cuts are right: they belong to `validation_ui_data_contract_v1.1`
 * and are settled there. A guard cannot audit its own contract — what it can
 * do is fail loud the moment a surface stops asking (CLAUDE.md trap 12).
 *
 * ⚠ THE WIDTH LADDER IS THE ONE RECONCILIATION THAT NEEDED AN ARGUMENT
 * (trap 21). "How thick is this line" is not "what word is this magnitude
 * entitled to", and two authorities answering different questions must be
 * named apart rather than aligned. The argument for aligning these two is that
 * the LEGEND is the join — a key exists to assert *this thickness means this
 * word*, and that assertion is only well-formed when both ladders have the
 * same rungs. `weightMagnitudeToStrokeWidth`'s cuts are therefore asserted
 * below BY WALKING THE FUNCTION, not by reading the table it now imports.
 *
 * ⚠ SCOPE. Pure modules only, so this file stays fast and mountless. The two
 * RENDERED consumers are pinned where they live and are named here so the set
 * is findable: `CanvasLegendPopover.spec.tsx` (one thickness row per band,
 * asserted by COUNT) and `StrengthBandButtons` (which now has no table of its
 * own to drift — its import is the guarantee, and its midpoints are checked
 * below because those are what it writes into the model).
 *
 * ⛔ THE MODEL TAB IS OUT OF SCOPE AND IS NOT A DEFECT HERE.
 * `components/model-tab/strengthBands.getDirectionalStrengthLabel` answers the
 * DIRECTIONAL question on its own cuts and is named apart on purpose — see its
 * header. Nothing in this file touches it.
 */
import { describe, it, expect } from 'vitest'
import {
  CANVAS_STRENGTH_BANDS,
  getCanvasStrengthBand,
  getStrengthLabel,
  type CanvasStrengthBand,
} from '../domain/vocabulary'
// ⛔ THE NAMESPACE IMPORT IS LOAD-BEARING, NOT A CONVENIENCE. The one-table
// guard below counts the MODULE'S OWN EXPORTS at runtime; a named import list
// could only ever see the names this file already knows, which is precisely the
// blindness it is written to remove.
import * as vocabulary from '../domain/vocabulary'
import { describeEdge } from '../domain/edgeLabels'
import {
  EDGE_STROKE_WIDTH_BANDS,
  MEASURED_EDGE_STROKE_WIDTH_FLOOR,
  UNSET_EDGE_STROKE_WIDTH,
  weightMagnitudeToStrokeWidth,
} from '../utils/graphDisplayCalculations'
import { getEffectSizeCoaching } from '../ui/inspector/coachingText'

/**
 * The magnitude domain, walked at 0.001 with INTEGER arithmetic so no floating
 * accumulation can drift a sample across a cut. `i / 1000` is a single
 * correctly-rounded division, so it lands on the exact double the contract's
 * literals use, which is what makes the boundary assertions below meaningful
 * rather than approximate.
 *
 * ⚠⚠ IT WALKS [0, 2], NOT [0, 1], AND THE DIFFERENCE IS THE DECLARED DOMAIN.
 * An earlier draft swept [0, 1] while the table it certifies gives its top band
 * `max: Infinity` precisely because `|weight|` is clamped to [0, 2]
 * (UI-SEM-023). A corpus narrower than the contract's input domain cannot
 * certify the code over the part it omits — CLAUDE.md trap 13d: check what your
 * corpus EXCLUDES, not what it covers. Only `getCanvasStrengthBand` was
 * exercised above 1.0, by three hand-written cases; the word surfaces, the chip,
 * the coaching line and the whole width channel were not exercised there at all.
 */
const STEP_DENOMINATOR = 1000
/** 2 × the denominator — the top of the UI-SEM-023 clamp, inclusive. */
const SWEEP_STEPS = 2 * STEP_DENOMINATOR
function sweep(): number[] {
  const out: number[] = []
  for (let i = 0; i <= SWEEP_STEPS; i++) out.push(i / STEP_DENOMINATOR)
  return out
}

/** The canvas edge chip's claim for a magnitude, with everything else stated. */
function chipLabel(magnitude: number): string {
  return describeEdge(
    { show: true, value: magnitude, source: 'cee' },
    // ≥ LABEL_HEDGE_CUT, so the chip does not append "(uncertain)" and the
    // assertion is about the STRENGTH clause and nothing else.
    { show: true, value: 0.9, source: 'cee' },
    { show: true, direction: 'positive', source: 'cee' },
  ).label
}

const lastBand = (): CanvasStrengthBand => CANVAS_STRENGTH_BANDS[CANVAS_STRENGTH_BANDS.length - 1]

/**
 * ⭐⭐⭐ THE BAND-TABLE DETECTOR — how the one-table guard below recognises a
 * band table WITHOUT being told the names.
 *
 * A band table is an array of objects that each carry a user-facing `label` and
 * a numeric lower bound. That is the SHAPE, not a name and not a source string,
 * and it is chosen to be the WEAKEST common shape rather than this table's own:
 * it matches `{ id, label, min, max, midpoint }` (the table here) and it also
 * matches `{ min, label }` — which is exactly the shape of `STRENGTH_BAND_LADDER`
 * on the open branch `canvas/how-much-is-still-open`, the second table this
 * guard exists to intercept. A detector written to this file's own shape would
 * have let that one through, which is the failure this whole change is about.
 *
 * ⚠ WHY OVER THE MODULE'S EXPORTS AND NOT OVER ITS SOURCE TEXT. A regex on the
 * file is a hand-maintained mirror of the syntax someone happens to use: it
 * misses a table built by `.map`, a table spread from another constant, or one
 * written across lines it did not anticipate, and it reports the same clean
 * "one table" for all of them. Reading `import * as vocabulary` asks the MODULE
 * what it exports, which is the thing consumers can actually reach — and it is
 * the only reading a wrong auto-import can act on.
 *
 * ⚠ ITS LIMIT, STATED RATHER THAN IMPLIED: this certifies the module's EXPORTS.
 * A second table kept module-private would not be seen. That is the correct
 * boundary — an unexported table cannot be mis-imported by another surface,
 * which is the harm being prevented — but it is a narrower claim than "this
 * file contains one table" and must not be restated as the wider one.
 */
function isBandRow(entry: unknown): boolean {
  if (typeof entry !== 'object' || entry === null) return false
  const row = entry as { label?: unknown; min?: unknown }
  return typeof row.label === 'string' && typeof row.min === 'number'
}

function bandTableExportNames(namespace: Record<string, unknown>): string[] {
  return Object.keys(namespace).filter(key => {
    const value: unknown = namespace[key]
    if (!Array.isArray(value) || value.length === 0) return false
    return (value as unknown[]).every(isBandRow)
  })
}

describe('⛔ the vocabulary module exports exactly ONE band table', () => {
  /**
   * ⛔⛔ WHY THIS GUARD EXISTS, AND IT IS NOT HYPOTHETICAL.
   *
   * This change consolidated four disagreeing tables into one. One merge later
   * it would have re-created the defect: the open branch
   * `canvas/how-much-is-still-open` adds a SECOND band table,
   * `STRENGTH_BAND_LADDER`, to this same module — and
   * `git merge-tree --write-tree` already reports the conflict in
   * `domain/vocabulary.ts`. The obvious, tidy, silent resolution is to KEEP
   * BOTH, at which point the file that exists to hold one canonical table holds
   * two, on the same quantity, and the next surface to read "the table" picks
   * one at random. That branch's own header argues the point against itself: it
   * named its constant `..._LADDER` rather than `STRENGTH_BANDS` precisely
   * because *"a fourth identically-named export would make the wrong
   * auto-import silent and plausible"*.
   *
   * ⭐ SO THE GUARD IS DELIBERATELY NOT KEYED TO A NAME. A different name is
   * the thing that made the second table feel safe to add; the harm is the
   * second TABLE, whatever it is called.
   */
  it('CONTRAST CONTROL: the detector can see a table, and it COUNTS rather than returning one', () => {
    // ⚠ The whole guard rests on this. A detector that returned `['x']` for
    // everything, or `[]` for everything, would satisfy the assertion below
    // while observing nothing (CLAUDE.md trap 13 — an absence claim needs a
    // positive control; trap 13e — the control's MAGNITUDE must be plausible,
    // not merely non-zero).
    expect(bandTableExportNames({}), 'the detector invents a table where there is none').toEqual([])
    expect(
      bandTableExportNames({ label: 'Strong', min: 0.4, bands: [], words: ['Strong'] }),
      'the detector matches non-tables — a bare object, an empty array, or an array of strings',
    ).toEqual([])

    const secondTable = bandTableExportNames({
      CANVAS_STRENGTH_BANDS,
      // The EXACT shape of `STRENGTH_BAND_LADDER` on the conflicting branch:
      // `min` + `label`, no `max`, no `id`, no `midpoint`. If the detector
      // cannot see this one it cannot do its job.
      STRENGTH_BAND_LADDER: [
        { min: 0.7, label: 'Very strong' },
        { min: 0, label: 'Slight' },
      ],
      getStrengthLabel,
      SOME_UNRELATED_LABEL: 'Question',
    })
    expect(
      secondTable.slice().sort(),
      'the detector does not count a second table, so the guard below could never RED',
    ).toEqual(['CANVAS_STRENGTH_BANDS', 'STRENGTH_BAND_LADDER'])
  })

  it('⛔ finds exactly one, and it is the canonical table', () => {
    const tables = bandTableExportNames(vocabulary as unknown as Record<string, unknown>)
    expect(
      tables,
      `\`domain/vocabulary.ts\` now exports ${tables.length} band tables (${tables.join(', ')}). ` +
        'Two canonical tables over one quantity is the defect this module was created to remove. ' +
        'If a merge brought a second one in, reconcile them into CANVAS_STRENGTH_BANDS rather than keeping both.',
    ).toEqual(['CANVAS_STRENGTH_BANDS'])
  })
})

describe('the canonical strength table is well formed', () => {
  it('INSTRUMENT CONTROL: the table is populated and its sampler is not empty', () => {
    // Every assertion in this file iterates one of these two. An empty table or
    // an empty sweep would make the whole file pass by testing nothing
    // (CLAUDE.md trap 13).
    expect(CANVAS_STRENGTH_BANDS.length, 'the band table is empty — every test below is vacuous').toBeGreaterThanOrEqual(4)
    expect(sweep().length).toBe(SWEEP_STEPS + 1)
    // ⭐ AND THE HALF THAT WOULD HAVE CAUGHT THE NARROW CORPUS. Asserting the
    // LENGTH alone passes for any domain; these assert the domain itself, so a
    // silent narrowing back to [0, 1] REDs here rather than shrinking every
    // sweep below it without a word.
    expect(sweep()[sweep().length - 1], 'the sweep stops short of the UI-SEM-023 clamp').toBe(2)
    expect(
      sweep().filter(m => m > 1).length,
      'the sweep never goes above 1.0 — the top band above the old corpus is uncertified',
    ).toBe(STEP_DENOMINATOR)
  })

  it('CONTRAST CONTROL: the surfaces actually discriminate across the sweep', () => {
    // An absence/agreement check needs a probe whose expected answer DIFFERS
    // (trap 13e): a stub that returned one constant word would satisfy every
    // "they agree" assertion in this file. It must not satisfy this one.
    const words = new Set(sweep().map(m => getStrengthLabel(m)))
    const widths = new Set(sweep().map(m => weightMagnitudeToStrokeWidth(m)))
    expect(words.size, 'the word surface returns one answer for every magnitude — it is not discriminating').toBe(CANVAS_STRENGTH_BANDS.length)
    expect(widths.size, 'the width surface returns one answer for every magnitude — it is not discriminating').toBe(CANVAS_STRENGTH_BANDS.length)
  })

  it('is ascending, contiguous, and total over the input domain', () => {
    expect(CANVAS_STRENGTH_BANDS[0].min).toBe(0)
    expect(lastBand().max).toBe(Infinity)
    for (let i = 0; i < CANVAS_STRENGTH_BANDS.length - 1; i++) {
      const here = CANVAS_STRENGTH_BANDS[i]
      const next = CANVAS_STRENGTH_BANDS[i + 1]
      expect(here.min, `band ${i} does not start below band ${i + 1}`).toBeLessThan(next.min)
      expect(
        here.max,
        `there is a gap or an overlap between "${here.label}" and "${next.label}" — a magnitude in it belongs to two bands or to none`,
      ).toBe(next.min)
    }
  })

  it('gives every band a distinct id and a distinct word', () => {
    expect(new Set(CANVAS_STRENGTH_BANDS.map(b => b.id)).size).toBe(CANVAS_STRENGTH_BANDS.length)
    expect(new Set(CANVAS_STRENGTH_BANDS.map(b => b.label)).size).toBe(CANVAS_STRENGTH_BANDS.length)
  })

  it('⭐ puts every midpoint inside its OWN band — these are written into the model', () => {
    // `StrengthBandButtons` writes `midpoint` when a pill is clicked, so a
    // midpoint that fell outside its band would stamp a number under a word
    // that no longer described it, attributed to the user.
    for (const band of CANVAS_STRENGTH_BANDS) {
      expect(
        getCanvasStrengthBand(band.midpoint).id,
        `clicking "${band.label}" writes ${band.midpoint}, which this table calls "${getCanvasStrengthBand(band.midpoint).label}"`,
      ).toBe(band.id)
    }
  })

  it('resolves a band for every input, including the ones no caller should pass', () => {
    // The resolver is TOTAL by construction so no consumer can be handed
    // `undefined` — the behaviour the if-chain it replaced had, preserved.
    for (const bad of [-1, -0.0001, Number.NaN]) {
      expect(getCanvasStrengthBand(bad).id, `${bad} fell off the table`).toBe(CANVAS_STRENGTH_BANDS[0].id)
    }
    // |weight| is clamped to [0, 2] (UI-SEM-023), not [0, 1].
    expect(getCanvasStrengthBand(1.5).id).toBe(lastBand().id)
    expect(getCanvasStrengthBand(2).id).toBe(lastBand().id)
  })
})

describe('every word surface names the same band', () => {
  it('the label helper IS the table', () => {
    for (const m of sweep()) {
      expect(getStrengthLabel(m)).toBe(getCanvasStrengthBand(m).label)
    }
  })

  it('the canvas edge chip opens with the canonical word', () => {
    for (const m of sweep()) {
      const expected = getCanvasStrengthBand(m).label
      expect(
        chipLabel(m),
        `at |mean| ${m} the edge chip says "${chipLabel(m)}" where the table says "${expected}"`,
      ).toBe(`${expected} boost`)
    }
  })

  it('the strength slider\'s coaching line names the canonical word', () => {
    for (const m of sweep()) {
      expect(getEffectSizeCoaching(m).text).toBe(`${getCanvasStrengthBand(m).label} effect.`)
    }
  })

  it('⛔ the retired words are gone from every word surface', () => {
    // "Weak" was the legend's invented fourth word; "Negligible" and
    // "Near-total" were the coaching ladder's extra rungs. None has a band.
    for (const m of sweep()) {
      const spoken = `${getStrengthLabel(m)} | ${chipLabel(m)} | ${getEffectSizeCoaching(m).text}`
      for (const retired of ['Weak', 'Negligible', 'Near-total']) {
        expect(spoken, `|mean| ${m} still prints the retired word "${retired}"`).not.toContain(retired)
      }
    }
  })
})

describe('the width channel draws the same ladder the words speak', () => {
  it('has exactly one width per band, and they ascend with the bands', () => {
    expect(
      Object.keys(EDGE_STROKE_WIDTH_BANDS).slice().sort(),
      'the width table and the band table describe different sets of bands',
    ).toEqual(CANVAS_STRENGTH_BANDS.map(b => b.id).slice().sort())

    const widths = CANVAS_STRENGTH_BANDS.map(b => EDGE_STROKE_WIDTH_BANDS[b.id])
    for (let i = 1; i < widths.length; i++) {
      expect(
        widths[i],
        `"${CANVAS_STRENGTH_BANDS[i].label}" does not draw thicker than "${CANVAS_STRENGTH_BANDS[i - 1].label}" — the picture contradicts the word`,
      ).toBeGreaterThan(widths[i - 1])
    }
  })

  it('⭐ CUTS DERIVED BY WALKING THE FUNCTION, not by reading the table', () => {
    // The non-circular half. This finds where the drawn width CHANGES and then
    // compares those magnitudes to the contract's lower bounds. A restatement
    // reintroduced inside `weightMagnitudeToStrokeWidth` would move a
    // transition and RED here even though the table itself was untouched.
    const transitions: number[] = []
    let previous = weightMagnitudeToStrokeWidth(0)
    for (const m of sweep().slice(1)) {
      const width = weightMagnitudeToStrokeWidth(m)
      if (width !== previous) {
        transitions.push(m)
        previous = width
      }
    }
    const expected = CANVAS_STRENGTH_BANDS.slice(1).map(b => b.min)
    expect(
      transitions.length,
      `the width channel changes ${transitions.length} times across [0, 2] where the vocabulary has ${expected.length} interior cuts`,
    ).toBe(expected.length)
    transitions.forEach((cut, i) => {
      expect(
        cut,
        `the width changes at |mean| ${cut} but "${CANVAS_STRENGTH_BANDS[i + 1].label}" begins at ${expected[i]}`,
      ).toBeCloseTo(expected[i], 3)
    })
  })

  it('draws each magnitude at its own band\'s width', () => {
    for (const m of sweep()) {
      expect(weightMagnitudeToStrokeWidth(m)).toBe(EDGE_STROKE_WIDTH_BANDS[getCanvasStrengthBand(m).id])
    }
  })

  it('keeps "nobody has said" strictly thinner than every measurement', () => {
    // The 8 Sep 2026 invariant, restated against the wider ladder: adding a
    // rung must not reintroduce the collision it was widened to remove.
    expect(UNSET_EDGE_STROKE_WIDTH).toBeLessThan(MEASURED_EDGE_STROKE_WIDTH_FLOOR)
    for (const m of sweep()) {
      expect(
        UNSET_EDGE_STROKE_WIDTH,
        `an unset strength draws at or above the width of a stated |mean| ${m}`,
      ).toBeLessThan(weightMagnitudeToStrokeWidth(m))
    }
  })
})
