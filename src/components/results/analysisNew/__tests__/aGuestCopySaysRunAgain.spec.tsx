/**
 * S-G slice 2 (DL ruling (a), 7 Oct 2026): a decision COPIED from a guest at sign-in keeps no Run. When its copied
 * replies quote figures, the Analysis tab's pre-run status says "Run again to see results here" — never the bare
 * "No analysis has run yet", which would leave the copied figures reading as this decision's results.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn(() => true) }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { useCanvasStore } from '../../../../canvas/store'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import { GUEST_COPY_RUN_AGAIN, useGuestCopyOriginStore } from '../../../../canvas/stores/guestCopyOriginStore'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import { openStrategicChallenge } from './analysisNewFixtures'

const COPY_ID = 'fa02a890-0000-4000-8000-000000000001'

afterEach(() => { cleanup(); useGuestCopyOriginStore.getState().reset() })
beforeEach(() => {
  useCanvasStore.setState({
    nodes: [
      { id: 'g1', type: 'goal', data: { label: 'Secure funding' } },
      { id: 'o1', type: 'option', data: { label: 'Continue Current Process' } },
      { id: 'o2', type: 'option', data: { label: 'Angel Outreach Pilot' } },
    ],
    goalThreshold: null,
    currentScenarioId: COPY_ID,
  } as never)
  useStrengthenStore.setState({ records: {} })
})

const draw = () => render(
  <AnalysisNewTabBody resultsSectionData={openStrategicChallenge()} isPreRun isRunning={false} isStale={false} blockedListing={null} />,
)
const status = () => screen.getByTestId('analysis-new-status-pre-run')

describe('the Analysis tab on a guest copy', () => {
  it('⭐ copied replies quote figures → "Run again to see results here"', () => {
    useGuestCopyOriginStore.getState().recordScenarioRow({ id: COPY_ID, source_scenario_id: '657e63ef-f220-4fd5-9b4b-25e04334b3e4', created_at: '2026-10-07T08:40:58Z' })
    useGuestCopyOriginStore.getState().noteEarlierAnalysisCopied(COPY_ID)
    draw()
    expect(status()).toHaveTextContent(GUEST_COPY_RUN_AGAIN)
    expect(status()).not.toHaveTextContent(COPY.status.preRun)
  })

  it('CONTRAST: a decision that is not a guest copy keeps "No analysis has run yet"', () => {
    draw()
    expect(status()).toHaveTextContent(COPY.status.preRun)
    expect(status()).not.toHaveTextContent(GUEST_COPY_RUN_AGAIN)
  })

  it('CONTRAST: a guest copy whose copied replies quote nothing keeps "No analysis has run yet"', () => {
    useGuestCopyOriginStore.getState().recordScenarioRow({ id: COPY_ID, source_scenario_id: '657e63ef-f220-4fd5-9b4b-25e04334b3e4', created_at: '2026-10-07T08:40:58Z' })
    draw()
    expect(status()).toHaveTextContent(COPY.status.preRun)
  })
})
