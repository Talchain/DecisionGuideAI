/**
 * ⭐ CONTRACT v3.1 POINT 5 — THE DRIVER READOUT (DESIGN-GAP-v31 #37, Canvas WS4).
 *
 *   current: "Driver N of M ranked in this run"
 *   stale:   "Last run · Driver N of M ranked"
 *
 * ⚠⚠ THIS REVERSES A LATER, NAMED RULING, AND SAYS SO. ED #63 5806207128
 * (24 Sep) retired exactly this wording for "Driver N of M analysed", with M the
 * ANALYSED count ("not 'number of ranks we happen to render'"). The lane brief
 * applies v3.1 ("v3.1 + Paul's rulings win; name the conflict"), so this file
 * pins the v3.1 form — and the change sits in its own commit so the lane owner
 * can drop it whole if ED's ruling stands.
 *
 * ⛔ THE WORDS AND THE NUMBER MOVE TOGETHER — the truth half. "of 6 ranked in
 * this run" when the run ranked 3 would be false, so `M` becomes the RANKED
 * count (`influenceRankedCount`, `rankFactor`'s `rankedSetSize`) in the same
 * change as the words. Every assertion below binds the count by a CONTRAST: the
 * analysed set (6) differs from the ranked set (3 or 4), so a reader that kept
 * the analysed count, or printed a constant, fails.
 *
 * CLAIM SCOPE: jsdom — DOM text and attributes; pure functions.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { DRIVER_LINE_COPY } from '../shared/metricVocabulary'
import { driverRankFor } from '../../hooks/useInfluenceRank'
import { influenceRankReadout } from '../../../components/results/influenceScaleCopy'
import { FactorDriverLine } from '../shared/FactorDriverLine'
import { resolveLodMetricLine } from '../shared/lodMetricLine'

afterEach(cleanup)

const ANALYSED = 6
const RANKED = 3

describe('#37 — the words', () => {
  it('current: "Driver 1 of 3 ranked in this run"', () => {
    expect(DRIVER_LINE_COPY.rank(1, RANKED)).toBe('Driver 1 of 3 ranked in this run')
  })

  it('stale: "Driver 1 of 3 ranked" — the caller prefixes `Last run · `, and "in this run" goes', () => {
    expect(DRIVER_LINE_COPY.rank(1, RANKED, true)).toBe('Driver 1 of 3 ranked')
  })
})

describe('#37 — M is the RANKED count, never the analysed set', () => {
  const current = influenceRankReadout(1, ANALYSED)

  it('precondition: the rank is licensed on the analysed set', () => {
    expect(current).not.toBeNull()
  })

  it('M = the ranked count (3), not the analysed set (6)', () => {
    expect(driverRankFor(current, 1, ANALYSED, false, RANKED)).toEqual({ rank: 1, setSize: RANKED })
  })

  it('CONTRAST — a ranked set of 4 prints 4: M follows the data, not a constant', () => {
    expect(driverRankFor(influenceRankReadout(2, ANALYSED), 2, ANALYSED, false, 4)).toEqual({ rank: 2, setSize: 4 })
  })

  it('the publication guard is unchanged: a rank beyond the ranked count states no rank', () => {
    expect(driverRankFor(influenceRankReadout(4, ANALYSED), 4, ANALYSED, false, RANKED)).toBeNull()
  })
})

describe('#37 — the card line and the reduced line say the same words', () => {
  const line = (fromLastRun: boolean) =>
    render(
      <FactorDriverLine
        nodeId="f1"
        rank={{ rank: 1, setSize: RANKED }}
        value={1}
        provenance={'influence_score' as never}
        importanceBasis={null}
        fromLastRun={fromLastRun}
      />,
    )

  it('current: the caption, and the name opens with it', () => {
    line(false)
    const el = screen.getByTestId('factor-driver-line')
    expect(screen.getByTestId('factor-driver-line-caption').textContent).toBe('Driver 1 of 3 ranked in this run')
    expect(el.getAttribute('aria-label')!.startsWith('Driver 1 of 3 ranked in this run')).toBe(true)
  })

  it('stale: "Last run · Driver 1 of 3 ranked"', () => {
    line(true)
    expect(screen.getByTestId('factor-driver-line-caption').textContent).toBe('Last run · Driver 1 of 3 ranked')
    expect(screen.getByTestId('factor-driver-line').getAttribute('aria-label')!.startsWith('Last run · Driver 1 of 3 ranked')).toBe(true)
  })

  it('the denominator note says what "of 3" counts — the factors the run RANKED', () => {
    line(false)
    const note = screen.getByTestId('factor-driver-line').getAttribute('aria-description') ?? ''
    expect(note).toContain('“of 3” counts the factors the run ranked')
    expect(note).not.toContain('in the last analysis')
  })

  it('the reduced (LOD) line: the same words, current and stale', () => {
    const lod = (fromLastRun: boolean) =>
      resolveLodMetricLine({
        nodeType: 'factor',
        data: { label: 'Trial conversion' },
        label: 'Trial conversion',
        // The influence arm is fail-closed on provenance, as the card is.
        displayMetadata: { influence: 1, influenceProvenance: 'influence_score' } as never,
        facts: { driverRank: { rank: 1, setSize: RANKED }, influenceFromLastRun: fromLastRun },
      })
    expect(lod(false)).toBe('Driver 1 of 3 ranked in this run')
    expect(lod(true)).toBe('Last run · Driver 1 of 3 ranked')
  })
})
