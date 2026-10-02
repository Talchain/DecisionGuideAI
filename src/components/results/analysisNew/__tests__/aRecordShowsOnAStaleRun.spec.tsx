/**
 * ⭐ DECIDE & REVIEW S1 (Codex r2 P1 on the UI half): Run → record a decision → edit the model → open on ANOTHER
 * device. The read ships no result block on a stale Run (`complete_stale`), so the panel is pre-run — and the user's
 * own recorded decision, read back from the account, must still show. Read only: no capture act pre-run.
 * Bound by identity: the exact option label and the account sentence, on the pre-run section's own test ids.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn(() => true) }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { useCanvasStore } from '../../../../canvas/store'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import * as S from '../../modals/decisionRecordStore'
import { readListedRecord } from '../../../../services/decisionRecordListService'
import { storageSentenceFor } from '../sections/DecisionRecorded'
import { openStrategicChallenge } from './analysisNewFixtures'

const SCENARIO_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OWNER_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const LISTED = {
  record_id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', created_at: '2026-10-02T08:00:00.000Z', review_date: '2026-12-31T00:00:00.000Z',
  graph_hash: 'aag_v1:abc', has_outcome: false, position: 'chosen', chosen_option_id: 'o2', chosen_option_label: 'Angel Outreach Pilot',
  confidence_0_100: 72.4, expectation_statement: 'Two term sheets by March.', rationale: 'Cheaper to reverse.',
}
const T = 'analysis-new-commitment-pre-run-record'

afterEach(cleanup)
beforeEach(() => {
  localStorage.clear()
  S.useDecisionRecordStore.getState()._reset()
  useCanvasStore.setState({
    currentScenarioId: SCENARIO_ID,
    nodes: [
      { id: 'g1', type: 'goal', data: { label: 'Secure funding' } },
      { id: 'o1', type: 'option', data: { label: 'Continue Current Process' } },
      { id: 'o2', type: 'option', data: { label: 'Angel Outreach Pilot' } },
    ],
    goalThreshold: null,
  } as never)
  useStrengthenStore.setState({ records: {} })
})

const drawPreRun = () =>
  render(
    <AnalysisNewTabBody
      resultsSectionData={openStrategicChallenge()}
      isPreRun
      isRunning={false}
      isStale={false}
      blockedListing={null}
      runOnRecordWithoutResult="stale"
    />,
  )

describe('a recorded decision shows on a stale Run with no result held (another device)', () => {
  it('RED on the first cut: the account\'s record shows — its choice and the account sentence — with no capture act', () => {
    S.observeDecisionRecordOwner(OWNER_ID)
    const record = readListedRecord(LISTED)!
    expect(S.hydrateDecisionRecordFromServer(SCENARIO_ID, OWNER_ID, record, S.useDecisionRecordStore.getState().ownerEpoch!)).toBe(true)
    drawPreRun()
    expect(screen.getByTestId('analysis-new-status-pre-run')).toBeInTheDocument()
    expect(screen.getByTestId(T)).toHaveTextContent('Angel Outreach Pilot')
    expect(screen.getByTestId(`${T}-storage`)).toHaveTextContent(storageSentenceFor(record))
    expect(screen.queryByTestId(`${T}-update`)).toBeNull()
    expect(screen.queryByTestId(`${T}-open`)).toBeNull()
  })
  it('CONTROL: with no record, the pre-run section carries no record block at all', () => {
    S.observeDecisionRecordOwner(OWNER_ID)
    drawPreRun()
    expect(screen.getByTestId('analysis-new-status-pre-run')).toBeInTheDocument()
    expect(screen.queryByTestId(T)).toBeNull()
  })
})
