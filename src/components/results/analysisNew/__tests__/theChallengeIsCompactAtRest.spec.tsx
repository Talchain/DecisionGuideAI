/**
 * ⭐ THE CHALLENGE IS COMPACT AT REST — V2 prototype `challengeHTML`.
 *
 * Measured on served `7f39c88b` (24 Sep 2026, 1440×900, OpenAI path, explicit
 * first run, leader withheld): the challenge zone was 189px, almost all of it
 * the open "Top drivers" list, and it held the provisional qualifier under the
 * chart below the fold (qualifier top 938 against a fold of 829). The prototype
 * puts the drivers behind ONE closed "Assumptions and evidence" disclosure.
 *
 * Pinned: closed at rest on the Reasoning tab, one click opens it and nothing
 * is lost; the component's other callers keep the open list (contrast).
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { ReasoningSignals } from '../sections/ReasoningSignals'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { buildReasoningSignals } from '../reasoningSignals'
import { CHALLENGE_ZONE_COPY as ZONE } from '../challengeZoneCopy'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import { genuineDecision } from './analysisNewFixtures'

const vm = () =>
  buildAnalysisNewViewModel({ data: genuineDecision(), recommendations: [], isPreRun: false, isRunning: false, isStale: false })

beforeEach(() => useStrengthenStore.setState({ records: {}, priorityOrder: [] } as never))
afterEach(cleanup)

describe('the challenge is compact at rest', () => {
  it('PRECONDITION: the fixture has drivers the list would show', () => {
    expect(buildReasoningSignals(vm(), undefined)?.drivers.length ?? 0).toBeGreaterThan(0)
  })

  it('the drivers sit behind one closed "Assumptions and evidence" disclosure, inside the challenge zone', () => {
    render(
      <AnalysisNewTabBody resultsSectionData={genuineDecision()} isPreRun={false} isRunning={false} isStale={false} responseHash="compact" />,
    )
    const zone = screen.getByTestId('analysis-new-zone-also-group')
    const door = within(zone).getByTestId('analysis-new-signals-disclose')
    expect(door).toHaveTextContent(ZONE.assumptionsAndEvidence)
    expect(door).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByTestId('analysis-new-signals-drivers')).toBeNull()
    // Paul's 18 Sep ruling: the drivers are READ before the answer, so the rest
    // state still names them, in the producer's order, on one line.
    const line = within(zone).getByTestId('analysis-new-signals-drivers-line')
    for (const d of buildReasoningSignals(vm(), undefined)!.drivers) expect(line).toHaveTextContent(d.label)

    fireEvent.click(door)
    expect(within(zone).getByTestId('analysis-new-signals-drivers')).toBeInTheDocument()
    const openDoor = within(zone).getByTestId('analysis-new-signals-disclose')
    expect(openDoor).toHaveAttribute('aria-expanded', 'true')

    fireEvent.click(openDoor)
    expect(screen.queryByTestId('analysis-new-signals-drivers')).toBeNull()
  })

  it('CONTRAST: another caller, with no prop, keeps the open list and no door', () => {
    render(<ReasoningSignals vm={vm()} flipThresholds={undefined} />)
    expect(screen.getByTestId('analysis-new-signals-drivers')).toBeInTheDocument()
    expect(screen.queryByTestId('analysis-new-signals-disclose')).toBeNull()
  })
})
