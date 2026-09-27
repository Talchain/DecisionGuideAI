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
 * WHAT THIS PINS, with numbers a layout engine produced (jsdom has none — see
 * `__helpers__/driverCaptionFit.ts`):
 *   1. every caption the line can print — rank ≤ M ≤ `MAX_BADGED_RANK`, fresh
 *      and `Last run · ` — fits the TIGHTEST factor measure (220px, a
 *      needs-input card) ON ITS OWN at the landing bound
 *      (`MAX_LABEL_COUNTER_SCALE`), so no ellipsis fires;
 *   2. at 100% each one keeps its bar beside it;
 *   3. the row can only resolve the landing case by WRAPPING the bar away:
 *      nothing in it shrinks, and the bar is never squashed.
 * Discriminating controls: the retired stale copy (`… of 6 analysed`, which
 * truncated on served) and the contract's fresh words under a `Last run · `
 * prefix both FAIL the same budget.
 *
 * THE BROWSER EVIDENCE (Chromium, 1280 × 800, Inter, Paul's two MRR fixtures,
 * fresh and stale, landing and 100%) is in the PR record; this file is the
 * guard that keeps the copy inside it.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { FactorDriverLine, driverLineCaption } from '../FactorDriverLine'
import { LAST_RUN_PREFIX } from '../metricVocabulary'
import { MAX_BADGED_RANK } from '../../../../components/results/driverDisplayModel'
import { MAX_LABEL_COUNTER_SCALE } from '../../../utils/zoomLegibility'
import {
  DRIVER_GAP_PX,
  DRIVER_TRACK_W_PX,
  FACTOR_SLOT_MEASURE_PX,
  MEASURED_KERNED_11PX,
  captionWidthPx,
} from '../../__tests__/__helpers__/driverCaptionFit'

afterEach(() => cleanup())

/** Every caption the card can print: rank ≤ M ≤ MAX_BADGED_RANK, fresh and stale. */
const ALL_CAPTIONS: ReadonlyArray<string> = (() => {
  const out: string[] = []
  for (let m = 1; m <= MAX_BADGED_RANK; m++) {
    for (let r = 1; r <= m; r++) {
      out.push(driverLineCaption({ rank: r, setSize: m }))
      out.push(`${LAST_RUN_PREFIX}${driverLineCaption({ rank: r, setSize: m }, true)}`)
    }
  }
  return out
})()

const tokens = (el: Element) => new Set((el.getAttribute('class') ?? '').split(/\s+/))

describe('the width budget is calibrated against the browser', () => {
  it('the glyph table never under-reads Chromium’s kerned width (≤ 0.5px over)', () => {
    for (const [text, kerned] of MEASURED_KERNED_11PX) {
      const sum = captionWidthPx(text)
      expect(sum, text).toBeGreaterThanOrEqual(kerned)
      expect(sum - kerned, text).toBeLessThanOrEqual(0.5)
    }
  })

  it('the bound and the measure are the product’s own constants (1.36; 220px, a needs-input 248 card)', () => {
    expect(MAX_LABEL_COUNTER_SCALE).toBeCloseTo(1.36, 2)
    expect(FACTOR_SLOT_MEASURE_PX).toBe(220)
    // Positive control on the enumeration: 6 (rank, M) pairs × 2 forms.
    expect(ALL_CAPTIONS).toHaveLength(12)
    expect(ALL_CAPTIONS).toContain('Driver 3 of 3 ranked in this run')
    expect(ALL_CAPTIONS).toContain('Last run · Driver 1 of 3 ranked')
  })
})

describe('item 11 — every caption fits the slot on its own at the landing bound, so none is ellipsised', () => {
  it.each(ALL_CAPTIONS)('%s', (caption) => {
    const w = captionWidthPx(caption, MAX_LABEL_COUNTER_SCALE)
    expect(w, `${caption}: ${w.toFixed(1)}px at ×${MAX_LABEL_COUNTER_SCALE}`).toBeLessThanOrEqual(FACTOR_SLOT_MEASURE_PX)
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
  it.each(ALL_CAPTIONS)('at 100%%, "%s" keeps its bar beside it', (caption) => {
    expect(captionWidthPx(caption, 1) + DRIVER_GAP_PX + DRIVER_TRACK_W_PX).toBeLessThanOrEqual(FACTOR_SLOT_MEASURE_PX)
  })

  it('at the landing bound the longest caption leaves no room for the bar, so the row must WRAP it, not shrink anything', () => {
    const longest = Math.max(...ALL_CAPTIONS.map((c) => captionWidthPx(c, MAX_LABEL_COUNTER_SCALE)))
    // The case the first fix resolved by squashing: caption + gap + bar > measure.
    expect(longest + DRIVER_GAP_PX + DRIVER_TRACK_W_PX * MAX_LABEL_COUNTER_SCALE).toBeGreaterThan(FACTOR_SLOT_MEASURE_PX)

    render(<FactorDriverLine nodeId="fac_x" rank={{ rank: 1, setSize: 3 }} value={0.38} fromLastRun inSlot />)
    const row = tokens(screen.getByTestId('factor-driver-line'))
    const caption = tokens(screen.getByTestId('factor-driver-line-caption'))
    const bar = tokens(screen.getByTestId('factor-driver-line-bar'))
    // The contract's `.driver` row: it wraps, with the 6px gap between items on a line.
    expect(row.has('flex-wrap')).toBe(true)
    expect(row.has('flex-nowrap')).toBe(false)
    expect(row.has('gap-x-1.5')).toBe(true)
    // The caption never gives way (its ellipsis is a last resort for unmeasured copy)…
    expect(caption.has('shrink-0')).toBe(true)
    expect(caption.has('max-w-full')).toBe(true)
    expect(caption.has('min-w-0')).toBe(false)
    // …and the bar is never squashed, so its fill always reads against the whole track.
    expect(bar.has('shrink-0')).toBe(true)
    expect(bar.has('min-w-0')).toBe(false)
    expect([...bar].some((t) => t.includes('flex-shrink'))).toBe(false)
    expect(screen.getByTestId('factor-driver-line-bar-fill').style.width).toBe('max(4px, 38%)')
    // No separate spacer: the gap exists only while the bar shares the caption's line.
    expect(screen.queryByTestId('factor-driver-line-gap')).toBeNull()
  })
})
