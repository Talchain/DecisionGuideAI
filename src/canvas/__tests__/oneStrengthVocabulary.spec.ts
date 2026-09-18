/**
 * ⭐⭐⭐ ONE STRENGTH VOCABULARY — the canvas names a connector the same way on
 * every surface, and this spec REDs when one of them stops.
 *
 * ── WHAT WAS WRONG, MEASURED AT THE BYTES ON `eb7211d7` ────────────────────
 *
 * FOUR live tables over `|mean|`, all mounted, all disagreeing:
 *
 *   `domain/vocabulary.getStrengthLabel`        4 words · cuts 0.70/0.40/0.20
 *   `utils/graphDisplayCalculations`            3 widths · cuts 0.70/0.40
 *   `components/CanvasLegendPopover`            3 rows · Weak/Moderate/Strong
 *   `ui/inspector/coachingText`                 5 words · cuts 0.9/0.7/0.4/0.1
 *
 * What a user saw. In ONE panel — `EdgePanel` renders the band pills and the
 * strength slider together — `|0.15|` lit the **Slight** pill above the words
 * **"Moderate effect."**, and at exactly `0.40` and exactly `0.70` the two
 * INVERTED, because the coaching cuts were inclusive upwards against the
 * contract's inclusive downwards. On the board, the legend taught **"Weak
 * effect"** — a word printed nowhere else in the product — for a thickness the
 * canvas drew for every `|mean| < 0.40`, i.e. for *Slight* and *Moderate*
 * edges alike, so two different findings were pixel-identical on the one
 * channel that key teaches the reader to read as strength.
 *
 * ── WHAT THIS FILE PINS, AND WHAT IT DELIBERATELY DOES NOT ─────────────────
 *
 * It pins that every surface DERIVES from `STRENGTH_BANDS`. It does NOT pin
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
  STRENGTH_BANDS,
  getStrengthBand,
  getStrengthLabel,
  type StrengthBand,
} from '../domain/vocabulary'
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
 * accumulation can drift a sample across a cut. `i / 1000` lands on the exact
 * double the contract's literals use, which is what makes the boundary
 * assertions below meaningful rather than approximate.
 */
const STEPS = 1000
function sweep(): number[] {
  const out: number[] = []
  for (let i = 0; i <= STEPS; i++) out.push(i / STEPS)
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

const lastBand = (): StrengthBand => STRENGTH_BANDS[STRENGTH_BANDS.length - 1]

describe('the canonical strength table is well formed', () => {
  it('INSTRUMENT CONTROL: the table is populated and its sampler is not empty', () => {
    // Every assertion in this file iterates one of these two. An empty table or
    // an empty sweep would make the whole file pass by testing nothing
    // (CLAUDE.md trap 13).
    expect(STRENGTH_BANDS.length, 'the band table is empty — every test below is vacuous').toBeGreaterThanOrEqual(4)
    expect(sweep().length).toBe(STEPS + 1)
  })

  it('CONTRAST CONTROL: the surfaces actually discriminate across the sweep', () => {
    // An absence/agreement check needs a probe whose expected answer DIFFERS
    // (trap 13e): a stub that returned one constant word would satisfy every
    // "they agree" assertion in this file. It must not satisfy this one.
    const words = new Set(sweep().map(m => getStrengthLabel(m)))
    const widths = new Set(sweep().map(m => weightMagnitudeToStrokeWidth(m)))
    expect(words.size, 'the word surface returns one answer for every magnitude — it is not discriminating').toBe(STRENGTH_BANDS.length)
    expect(widths.size, 'the width surface returns one answer for every magnitude — it is not discriminating').toBe(STRENGTH_BANDS.length)
  })

  it('is ascending, contiguous, and total over the input domain', () => {
    expect(STRENGTH_BANDS[0].min).toBe(0)
    expect(lastBand().max).toBe(Infinity)
    for (let i = 0; i < STRENGTH_BANDS.length - 1; i++) {
      const here = STRENGTH_BANDS[i]
      const next = STRENGTH_BANDS[i + 1]
      expect(here.min, `band ${i} does not start below band ${i + 1}`).toBeLessThan(next.min)
      expect(
        here.max,
        `there is a gap or an overlap between "${here.label}" and "${next.label}" — a magnitude in it belongs to two bands or to none`,
      ).toBe(next.min)
    }
  })

  it('gives every band a distinct id and a distinct word', () => {
    expect(new Set(STRENGTH_BANDS.map(b => b.id)).size).toBe(STRENGTH_BANDS.length)
    expect(new Set(STRENGTH_BANDS.map(b => b.label)).size).toBe(STRENGTH_BANDS.length)
  })

  it('⭐ puts every midpoint inside its OWN band — these are written into the model', () => {
    // `StrengthBandButtons` writes `midpoint` when a pill is clicked, so a
    // midpoint that fell outside its band would stamp a number under a word
    // that no longer described it, attributed to the user.
    for (const band of STRENGTH_BANDS) {
      expect(
        getStrengthBand(band.midpoint).id,
        `clicking "${band.label}" writes ${band.midpoint}, which this table calls "${getStrengthBand(band.midpoint).label}"`,
      ).toBe(band.id)
    }
  })

  it('resolves a band for every input, including the ones no caller should pass', () => {
    // The resolver is TOTAL by construction so no consumer can be handed
    // `undefined` — the behaviour the if-chain it replaced had, preserved.
    for (const bad of [-1, -0.0001, Number.NaN]) {
      expect(getStrengthBand(bad).id, `${bad} fell off the table`).toBe(STRENGTH_BANDS[0].id)
    }
    // |weight| is clamped to [0, 2] (UI-SEM-023), not [0, 1].
    expect(getStrengthBand(1.5).id).toBe(lastBand().id)
    expect(getStrengthBand(2).id).toBe(lastBand().id)
  })
})

describe('every word surface names the same band', () => {
  it('the label helper IS the table', () => {
    for (const m of sweep()) {
      expect(getStrengthLabel(m)).toBe(getStrengthBand(m).label)
    }
  })

  it('the canvas edge chip opens with the canonical word', () => {
    for (const m of sweep()) {
      const expected = getStrengthBand(m).label
      expect(
        chipLabel(m),
        `at |mean| ${m} the edge chip says "${chipLabel(m)}" where the table says "${expected}"`,
      ).toBe(`${expected} boost`)
    }
  })

  it('the strength slider\'s coaching line names the canonical word', () => {
    for (const m of sweep()) {
      expect(getEffectSizeCoaching(m).text).toBe(`${getStrengthBand(m).label} effect.`)
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
    ).toEqual(STRENGTH_BANDS.map(b => b.id).slice().sort())

    const widths = STRENGTH_BANDS.map(b => EDGE_STROKE_WIDTH_BANDS[b.id])
    for (let i = 1; i < widths.length; i++) {
      expect(
        widths[i],
        `"${STRENGTH_BANDS[i].label}" does not draw thicker than "${STRENGTH_BANDS[i - 1].label}" — the picture contradicts the word`,
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
    const expected = STRENGTH_BANDS.slice(1).map(b => b.min)
    expect(
      transitions.length,
      `the width channel changes ${transitions.length} times across [0, 1] where the vocabulary has ${expected.length} interior cuts`,
    ).toBe(expected.length)
    transitions.forEach((cut, i) => {
      expect(
        cut,
        `the width changes at |mean| ${cut} but "${STRENGTH_BANDS[i + 1].label}" begins at ${expected[i]}`,
      ).toBeCloseTo(expected[i], 3)
    })
  })

  it('draws each magnitude at its own band\'s width', () => {
    for (const m of sweep()) {
      expect(weightMagnitudeToStrokeWidth(m)).toBe(EDGE_STROKE_WIDTH_BANDS[getStrengthBand(m).id])
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
