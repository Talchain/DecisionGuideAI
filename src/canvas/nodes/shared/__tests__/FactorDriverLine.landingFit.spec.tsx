/**
 * ⭐ THE DRIVER CAPTION FITS ITS SLOT AT THE LANDING BOUND, AND THE BAR IS DRAWN
 * WHOLE OR NOT AT ALL (side-by-side DIFF item 11, 27 Sep 2026; adversarial
 * review of the first fix).
 *
 * THE DEFECT. Served stale at landing: `Last run · Driver 1 of 6 analys…`. The
 * first fix let the gap and the bar shrink first (`[flex-shrink:1000]`) before
 * a `min-w-0 truncate` caption — but flex shares an overflow by shrink factor ×
 * base size, so the caption still lost a sliver and its ellipsis fired.
 * Measured in Chromium at scale 1.36, Inter, Paul's two MRR boards fresh and
 * stale: all 10 ranked captions ellipsised (0.15–0.17px short — integer
 * scrollWidth/clientWidth read them as equal), and the bar was squashed to
 * 7.0–13.4px of its 40.8px (90b8's 31% drawn as 54%). That spec pinned class
 * tokens only, so it could not see any of it.
 *
 * ⭐ RE-DECIDED AT THE 1.64 BOUND (Canvas owner, 27 Sep 2026, landing text cap
 * 1.36 → 1.64). At the new bound NO full caption fits the slot on its own (the
 * CI full suite on `d000d576` found all 12 ellipsising, 248.8–259.5px against
 * 220). The owner's ruling: the slot prints the LONGEST form that fits at the
 * landing bound, in this order —
 *   fresh  "Driver N of M ranked in this run" → "Driver N of M ranked" → "Driver N of M"
 *   stale  "Last run · Driver N of M ranked"  → "Last run · Driver N of M"
 * — and the full sentence stays in the accessible name and the hover. The form
 * is chosen by the product (`restingDriverCaption`) from the SAME budget this
 * file measures with; this file writes the owner's order out itself.
 *
 * WHAT THIS PINS, with numbers a layout engine produced (jsdom has none — see
 * `__helpers__/driverCaptionFit.ts`):
 *   1. every caption the SLOT prints — rank ≤ M ≤ `MAX_BADGED_RANK`, fresh and
 *      `Last run · `, read from the rendered line — fits the TIGHTEST factor
 *      measure (220px, a needs-input card) ON ITS OWN at the landing bound
 *      (`MAX_LABEL_COUNTER_SCALE`), so no ellipsis fires; and it is the longest
 *      of the owner's forms that does, while the accessible name keeps the full
 *      sentence and opens with the visible words;
 *   2. at 100% each one keeps its bar beside it;
 *   3. the row can only resolve the landing case by WRAPPING the bar away:
 *      nothing in it shrinks, and the bar is never squashed.
 * Discriminating controls: every FULL sentence, the retired stale copy (`… of 6
 * analysed`, which truncated on served) and the contract's fresh words under a
 * `Last run · ` prefix all FAIL the same budget; and at 100% the same choice
 * picks the full sentence, so it follows the width, not a pinned string.
 *
 * THE BROWSER EVIDENCE (Chromium, 1280 × 800, Inter, Paul's two MRR fixtures,
 * fresh and stale, landing and 100%) is in the PR record; this file is the
 * guard that keeps the copy inside it.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { FactorDriverLine, driverLineCaption } from '../FactorDriverLine'
import { restingDriverCaption } from '../driverCaptionFit'
import { LAST_RUN_PREFIX } from '../metricVocabulary'
import { CANVAS_CARD_FRAME_PX } from '../canvasGlyphScale'
import { MAX_BADGED_RANK } from '../../../../components/results/driverDisplayModel'
import { CANVAS_TYPE_PX } from '../../../../styles/typography'
import {
  LABEL_COUNTER_SCALE_CAP,
  LABEL_LEGIBLE_ZOOM,
  LABEL_SCALE_QUANTUM,
  LANDING_BODY_FLOOR_PX,
  MAX_LABEL_COUNTER_SCALE,
} from '../../../utils/zoomLegibility'
import { NODE_CARD_PADDING_X, REPEATED_CARD_W } from '../../../utils/nodeLayoutConstants'
import {
  DRIVER_GAP_PX,
  DRIVER_TRACK_W_PX,
  FACTOR_SLOT_MEASURE_PX,
  MEASURED_KERNED_11PX,
  captionWidthPx,
} from '../../__tests__/__helpers__/driverCaptionFit'

afterEach(() => cleanup())

type Rank = { rank: number; setSize: number }
type Case = { rank: Rank; stale: boolean }

/** Every rank the card can print: rank ≤ M ≤ MAX_BADGED_RANK, fresh and stale. */
const ALL_CASES: ReadonlyArray<Case> = (() => {
  const out: Case[] = []
  for (let m = 1; m <= MAX_BADGED_RANK; m++) {
    for (let r = 1; r <= m; r++) {
      out.push({ rank: { rank: r, setSize: m }, stale: false }, { rank: { rank: r, setSize: m }, stale: true })
    }
  }
  return out
})()

/** The FULL sentence — what the accessible name and the hover carry. */
const fullCaption = ({ rank, stale }: Case) => `${stale ? LAST_RUN_PREFIX : ''}${driverLineCaption(rank, stale)}`

/**
 * The owner's forms, longest first, written out HERE (not read from the
 * product's `rankSlotForms`), so the product cannot satisfy this file by
 * changing the list it chooses from.
 */
const ownerForms = ({ rank: { rank: n, setSize: m }, stale }: Case): string[] =>
  stale
    ? [`Last run · Driver ${n} of ${m} ranked`, `Last run · Driver ${n} of ${m}`]
    : [`Driver ${n} of ${m} ranked in this run`, `Driver ${n} of ${m} ranked`, `Driver ${n} of ${m}`]

const fitsAtLanding = (text: string) => captionWidthPx(text, MAX_LABEL_COUNTER_SCALE) <= FACTOR_SLOT_MEASURE_PX

/** What the card's slot actually prints — read from the rendered line, by identity. */
function renderedSlotCaption({ rank, stale }: Case): { caption: string; name: string; numeral: string } {
  cleanup()
  render(<FactorDriverLine nodeId="fac_x" rank={rank} value={0.38} fromLastRun={stale} inSlot />)
  const caption = screen.getByTestId('factor-driver-line-caption').getAttribute('aria-label') ?? ''
  const name = screen.getByTestId('factor-driver-line').getAttribute('aria-label') ?? ''
  return { caption, name, numeral: screen.getByTestId('factor-driver-line-caption').textContent ?? '' }
}

const tokens = (el: Element) => new Set((el.getAttribute('class') ?? '').split(/\s+/))

const label = ({ rank: { rank, setSize }, stale }: Case) => `${stale ? 'stale' : 'fresh'} ${rank} of ${setSize}`

describe('the width budget is calibrated against the browser', () => {
  it('the glyph table never under-reads Chromium’s kerned width (≤ 0.5px over)', () => {
    for (const [text, kerned] of MEASURED_KERNED_11PX) {
      const sum = captionWidthPx(text)
      expect(sum, text).toBeGreaterThanOrEqual(kerned)
      expect(sum - kerned, text).toBeLessThanOrEqual(0.5)
    }
  })

  it('the bound and the measure are the product’s own constants, derived — not a pinned number', () => {
    // The bound: the counter-scale cap the landing body floor derives
    // (`zoomLegibility.ts`), read through its own constants.
    const derivedCap =
      Math.ceil((LANDING_BODY_FLOOR_PX / (CANVAS_TYPE_PX.nodeLabel * LABEL_LEGIBLE_ZOOM)) * LABEL_SCALE_QUANTUM) /
      LABEL_SCALE_QUANTUM
    expect(LABEL_COUNTER_SCALE_CAP).toBe(derivedCap)
    expect(MAX_LABEL_COUNTER_SCALE).toBe(LABEL_COUNTER_SCALE_CAP)
    // The measure: the repeated card inside its frame and a needs-input card's
    // padding (BaseNode `padAdj` = 2 − 1 per side) — and Chromium measured 220px
    // on 90b8's needs-input rank 1.
    expect(FACTOR_SLOT_MEASURE_PX).toBe(REPEATED_CARD_W - 2 * CANVAS_CARD_FRAME_PX - NODE_CARD_PADDING_X - 2 * (2 - 1))
    expect(FACTOR_SLOT_MEASURE_PX).toBe(220)
    // Positive control on the enumeration: 6 (rank, M) pairs × 2 forms.
    expect(ALL_CASES).toHaveLength(12)
    expect(ALL_CASES.map(fullCaption)).toContain('Driver 3 of 3 ranked in this run')
    expect(ALL_CASES.map(fullCaption)).toContain('Last run · Driver 1 of 3 ranked')
  })
})

describe('item 11 — every caption the slot prints fits it on its own at the landing bound, so none is ellipsised', () => {
  it.each(ALL_CASES.map((c) => [label(c), c] as const))('%s: fits, and is the LONGEST owner form that does', (_, c) => {
    const { caption, name, numeral } = renderedSlotCaption(c)
    const w = captionWidthPx(numeral, MAX_LABEL_COUNTER_SCALE)
    expect(w, `${caption}: ${w.toFixed(1)}px at ×${MAX_LABEL_COUNTER_SCALE}`).toBeLessThanOrEqual(FACTOR_SLOT_MEASURE_PX)
    // The owner's order: the first (longest) form that fits, never a shorter one.
    const forms = ownerForms(c)
    const expected = forms.find(fitsAtLanding)
    expect(expected, `no owner form fits at ×${MAX_LABEL_COUNTER_SCALE}`).toBeDefined()
    expect(caption).toBe(expected)
    // The full sentence stays in the accessible name, which opens with the
    // visible words (label in name).
    expect(name.startsWith(`${fullCaption(c)}. `), name).toBe(true)
    expect(name.startsWith(caption)).toBe(true)
  })

  it('CONTROL: the choice follows the width — at 100% the same rule picks the full sentence', () => {
    for (const c of ALL_CASES) {
      expect(restingDriverCaption(c.rank, c.stale, 1), label(c)).toBe(fullCaption(c))
    }
  })

  it('CONTROL: every FULL sentence fails the budget at the landing bound — why the slot shortens it', () => {
    for (const c of ALL_CASES) expect(fitsAtLanding(fullCaption(c)), fullCaption(c)).toBe(false)
  })

  it('CONTROL: the retired stale copy that truncated on served fails the same budget', () => {
    expect(captionWidthPx('Last run · Driver 1 of 6 analysed', MAX_LABEL_COUNTER_SCALE)).toBeGreaterThan(FACTOR_SLOT_MEASURE_PX)
  })

  it('CONTROL: the contract’s fresh words under the stale prefix fail it — why the stale form drops "in this run"', () => {
    const tooLong = `${LAST_RUN_PREFIX}${driverLineCaption({ rank: 3, setSize: 3 })}`
    expect(tooLong).toBe('Last run · Driver 3 of 3 ranked in this run')
    expect(captionWidthPx(tooLong, MAX_LABEL_COUNTER_SCALE)).toBeGreaterThan(FACTOR_SLOT_MEASURE_PX)
  })
})

describe('the bar is drawn whole beside its words, or wrapped out of the one-line slot — never squashed', () => {
  it.each(ALL_CASES.map((c) => [label(c), c] as const))('at 100%%, %s keeps its bar beside it', (_, c) => {
    const { caption } = renderedSlotCaption(c)
    expect(captionWidthPx(caption, 1) + DRIVER_GAP_PX + DRIVER_TRACK_W_PX).toBeLessThanOrEqual(FACTOR_SLOT_MEASURE_PX)
  })

  it('at the landing bound the numeral and bar share one line, without shrinking', () => {
    for (const c of ALL_CASES) {
      const { numeral } = renderedSlotCaption(c)
      expect(numeral).toBe(String(c.rank.rank))
      expect(captionWidthPx(numeral, MAX_LABEL_COUNTER_SCALE) + DRIVER_GAP_PX + DRIVER_TRACK_W_PX * MAX_LABEL_COUNTER_SCALE).toBeLessThanOrEqual(FACTOR_SLOT_MEASURE_PX)
      expect(tokens(screen.getByTestId('factor-driver-line'))).toContain('inline-flex')
      expect(tokens(screen.getByTestId('factor-driver-line-caption'))).toContain('shrink-0')
      expect(tokens(screen.getByTestId('factor-driver-line-bar'))).toContain('shrink-0')
    }
  })
})
