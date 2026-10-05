/**
 * "Most worth resolving next" on the Reasoning tab — EVERY ranked factor can be
 * acted on, not only rank 1 (SCI-HERO-DELTAS G3 / step 5; programme-docs #85
 * lease 5963583773).
 *
 * ⚠ WHAT WAS WRONG. `voiFinding` carried rank 1 as a focus target and ranks
 * 2..n as a sentence ("then Mu, Alpha."), so a reader told that Mu was the
 * next unknown worth resolving had no way to reach it. The Analysis tab gives
 * every rank a focus act and a value act from the SAME rows.
 *
 * ⚠ WHAT THESE ROWS HOLD THE FIX TO.
 *  - No second selector: each item's acts come from its OWN row's `canFocus`
 *    and `valueAffordance`, which `voi/voiRanking.ts` (the one authority)
 *    decides. Nothing here re-derives eligibility.
 *  - No re-sort: items keep producer wire order. The Zeta/Mu/Alpha fixture is
 *    the one that can see a sort (its tail is NOT alphabetical).
 *  - The value act opens the FACTORS editor through `openModelValueEditor`
 *    (the route's declared single owner), never the Relationships route that
 *    `onReviewTarget` serves for edges.
 *  - No-signal behaviour is unchanged: nothing ranked → nothing to press.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))
vi.mock('../../../../canvas/nodes/shared/openModelValueEditor', () => ({ openModelValueEditor: vi.fn() }))

import { openModelValueEditor } from '../../../../canvas/nodes/shared/openModelValueEditor'
import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { DisclosureRow } from '../DisclosureRow'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { RESOLVE_NEXT_COPY } from '../../voi/resolveNextCopy'
import type { VoiRanking, VoiRankingRow } from '../../voi/voiRanking'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import type { AnalysisNewFinding } from '../analysisNewTypes'
import { makeData } from './analysisNewFixtures'
import { openAllSections } from './openNamedGroups'

const row = (
  factorId: string,
  label: string,
  over: Partial<Pick<VoiRankingRow, 'canFocus' | 'valueAffordance'>> = {},
): VoiRankingRow => ({ factorId, label, canFocus: true, valueAffordance: 'review', ...over })

const ranking = (over: Partial<VoiRanking> = {}): VoiRanking => ({
  resolved: [],
  belowResolution: [],
  someFactorsUnassessed: false,
  ...over,
})

const withRanking = (voiRanking: VoiRanking | null): ResultsSectionDataReturn =>
  makeData({ confidence: { evidenceGapsAssessed: true }, voiRanking })

const voiOf = (data: ResultsSectionDataReturn): AnalysisNewFinding | undefined =>
  buildAnalysisNewViewModel({ data, recommendations: [], isPreRun: false, isRunning: false, isStale: false })
    .uncertainty.findings.find((f) => f.id.startsWith('voi:'))

/** The fixture that can see a sort: Mu before Alpha. */
const ZETA_MU_ALPHA = ranking({ resolved: [row('f_1', 'Zeta'), row('f_2', 'Mu'), row('f_3', 'Alpha')] })

afterEach(() => {
  cleanup()
  vi.mocked(openModelValueEditor).mockClear()
})

// ═══════════════════════════════════════════════════════════════════════════
// VIEW MODEL — the ranks arrive as items, in wire order, with their own acts
// ═══════════════════════════════════════════════════════════════════════════

describe('voiFinding — ranks 2..n are items, not a sentence', () => {
  it('carries ranks 2..n as items in PRODUCER WIRE ORDER, each under its own factor identity', () => {
    const voi = voiOf(withRanking(ZETA_MU_ALPHA))!
    expect(voi.id).toBe('voi:f_1')
    expect(voi.rankedItems?.map((i) => [i.id, i.label])).toEqual([
      ['f_2', 'Mu'],
      ['f_3', 'Alpha'],
    ])
  })

  it('gives each item ONLY the acts its own row licenses — never a neighbour’s', () => {
    const voi = voiOf(
      withRanking(
        ranking({
          resolved: [
            row('f_lead', 'Lead time'),
            row('f_set', 'Freight rate', { valueAffordance: 'set' }),
            row('f_nofocus', 'Staff churn', { canFocus: false }),
            row('f_notfactor', 'Market mood', { valueAffordance: 'none' }),
          ],
        }),
      ),
    )!
    const byId = new Map((voi.rankedItems ?? []).map((i) => [i.id, i]))
    expect(byId.get('f_set')).toMatchObject({ focusTargetId: 'f_set', valueTargetId: 'f_set', valueAffordance: 'set' })
    expect(byId.get('f_nofocus')?.focusTargetId).toBeUndefined()
    expect(byId.get('f_nofocus')).toMatchObject({ valueTargetId: 'f_nofocus', valueAffordance: 'review' })
    expect(byId.get('f_notfactor')?.valueTargetId).toBeUndefined()
    expect(byId.get('f_notfactor')?.valueAffordance).toBeUndefined()
    expect(byId.get('f_notfactor')?.focusTargetId).toBe('f_notfactor')
  })

  it('gives rank 1 its value act from its own affordance, and none when the row is not a factor', () => {
    expect(voiOf(withRanking(ZETA_MU_ALPHA))).toMatchObject({ valueTargetId: 'f_1', valueAffordance: 'review' })
    const notFactor = voiOf(withRanking(ranking({ resolved: [row('f_x', 'Market mood', { valueAffordance: 'none' })] })))!
    expect(notFactor.valueTargetId).toBeUndefined()
    expect(notFactor.valueAffordance).toBeUndefined()
  })

  it('carries no list for a lone rank, and nothing to press when nothing cleared resolution (no-signal control)', () => {
    expect(voiOf(withRanking(ranking({ resolved: [row('f_lead', 'Lead time')] })))!.rankedItems).toBeUndefined()
    const none = voiOf(withRanking(ranking({ belowResolution: [row('f_x', 'Freight rate', { canFocus: false })] })))!
    expect(none.id).toBe('voi:none-above-resolution')
    expect(none.rankedItems).toBeUndefined()
    expect(none.valueTargetId).toBeUndefined()
    expect(voiOf(withRanking(null))).toBeUndefined()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// ROW — each item renders its own acts, and only those
// ═══════════════════════════════════════════════════════════════════════════

describe('DisclosureRow — a ranked item is reachable and changeable from where it is named', () => {
  const finding = (): AnalysisNewFinding => voiOf(
    withRanking(
      ranking({
        resolved: [
          row('f_1', 'Zeta'),
          row('f_2', 'Mu', { valueAffordance: 'set' }),
          row('f_3', 'Alpha', { canFocus: false }),
          row('f_4', 'Market mood', { valueAffordance: 'none' }),
        ],
      }),
    ),
  )!

  const renderRow = (props: Partial<Parameters<typeof DisclosureRow>[0]> = {}) => {
    const onFocusTarget = vi.fn()
    const onReviewValue = vi.fn()
    render(
      <DisclosureRow
        finding={finding()}
        onFocusTarget={onFocusTarget}
        onReviewValue={onReviewValue}
        testIdPrefix="t"
        defaultOpen
        {...props}
      />,
    )
    return { onFocusTarget, onReviewValue }
  }
  const item = (factorId: string) =>
    screen.getAllByTestId('t-ranked-item').find((el) => el.getAttribute('data-factor-id') === factorId)!

  it('lists the ranks in wire order, once — the sentence form is not printed beside the list', () => {
    renderRow()
    expect(screen.getAllByTestId('t-ranked-item').map((el) => el.getAttribute('data-factor-id'))).toEqual(['f_2', 'f_3', 'f_4'])
    expect(screen.getByTestId('t-detail')).not.toHaveTextContent(`${RESOLVE_NEXT_COPY.then} Mu, Alpha, Market mood.`)
  })

  it('presses route to THAT item’s factor, and each act is labelled by its own affordance', () => {
    const { onFocusTarget, onReviewValue } = renderRow()
    fireEvent.click(within(item('f_2')).getByTestId('t-ranked-focus'))
    expect(onFocusTarget).toHaveBeenCalledWith('f_2')
    const setAct = within(item('f_2')).getByTestId('t-ranked-value')
    expect(setAct).toHaveAttribute('data-affordance', 'set')
    expect(setAct).toHaveAccessibleName(`${RESOLVE_NEXT_COPY.act.set}: Mu`)
    fireEvent.click(setAct)
    expect(onReviewValue).toHaveBeenCalledWith('f_2')

    const reviewAct = within(item('f_3')).getByTestId('t-ranked-value')
    expect(reviewAct).toHaveAccessibleName(`${RESOLVE_NEXT_COPY.act.review}: Alpha`)
    fireEvent.click(reviewAct)
    expect(onReviewValue).toHaveBeenLastCalledWith('f_3')
  })

  it('offers no act a row does not license — absent, never disabled', () => {
    renderRow()
    expect(within(item('f_3')).queryByTestId('t-ranked-focus')).toBeNull()
    expect(within(item('f_4')).queryByTestId('t-ranked-value')).toBeNull()
    for (const btn of within(screen.getByTestId('t-ranked')).queryAllByRole('button')) expect(btn).toBeEnabled()
  })

  it('gives rank 1 its value act beside "Show on canvas" (the headline names its subject)', () => {
    const { onReviewValue } = renderRow()
    const act = screen.getByTestId('t-value')
    expect(act).toHaveAccessibleName(RESOLVE_NEXT_COPY.act.review)
    expect(act).toHaveAttribute('data-affordance', 'review')
    fireEvent.click(act)
    expect(onReviewValue).toHaveBeenCalledWith('f_1')
  })

  it('renders no value act at all when the host gives it nowhere to go', () => {
    renderRow({ onReviewValue: undefined })
    expect(screen.queryByTestId('t-value')).toBeNull()
    expect(screen.queryAllByTestId('t-ranked-value')).toHaveLength(0)
    // The list itself survives — naming the ranks never depended on the act.
    expect(screen.getAllByTestId('t-ranked-item')).toHaveLength(3)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// THE REAL TAB — the act reaches the FACTORS editor through its one owner
// ═══════════════════════════════════════════════════════════════════════════

describe('the Reasoning tab — a rank-3 press opens THAT factor in the Model tab’s factors editor', () => {
  it('routes through openModelValueEditor with rank 3’s id and the owner’s default (factors) section', () => {
    render(
      <AnalysisNewTabBody
        resultsSectionData={withRanking(ZETA_MU_ALPHA)}
        isPreRun={false}
        isRunning={false}
        isStale={false}
        responseHash="run_abc123"
      />,
    )
    openAllSections()
    const section = screen.getByTestId('analysis-new-uncertainty')
    const voiRow = within(section)
      .getAllByTestId('analysis-new-uncertainty-row')
      .find((el) => el.getAttribute('data-finding-id') === 'voi:f_1')!
    const toggle = within(voiRow).getByTestId('analysis-new-uncertainty-row-toggle')
    if (toggle.getAttribute('aria-expanded') !== 'true') fireEvent.click(toggle)
    const alpha = within(voiRow)
      .getAllByTestId('analysis-new-uncertainty-ranked-item')
      .find((el) => el.getAttribute('data-factor-id') === 'f_3')!
    fireEvent.click(within(alpha).getByTestId('analysis-new-uncertainty-ranked-value'))
    expect(vi.mocked(openModelValueEditor).mock.calls).toEqual([['f_3']])
  })
})
