/**
 * Slice D-4, the withheld-leak row (AIQ #70 5855170731 item 24; R&C 5855222422).
 * On 3/3 of Paul's withheld turns the result still carried
 * `alternative_winner_label` (export 17d1cd3a: price→MRR, switch 0.638, "Keep
 * current £49 price"). A withheld leader means no option is put forward, so
 * no surface may say which option a change would hand the lead to.
 *
 * The alternative is a SENTINEL here, so the assertion is about the field
 * reaching the screen, never about an option label that appears legitimately.
 * POSITIVE CONTROL: the same data with the leader licensed does show it, so
 * the absence on the withheld run is not a fixture that reaches nothing.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { openGroups, openAllSections } from './openNamedGroups'
import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import { decisionWithLeaderWithheld, withLeaderLicensed } from './analysisNewFixtures'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'

const SENTINEL = 'Sentinel Alternative Q7'

function withAlternatives(data: ResultsSectionDataReturn): ResultsSectionDataReturn {
  const fragile = {
    code: 'SENSITIVE_ASSUMPTION',
    message: 'If "Pro plan price → MRR" changes significantly, the comparison could land differently.',
    displayText: 'If "Pro plan price → MRR" changes significantly, the comparison could land differently.',
    edgeFromLabel: 'Pro plan price',
    edgeToLabel: 'MRR',
    edgeLabelsResolved: true,
    severity: 'warning' as const,
    switchProbability: 0.638,
    alternativeWinnerId: 'opt_sentinel',
    alternativeWinnerLabel: SENTINEL,
  }
  return {
    ...data,
    recommendation: {
      ...data.recommendation,
      flipThresholds: [
        { factor_id: 'pro_plan_price', label: 'Pro plan price', flip_reason: 'found', current_value: 49, flip_value: 62, unit: 'GBP per month', alternative_winner_label: SENTINEL, node_id: 'pro_plan_price' },
      ],
      topFragileEdge: { fromId: 'pro_plan_price', fromLabel: 'Pro plan price', toId: 'mrr', toLabel: 'MRR', alternativeWinnerLabel: SENTINEL, alternativeWinnerId: 'opt_sentinel', switchProbability: 0.638 },
    } as never,
    confidence: { ...data.confidence, uncertainties: [...((data.confidence as { uncertainties?: unknown[] })?.uncertainties ?? []), fragile] } as never,
  }
}

const renderOpen = (data: ResultsSectionDataReturn) => {
  render(<AnalysisNewTabBody resultsSectionData={data} isPreRun={false} isRunning={false} isStale={false} responseHash="run_leak" />)
  openGroups()
  openAllSections()
  return document.body.textContent ?? ''
}

beforeEach(() => {
  useStrengthenStore.setState({ records: {}, priorityOrder: [] } as never)
})
afterEach(() => cleanup())

describe('a withheld leader names no alternative winner', () => {
  it('POSITIVE CONTROL: with the leader licensed, the alternative reaches the screen', () => {
    expect(renderOpen(withLeaderLicensed(withAlternatives(decisionWithLeaderWithheld())))).toContain(SENTINEL)
  })

  it('⭐ withheld: no surface names the alternative', () => {
    const text = renderOpen(withAlternatives(decisionWithLeaderWithheld()))
    // PRECONDITION: the tab rendered its sections.
    expect(screen.getByTestId('analysis-new-tab-body')).toBeInTheDocument()
    expect(text).not.toContain(SENTINEL)
  })
})
