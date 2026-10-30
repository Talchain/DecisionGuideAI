/**
 * P1 S6 (30 Oct, DL contract): on a program board the decision record door opens on the board's own current Run. A program
 * Run never completes `results` (no legacy report), so the legacy gate `hasAnalysedOptions(nodes, results.status)` left the
 * door unmounted and the modal's option set empty. The door's gate is `useProgramBoardShowsResult()` and not a viewer; the
 * modal's options are that Run's canonical options, named by their option nodes. No hash is sent: CEE anchors the commit to
 * the same stored Run (assist.v1.decision-records.ts, S5). A legacy board is unchanged.
 * Fixture: CEE's served read of a program board (S3 smoke-alpha2 r1 capacity, bound and current). Expected words inline.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn(() => true) }))
vi.mock('../../../../lib/supabase', () => ({
  supabase: {},
  getSessionIdentity: async () => ({ userId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', accessToken: 'test-access-token' }),
}))
/** The saved model as the graph route read it: a program (`model_program: 'v1'`) or, with null, no read (a legacy board). */
const saved: { graph: unknown } = { graph: null }
vi.mock('../../../../canvas/nodes/shared/savedGraph', () => ({
  useSavedGraph: () => saved.graph,
  useSavedGraphRead: () => (saved.graph === null ? { status: 'none' } : { status: 'read', graph: saved.graph }),
}))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { DecisionRecordModal } from '../../modals/DecisionRecordModal'
import { observeDecisionRecordOwner, openDecisionRecord, useDecisionRecordStore } from '../../modals/decisionRecordStore'
import { useCanvasStore } from '../../../../canvas/store'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import { useCanonicalAnalysisViewStore } from '../../../../canvas/stores/canonicalAnalysisViewStore'
import { parseCanonicalAnalysisView } from '../../../../canvas/runView/canonicalAnalysisView'
import { setViewerScenario } from '../../../../lib/viewerMode'
import { openStrategicChallenge } from './analysisNewFixtures'
import capacity from '../../../../canvas/runView/__tests__/fixtures/alpha2-capacity-r1-read.json'

type Read = { scenario_id: string; graph: { nodes: { id: string; kind: string; label: string }[] }; canonical_analysis_view: Record<string, unknown> }
const read = capacity as Read
const DOOR = 'analysis-new-commitment-record-open'
const OWNER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
// CEE's served stale face (hydrate/__tests__/fixtures/founder-blocked-reopen-247ae5b4.read.json).
const STALE_FACE = 'Run the analysis again to see the chance.'

let fetchMock: Mock<Parameters<typeof fetch>, Promise<Response>>
beforeEach(() => {
  useStrengthenStore.setState({ records: {} })
  localStorage.clear()
  useDecisionRecordStore.getState()._reset()
  observeDecisionRecordOwner(OWNER)
  fetchMock = vi.fn<Parameters<typeof fetch>, Promise<Response>>(async () => ({ ok: true, status: 201, json: async () => ({ record_id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    review_date: '2027-06-30T00:00:00.000Z', review_date_source: 'user_set', deduped: false }) }) as unknown as Response)
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  cleanup()
  act(() => setViewerScenario(null))
  useCanonicalAnalysisViewStore.setState({ scenarioId: null, view: null })
  saved.graph = null
  vi.unstubAllGlobals()
})

/** The board pre-run (no report held: a program Run writes none), its saved model, and CEE's served view, or changed. */
const board = ({ program, view = {} }: { program: boolean; view?: Record<string, unknown> }) => {
  saved.graph = program ? { living_model: { model_program: 'v1' } } : null
  useCanvasStore.setState({
    currentScenarioId: read.scenario_id,
    nodes: read.graph.nodes.map(n => ({ id: n.id, type: n.kind, data: { label: n.label } })),
    goalThreshold: null,
    optionNumbering: {},
    results: { ...useCanvasStore.getState().results, report: null, status: 'idle', hash: null },
  } as never)
  const parsed = parseCanonicalAnalysisView({ ...read.canonical_analysis_view, ...view })
  expect(parsed).not.toBeNull()
  useCanonicalAnalysisViewStore.getState().adopt(read.scenario_id, parsed)
}
const draw = () => render(
  <>
    <AnalysisNewTabBody resultsSectionData={openStrategicChallenge()} isPreRun isRunning={false} isStale={false}
      blockedListing={null} canRunAnalysis onReanalyse={() => {}} />
    <DecisionRecordModal />
  </>,
)
const optionsOffered = () => Array.from((screen.getByTestId('decision-record-option') as HTMLSelectElement).options)
  .filter(o => o.value !== '').map(o => [o.value, o.textContent])

describe('S6: the decision record door on a program board opens on its own current Run', () => {
  it('(a) bound and current Run, no report: the door, the Run’s options by their labels, and a commit naming one of them with no hash', async () => {
    board({ program: true })
    draw()
    fireEvent.click(screen.getByTestId(DOOR))
    expect(screen.getByTestId('decision-record-modal')).toBeInTheDocument()
    expect(optionsOffered()).toEqual([['keep_current_staffing', 'Keep current staffing'], ['add_one_specialist', 'Add one specialist']])
    fireEvent.change(screen.getByTestId('decision-record-option'), { target: { value: 'add_one_specialist' } })
    fireEvent.change(screen.getByTestId('decision-record-confidence'), { target: { value: '65' } })
    fireEvent.change(screen.getByTestId('decision-record-expectation'), { target: { value: 'Weekly capacity reaches 100 tickets by June.' } })
    fireEvent.change(screen.getByTestId('decision-record-revisit'), { target: { value: '2027-06-30' } })
    fireEvent.change(screen.getByTestId('decision-record-rationale'), { target: { value: 'The added specialist is the only route to the target.' } })
    fireEvent.change(screen.getByTestId('decision-record-assumption'), { target: { value: 'The new specialist ramps within a month.' } })
    await act(async () => { fireEvent.click(screen.getByTestId('decision-record-save')) })
    // The tab's own read of saved records (`/decision-records/list`) is not the commit; exactly one commit is sent.
    const commits = fetchMock.mock.calls.filter((c) => String(c[0]) === '/bff/cee/decision-records/commit') as unknown as [string, RequestInit][]
    expect(commits).toHaveLength(1)
    const [, init] = commits[0]
    const body = JSON.parse(init.body as string) as Record<string, unknown>
    expect(body).toMatchObject({ scenario_id: read.scenario_id, chosen_option_id: 'add_one_specialist', chosen_option_label: 'Add one specialist' })
    // CEE derives the anchor from the stored Run (S5): the UI sends no hash of any kind.
    expect(Object.keys(body).filter(k => /hash|run_id|anchor/i.test(k))).toEqual([])
  })

  it('(b) contrast: the bound Run is stale: no door, and the modal offers no option', () => {
    board({ program: true, view: { staleness: { ...(read.canonical_analysis_view.staleness as object), stale: true, reason: 'graph_changed' }, face_when_stale: STALE_FACE } })
    draw()
    expect(screen.queryByTestId(DOOR)).toBeNull()
    act(() => openDecisionRecord())
    expect(optionsOffered()).toEqual([])
  })

  it('(c) contrast: a viewer of the board is never offered the door', () => {
    board({ program: true })
    act(() => setViewerScenario(read.scenario_id))
    draw()
    expect(screen.queryByTestId(DOOR)).toBeNull()
  })

  /** Opens the form on the current Run (the door's own `openDecisionRecord`, so this row never depends on (a)'s gate) and fills it. */
  const openAndFill = () => {
    act(() => openDecisionRecord())
    fireEvent.change(screen.getByTestId('decision-record-option'), { target: { value: 'add_one_specialist' } })
    fireEvent.change(screen.getByTestId('decision-record-confidence'), { target: { value: '65' } })
    fireEvent.change(screen.getByTestId('decision-record-expectation'), { target: { value: 'Weekly capacity reaches 100 tickets by June.' } })
    fireEvent.change(screen.getByTestId('decision-record-revisit'), { target: { value: '2027-06-30' } })
    fireEvent.change(screen.getByTestId('decision-record-rationale'), { target: { value: 'The added specialist is the only route to the target.' } })
    fireEvent.change(screen.getByTestId('decision-record-assumption'), { target: { value: 'The new specialist ramps within a month.' } })
    expect(screen.getByTestId('decision-record-save')).not.toBeDisabled()
  }
  const commitsSent = () => fetchMock.mock.calls.filter((c) => String(c[0]) === '/bff/cee/decision-records/commit').length
  const pressSave = async () => {
    const save = screen.queryByTestId('decision-record-save')
    if (save !== null) { expect(save).toBeDisabled(); await act(async () => { fireEvent.click(save) }) }
  }

  it('(e) PL 04:34Z: the Run goes stale while the form is open: the door closes, Save is refused, nothing is sent', async () => {
    board({ program: true })
    draw()
    openAndFill()
    act(() => useCanonicalAnalysisViewStore.getState().adopt(read.scenario_id, parseCanonicalAnalysisView({ ...read.canonical_analysis_view,
      staleness: { ...(read.canonical_analysis_view.staleness as object), stale: true, reason: 'graph_changed' }, face_when_stale: STALE_FACE })))
    expect(screen.queryByTestId(DOOR)).toBeNull()
    await pressSave()
    expect(commitsSent()).toBe(0)
  })

  it('(e2) PL 04:34Z: the board switches scenario while the form is open: Save is refused, nothing is sent', async () => {
    board({ program: true })
    draw()
    openAndFill()
    act(() => useCanvasStore.setState({ currentScenarioId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' } as never))
    expect(screen.queryByTestId(DOOR)).toBeNull()
    await pressSave()
    expect(commitsSent()).toBe(0)
  })

  it('(d) legacy unchanged: a board that is not a program, with the same view held and no completed run, has no door and no options', () => {
    board({ program: false })
    draw()
    expect(screen.queryByTestId(DOOR)).toBeNull()
    act(() => openDecisionRecord())
    expect(optionsOffered()).toEqual([])
  })
})
