/**
 * ⭐⭐ THREE ROWS THAT ALL POINT THE SAME WAY SHOULD SAY SO ONCE.
 *
 * The witnessed shape: three sensitivity rows whose sentences all end *"…'Hold
 * Price at Current Level' could become the better choice"*. Roughly two-thirds
 * of the visible text identical, the difference mid-string, and rows 2 and 3
 * collapsed to exactly the clause they share. The reader has to diff three
 * paragraphs to find what varies.
 *
 * ── ⛔ WHY THIS IS NOT A NEW CLAIM, WHICH IS THE WHOLE ENTITLEMENT ARGUMENT ─
 * Every row ALREADY names this option, in the producer's own sentence, on
 * screen. Saying it once above them is strictly LESS assertion than the section
 * already makes. It could only become a new claim by naming an option no row
 * named — which the derivation makes impossible, since the label is taken from
 * the rows themselves.
 *
 * ── THE FOUR SILENCES, EACH A REAL STATE AND EACH PINNED ───────────────────
 *   1 · THE ROWS DISAGREE. Nothing renders. "These point at different options"
 *       is a different, useful claim that deserves its own argument and its own
 *       test, not an else-arm.
 *   2 · ANY ROW IS UNNAMED. Absence is not assent: one row the producer gave no
 *       alternative for means the rows cannot be SHOWN to agree.
 *   3 · FEWER THAN TWO ROWS. One row's own sentence already says where it
 *       points; a line above it would be the same claim twice.
 *   4 · AGREEMENT IS BY ID, NEVER BY LABEL (trap 19). Two options can carry the
 *       same label, and `stripEncodingNotation` can collapse two distinct
 *       unusable ones onto one fallback string — so a label comparison answers a
 *       different question and is right most of the time, which is the worst
 *       kind of wrong. The same-label-different-id case is the discriminator.
 *
 * ── ⛔ V2 (716b8e67, 24 Sep 2026): A FIFTH SILENCE — THE LEADER IS WITHHELD ──
 * "…they all point the same way in this model: towards <option>" presupposes a
 * current leader, so the body renders the line ONLY when `leaderClaimPermitted`
 * (DATA-MAP truth risk 1). `manyFragileEdges` publishes no licence, which left
 * every case here reading `null` for the gate's reason — the four silences were
 * green WITHOUT exercising their own rule. So every case now runs on a
 * PERMITTED run, and the withheld twin at the end asserts the line is ABSENT on
 * the shape that otherwise produces it.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import { manyFragileEdges } from './analysisNewFixtures'

/**
 * V2 RE-POINT (Reasoning V2, 24 Sep 2026). "What would change your mind" moved
 * into the "Challenge the thinking" zone and is opened here BY ITS TESTID.
 * `openAllSections` cannot converge on the V2 tab: About's detail rows are a
 * one-at-a-time accordion, so opening every closed toggle re-closes a sibling.
 * ⚠ ASSERTED OPEN: four of the six cases below assert the line is ABSENT, and
 * an absence read off a closed (unmounted) section would pass vacuously.
 */
const openSensitivity = () => {
  const toggle = screen.getByTestId('analysis-new-sensitivity-toggle')
  if (toggle.getAttribute('aria-expanded') !== 'true') fireEvent.click(toggle)
  expect(
    screen.getByTestId('analysis-new-sensitivity-toggle'),
    'the section must be open before it is read',
  ).toHaveAttribute('aria-expanded', 'true')
}

const renderBody = (data: ResultsSectionDataReturn) => {
  const r = render(
    <AnalysisNewTabBody
      resultsSectionData={data}
      isPreRun={false}
      isRunning={false}
      isStale={false}
      responseHash="convergence_line"
    />,
  )
  openSensitivity()
  return r
}

type Alt = { id: string; label: string } | null

/**
 * `alts` is applied in producer order, one per SENSITIVE_ASSUMPTION row.
 * `permitted` sets the leader licence — the composed answer and its Q2
 * conjunct, moved TOGETHER (see `decisionWithLeaderWithheld`). Nothing else
 * differs between a permitted and a withheld run here.
 */
const withAlternatives = (alts: readonly Alt[], permitted = true): ResultsSectionDataReturn => {
  const base = manyFragileEdges()
  const data = {
    ...base,
    recommendation: {
      ...base.recommendation,
      leaderDesignationPermitted: permitted,
      verdict: { hasLeadingOption: permitted },
    },
  } as ResultsSectionDataReturn
  const rows = data.confidence.uncertainties.filter((u) => u.code === 'SENSITIVE_ASSUMPTION')
  expect(rows.length, 'precondition: the fixture emits fragile-edge rows').toBeGreaterThanOrEqual(alts.length)
  let i = 0
  let kept = 0
  return {
    ...data,
    confidence: {
      ...data.confidence,
      uncertainties: data.confidence.uncertainties.flatMap((u) => {
        if (u.code !== 'SENSITIVE_ASSUMPTION') return [u]
        if (i >= alts.length) return [] // trim to exactly `alts.length` rows
        const a = alts[i++]
        kept++
        return [
          a === null
            ? u
            : { ...u, alternativeWinnerId: a.id, alternativeWinnerLabel: a.label },
        ]
      }),
    },
    __kept: kept,
  } as unknown as ResultsSectionDataReturn
}

const LINE = 'analysis-new-sensitivity-convergence'
const line = () => screen.queryByTestId(LINE)

afterEach(cleanup)

describe('the convergence line', () => {
  it('⭐ ALL AGREE — said once, naming the option the rows already name', () => {
    renderBody(
      withAlternatives([
        { id: 'opt_hold', label: 'Hold Price at Current Level' },
        { id: 'opt_hold', label: 'Hold Price at Current Level' },
        { id: 'opt_hold', label: 'Hold Price at Current Level' },
      ]),
    )
    const el = line()
    expect(el, 'three rows pointing one way is the witnessed shape').not.toBeNull()
    expect(el!.textContent).toContain('Hold Price at Current Level')
    expect(
      el!.textContent,
      'it must stay conditional — the rows are "if this is wrong", not a recommendation',
    ).toContain('If any of these is wrong')
  })

  it('⛔ THEY DISAGREE — nothing renders, and no opposite claim is invented', () => {
    renderBody(
      withAlternatives([
        { id: 'opt_hold', label: 'Hold Price at Current Level' },
        { id: 'opt_raise', label: 'Raise Price to £55 Immediately' },
        { id: 'opt_hold', label: 'Hold Price at Current Level' },
      ]),
    )
    expect(line()).toBeNull()
  })

  it('⛔ ONE ROW UNNAMED — absence is not assent', () => {
    renderBody(
      withAlternatives([
        { id: 'opt_hold', label: 'Hold Price at Current Level' },
        null,
        { id: 'opt_hold', label: 'Hold Price at Current Level' },
      ]),
    )
    expect(
      line(),
      'a row the producer named no alternative for cannot be shown to agree with anything',
    ).toBeNull()
  })

  it('⛔ A SINGLE ROW — its own sentence already says where it points', () => {
    renderBody(withAlternatives([{ id: 'opt_hold', label: 'Hold Price at Current Level' }]))
    expect(line(), 'a line above one row would be the same claim twice').toBeNull()
  })

  it('⛔⛔ THE DISCRIMINATOR — SAME LABEL, DIFFERENT IDS is disagreement', () => {
    // Two distinct options can carry one label, and the label fallback can
    // collapse two unusable ones onto one string. A label comparison would say
    // "they agree" here, and be wrong — while being right on every other case
    // in this file, which is exactly why it needs its own test.
    renderBody(
      withAlternatives([
        { id: 'opt_a', label: 'Hold Price at Current Level' },
        { id: 'opt_b', label: 'Hold Price at Current Level' },
      ]),
    )
    expect(
      line(),
      'agreement is decided by identity; a label comparison passes this and is wrong',
    ).toBeNull()
  })

  it('⭐ OPPOSITE-DIRECTION TWIN — two rows, same id, DO converge', () => {
    // Without this, the case above is indistinguishable from a line that never
    // renders on two rows at all.
    renderBody(
      withAlternatives([
        { id: 'opt_a', label: 'Hold Price at Current Level' },
        { id: 'opt_a', label: 'Hold Price at Current Level' },
      ]),
    )
    expect(line()).not.toBeNull()
  })

  it('⛔ THE LEADER IS WITHHELD — the agreeing shape states nothing', () => {
    // The same three agreeing rows as the first case; only the licence moves.
    const AGREE = [
      { id: 'opt_hold', label: 'Hold Price at Current Level' },
      { id: 'opt_hold', label: 'Hold Price at Current Level' },
      { id: 'opt_hold', label: 'Hold Price at Current Level' },
    ]
    renderBody(withAlternatives(AGREE, false))
    expect(line(), '"towards <option>" names an order a withheld run may not state').toBeNull()
    // Contrast, same run: the section and its rows ARE on screen, so the null is
    // the gate and not an absent section.
    expect(screen.queryAllByTestId('analysis-new-sensitivity-row')).toHaveLength(3)
    cleanup()
    // …and the permitted twin of exactly this shape DOES render it.
    renderBody(withAlternatives(AGREE, true))
    expect(line()).not.toBeNull()
  })
})
