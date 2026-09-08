/**
 * "How the options compare" never renders a list of bare names.
 *
 * ── THE WITNESSED DEFECT (Paul, deployed `a9c2e050`, 5 Sep 2026) ────────────
 * The section rendered its title, its count, and three option names with
 * nothing beside them — no figure, no bar, no badge, no reason. A heading that
 * promises a comparison over a body that contains none is a broken promise, and
 * it is worse than an absent section: the reader concludes the panel is broken,
 * or that the options are level.
 *
 * ── THE MECHANISM ──────────────────────────────────────────────────────────
 * A row renders its figure only when `kind === 'analysed' && winReadout !==
 * null`. The `not_computed` / `not_analysed` kinds each carry a badge, so those
 * states explain themselves — but an ANALYSED option whose win share did not
 * come back falls between them and renders `null`. Nothing said so.
 *
 * ── WHY THE SENTENCE IS NOT NEW ────────────────────────────────────────────
 * `checks.leaderMeaning` already states exactly this, is already licensed, and
 * is already on the surface in "What we checked". Reusing it means one wording
 * for one fact, rather than a second sentence that can drift from it — and it
 * is deliberately NOT a claim that the options are level, which is the false
 * reading a silent list invites.
 */
import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'

vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { OptionsComparison } from '../sections/OptionsComparison'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'

const OPT = (id: string, label: string, winReadout: string | null) => ({
  id,
  label,
  kind: 'analysed' as const,
  winReadout,
  winFraction: winReadout === null ? null : 0.5,
  notAnalysedReason: null,
})

const model = (rows: ReturnType<typeof OPT>[]) =>
  ({ rows, totalCount: rows.length }) as never

function renderComparison(rows: ReturnType<typeof OPT>[]) {
  cleanup()
  render(<OptionsComparison options={model(rows)} />)
  // ⚠ `SectionShell` rests CLOSED and renders no body until opened. My first
  // cut asserted against the unopened shell and read an empty string — so the
  // CONTROL failed, which is the only reason I noticed rather than shipping a
  // guard that measured nothing.
  fireEvent.click(screen.getByTestId('analysis-new-options-toggle'))
}

const CAVEAT = 'analysis-new-options-no-figures'

describe('a comparison with no figures says so', () => {
  it('CONTROL: with figures, the rows carry them and no caveat appears', () => {
    // Without this the caveat could render unconditionally — which would put a
    // "no comparison verdict" notice on a run that produced one, i.e. turn a
    // silence defect into a false statement.
    renderComparison([OPT('a', 'Adopt Segment', '61%'), OPT('b', 'Build in house', '39%')])
    expect(screen.getByTestId('analysis-new-options')).toHaveTextContent('61%')
    expect(screen.queryByTestId(CAVEAT), 'a caveat on a run that DID compare').toBeNull()
  })

  it('every option numberless: the section states why, and does not claim a tie', () => {
    renderComparison([
      OPT('a', 'Adopt Segment', null),
      OPT('b', 'Build in house', null),
      OPT('c', 'Do nothing', null),
    ])
    const caveat = screen.getByTestId(CAVEAT)
    expect(caveat).toBeVisible()
    expect(caveat).toHaveTextContent(COPY.checks.leader_not_assessed.meaning)
    // ⚠ The sentence must keep its own denial. A shorter paraphrase that drops
    // "it is not a finding that the options are level" would invite exactly the
    // reading the silent list already invited.
    expect(caveat).toHaveTextContent('not a finding that the options are level')
  })

  it('DISCRIMINATOR: a PARTIAL run keeps its figures and shows no caveat', () => {
    // The load-bearing case. One numberless option among figures is an ordinary
    // mixed run — the reader can see which rows have numbers. Firing the caveat
    // there would contradict the figures printed beside it.
    renderComparison([OPT('a', 'Adopt Segment', '61%'), OPT('b', 'Build in house', null)])
    expect(screen.getByTestId('analysis-new-options')).toHaveTextContent('61%')
    expect(screen.queryByTestId(CAVEAT), 'a caveat beside a real figure').toBeNull()
  })

  it('an empty option set still renders nothing at all', () => {
    cleanup()
    const { container } = render(<OptionsComparison options={model([])} />)
    expect(container).toBeEmptyDOMElement()
  })
})
