/**
 * Served 28 Sep 2026 (UI `ac2def0f`, a £-goal re-run): under "Record your view" the Reasoning tab said
 *   "This run held up under the changes we tested"            (glance verdict reason)
 *   "How far this held — This run held up under the changes we tested. That is not a guarantee. …"
 *   "Could change if Pro plan price passes 59 GBP per month"   (glance condition)
 * while the Challenge zone already read "Pro plan price would have to rise from … before … leads".
 * Each is now said once: the caveat keeps the held-up sentence WITH its limit, and the Challenge
 * row keeps the tipping point. The glance steps aside only where the other surface is saying it.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

vi.mock('../../../../canvas/ToastContext', () => ({ useShowToastSafe: () => vi.fn() }))
vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { caveatRestatesVerdictReason } from '../robustnessStanding'
import { useCanvasStore } from '../../../../canvas/store'
import { genuineDecision } from './analysisNewFixtures'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'

const REASON = 'The ordering held across the simulated range.' // genuineDecision's own verdict reason
const setCaveat = (text: string) =>
  useCanvasStore.setState({
    results: {
      ...useCanvasStore.getState().results,
      report: {
        decision_brief: {
          version: '1',
          brief_id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
          created_at: '2026-09-28T09:00:00.000Z',
          robustness_caveat: { text, basis: '2,000 simulated futures' },
        },
      },
    },
  } as never)

const draw = (data: ResultsSectionDataReturn = genuineDecision()) =>
  render(
    <AnalysisNewTabBody resultsSectionData={data} isPreRun={false} isRunning={false} isStale={false} responseHash="run_once" />,
  )

beforeEach(() => setCaveat(`${REASON} That is not a guarantee. Defaulted inputs could still change it.`))
afterEach(cleanup)

describe('the held-up sentence is said once', () => {
  it('⭐ the caveat opens with the verdict reason → the glance line steps aside; the caveat stays', () => {
    draw()
    expect(screen.getByTestId('analysis-new-robustness-caveat-text')).toHaveTextContent('That is not a guarantee.')
    expect(screen.queryByTestId('analysis-new-glance-verdict-reason')).toBeNull()
  })

  it('CONTROL: a caveat that says something else → the glance keeps its own reason', () => {
    setCaveat('Below a 12% conversion rate the ordering reverses.')
    draw()
    expect(screen.getByTestId('analysis-new-robustness-caveat-text')).toBeInTheDocument()
    expect(screen.getByTestId('analysis-new-glance-verdict-reason')).toHaveTextContent(REASON)
  })

  it('the restatement test is an exact prefix on a sentence boundary, never a similarity guess', () => {
    expect(caveatRestatesVerdictReason(`${REASON} More.`, REASON)).toBe(true)
    expect(caveatRestatesVerdictReason('this run held up under the changes we tested. x', 'This run held up under the changes we tested')).toBe(true)
    expect(caveatRestatesVerdictReason('The ordering held across the simulated range of prices.', 'The ordering held across the simulated range')).toBe(false)
    expect(caveatRestatesVerdictReason(null, REASON)).toBe(false)
    expect(caveatRestatesVerdictReason(REASON, null)).toBe(false)
  })

  // ⭐ Served 0d334f7a (support journey): the glance read "Sensitive · Small changes to your assumptions could
  // change which option is most likely to achieve your goal" and "How far this held" read "This run was
  // fragile under the changes we tested. Small changes to your assumptions could change which option is most
  // likely to achieve your goal." — the reason is the caveat's SECOND sentence, so the prefix rule missed it.
  const SERVED_REASON = 'Small changes to your assumptions could change which option is most likely to achieve your goal'
  const SERVED_CAVEAT =
    'This run was fragile under the changes we tested. Small changes to your assumptions could change which option is most likely to achieve your goal.'

  it('⭐ a caveat that states the reason as a LATER whole sentence restates it too (served 0d334f7a)', () => {
    expect(caveatRestatesVerdictReason(SERVED_CAVEAT, SERVED_REASON)).toBe(true)
    expect(caveatRestatesVerdictReason(SERVED_CAVEAT, `${SERVED_REASON}.`)).toBe(true)
  })

  it('CONTRAST: the reason only as the START of a longer sentence is not a restatement (whole sentences only)', () => {
    expect(
      caveatRestatesVerdictReason(`This run was fragile. ${SERVED_REASON} unless demand recovers.`, SERVED_REASON),
    ).toBe(false)
  })
})

describe('the tipping point is said once', () => {
  const LOOSE = { label: 'Two-month timeframe', node_id: 'n_time', current_value: 2, flip_value: 3 }
  const FOUND = { ...LOOSE, flip_reason: 'found', alternative_winner_label: 'Hold price' }
  const withFlip = (row: object = FOUND): ResultsSectionDataReturn => {
    const d = genuineDecision()
    return { ...d, recommendation: { ...d.recommendation, flipThresholdsStatus: 'computed', flipThresholds: [row] } } as ResultsSectionDataReturn
  }

  it('⭐ the Challenge row states it → no "Could change if" in the reading', () => {
    draw(withFlip())
    expect(screen.getByTestId('analysis-new-signals-tipping-sentence')).toHaveTextContent('Two-month timeframe')
    expect(screen.queryByTestId('analysis-new-glance-condition')).toBeNull()
  })

  it('CONTROL: the Challenge row cannot state it (no found flip) → the reading keeps its condition', () => {
    draw(withFlip(LOOSE))
    expect(screen.queryByTestId('analysis-new-signals-tipping-sentence')).toBeNull()
    expect(screen.getByTestId('analysis-new-glance-condition')).toHaveTextContent('Two-month timeframe')
  })
})
