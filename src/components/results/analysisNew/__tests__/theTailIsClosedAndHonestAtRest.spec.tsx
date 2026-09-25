/**
 * ⭐ V2 FIDELITY GAPS 25 + 26 — the tail is closed at rest, and its rows only
 * name what they hold.
 *
 * 25: "Coaching and method" opened ITSELF whenever bias findings existed, so the
 *     resting panel ended in a block of citations. The prototype opens nothing
 *     below the commitment section at rest.
 * 26: "How this was worked out" counted `vm.checks.items`, which now render as
 *     About's rows, so the header read "· 3" and opened onto no checks. It counts
 *     what it holds (the uncertainty findings), and neither subtitle promises
 *     checks or receipts that live in About.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { buildBiasGrounding } from '../biasGrounding'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import { useCanvasStore } from '../../../../canvas/store'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import { genuineDecision } from './analysisNewFixtures'

const FINDING = {
  id: 'overconfidence_narrow_belief_band',
  code: 'OVERCONFIDENCE',
  category: 'other',
  citation: 'Lichtenstein et al. (1982) - Judgment Under Uncertainty',
  severity: 'high',
  mechanism: 'Excessive certainty in own judgments.',
  explanation: 'Edge beliefs are all high and tightly clustered.',
  confidence_band: 'medium',
  micro_intervention: { steps: ['List three things you might be wrong about'], estimated_minutes: 3 },
}

let previous: unknown
beforeEach(() => {
  previous = useCanvasStore.getState().ceeAnalysisReady
  useStrengthenStore.setState({ records: {}, priorityOrder: [] } as never)
})
afterEach(() => {
  cleanup()
  useCanvasStore.setState({ ceeAnalysisReady: previous } as never)
})

const renderBody = () =>
  render(<AnalysisNewTabBody resultsSectionData={genuineDecision()} isPreRun={false} isRunning={false} isStale={false} responseHash="tail" />)

describe('the tail at rest', () => {
  it('PRECONDITION: the finding produces grounding the section would have opened for', () => {
    expect(buildBiasGrounding([FINDING] as never).length).toBeGreaterThan(0)
  })

  // V2 fidelity gap 24 (24 Sep 2026): the "Coaching and method" shell is gone;
  // the grounding folds into About. The rule this pinned (closed at rest even
  // with bias findings) is kept, re-pointed at About.
  it('the bias grounding stays closed at rest even with bias findings (now inside About)', () => {
    useCanvasStore.setState({ ceeAnalysisReady: { ...(previous as object), bias_findings: [FINDING] } } as never)
    renderBody()
    expect(screen.getByTestId('analysis-new-about-toggle')).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByTestId('analysis-new-bias-grounding')).toBeNull()
    // Contrast: one click on About and the grounding is there — the absence above is the rest state, not a failed render.
    fireEvent.click(screen.getByTestId('analysis-new-about-toggle'))
    expect(screen.getByTestId('analysis-new-bias-grounding')).toBeInTheDocument()
  })

  // V2 fidelity gap 24: the "How this was worked out" group (and so its count)
  // is deleted; the uncertainty findings it counted fold into About. The
  // subtitle half of this case is a copy rule and is kept as it was.
  it('no subtitle promises what About holds', () => {
    expect(COPY.sectionSubtitles.howWorkedOut).not.toMatch(/check/i)
    expect(COPY.sectionSubtitles.whatMovesTheOutcome).not.toMatch(/receipt/i)
  })
})
