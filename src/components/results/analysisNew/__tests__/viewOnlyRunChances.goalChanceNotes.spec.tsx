/**
 * Paul's staging tests, 29 Oct (saved scenarios d12634b4 "Marketing manager or AI?" and 87549695): CEE serves its own
 * disclosures beside the goal chance in `canonical_analysis_view.goal_chance.notes` (what the chance covers and leaves
 * out, "X is not in this run: …", the independence note, and "Olumi read from your words which figures are yours; if it
 * has one wrong, say so."). The parser kept them and the board's view-only block (`useViewOnlyRunChances`) never said
 * them, so every disclosure was invisible. Now, on a PROGRAM board, every note is said verbatim, in CEE's order, under the
 * chances in the same block, for a current Run only (as the chances and CEE's "most likely" sentence are). The UI removes
 * no note (DL, 29 Oct): a repeat is fixed at the producer. A board that is not a program is unchanged.
 *
 * Fixtures: CEE's served reads of the capacity program board (pass 35463f30, current) and of the same board opened after a
 * deploy (s2, stale), and the grant board after the Run press (CEE 2de696a9 witness), whose every option waits. The grant
 * capture is trimmed to its graph nodes, so the saved read below is given the graph route's own envelope and the program
 * marker, as CEE serves a program board. The notes are CEE's own words, not composed here: the Covers and "not in this run"
 * notes as CEE served them on 27 Oct (q-harness H03 D5 `analysis.json`, `goal_chance.notes`), the disclosure as served on
 * Paul's 29 Oct test.
 * Real path: the real `AnalysisNewTabBody`, the real saved-graph read for the program flag (only `fetch` stubbed).
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn(() => true) }))
vi.mock('../../../../lib/supabase', () => ({ getUserId: async () => null, getSessionIdentity: async () => ({ userId: null, accessToken: null }) }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { useCanvasStore } from '../../../../canvas/store'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import { useCanonicalAnalysisViewStore } from '../../../../canvas/stores/canonicalAnalysisViewStore'
import { parseCanonicalAnalysisView } from '../../../../canvas/runView/canonicalAnalysisView'
import { useSavedModelProgramState } from '../../../../canvas/nodes/shared/savedModelProgram'
import { openStrategicChallenge } from './analysisNewFixtures'
import current from '../../../../canvas/runView/__tests__/fixtures/pass-capacity-35463f30-read.json'
import stale from '../../../../canvas/runView/__tests__/fixtures/s2-capacity-stale-after-deploy-read.json'
import grant from '../../../../canvas/runView/__tests__/fixtures/w3735-grant-press-read.json'

type Json = Record<string, any>
const KEEP = 'keep_current_staffing'
const ADD = 'add_one_specialist'
const COVERS = 'Covers: ‘Reported monthly logo churn’ being below 2% at 22 weeks from the start of this model · Leaves out: ‘Customer engagement, customer value and renewal retention after annual lock-in expires.’, ‘The chance that March\'s observed churn differs from its underlying rate because of seasonality, customer mix or clustered cancellations.’ and ‘Onboarding development opportunity cost, employer on-costs and recruitment costs.’'
const NOT_IN_RUN = 'The option ‘Hire two customer success people’ is not in this run: needs "Weeks until the new customer success staff start".'
const YOURS = 'Olumi read from your words which figures are yours; if it has one wrong, say so.'
const NOTES = [COVERS, NOT_IN_RUN, YOURS]
const STALE_LINE = 'Run the analysis again to see the chance.'

let read: Json = {}
let n = 0

/** CEE's served view with these `goal_chance.notes`, through the real parser. */
function viewWith(source: Json, notes: readonly string[]) {
  const served: Json = structuredClone(source.canonical_analysis_view)
  served.goal_chance = { ...served.goal_chance, notes }
  return parseCanonicalAnalysisView(served)
}

/** What the saved read answered for the board, so a contrast that says nothing is not merely a read still pending. */
function ProgramStateProbe() {
  return <span data-testid="program-state-probe">{useSavedModelProgramState()}</span>
}

/**
 * The board on screen (pre-run), its saved read served in the graph route's envelope (a program board unless `program` is
 * false), and the read's view adopted with these notes.
 */
async function board(source: Json, notes: readonly string[], program = true) {
  n += 1
  const living = { ...(source.graph.living_model ?? {}) }
  if (program) living.model_program = 'v1'
  else delete living.model_program
  const hash = `${String(source.graph_hash ?? source.scenario_id.replace(/-/g, '')).slice(0, 12)}${String(n).padStart(4, '0')}`
  read = { schema: 'scenario_graph.v1', graph_present: true, ...source, graph_hash: hash, graph: { ...source.graph, living_model: living } }
  useCanvasStore.setState({
    currentScenarioId: source.scenario_id, lastServerGraphHash: hash,
    nodes: source.graph.nodes.map((x: Json, i: number) => ({ id: x.id, type: x.kind, position: { x: 0, y: i * 100 }, data: { label: x.label } })),
    edges: [], goalThreshold: null, results: { ...useCanvasStore.getState().results, report: null, status: 'idle' },
  } as never)
  const view = viewWith(source, notes)
  expect(view).not.toBeNull()
  expect(view!.goal_chance?.notes).toEqual(notes)
  useCanonicalAnalysisViewStore.getState().adopt(source.scenario_id, view)
  render(<>
    <ProgramStateProbe />
    <AnalysisNewTabBody resultsSectionData={openStrategicChallenge()} isPreRun isRunning={false} isStale={false}
      blockedListing={null} canRunAnalysis onReanalyse={() => {}} />
  </>)
  await act(async () => { await new Promise((r) => setTimeout(r, 30)) })
  // PRECONDITION: the saved read answered, and it says what kind of board this is.
  expect(screen.getByTestId('program-state-probe').textContent).toBe(program ? 'program' : 'not_program')
}
const block = () => screen.getByTestId('analysis-view-only-chances')
const said = () => screen.queryAllByTestId('analysis-view-only-note').map(e => e.textContent)
const occurrences = (text: string, of: string) => text.split(of).length - 1

beforeEach(() => {
  useStrengthenStore.setState({ records: {} })
  window.history.replaceState(null, '', '/?ai=core-route')
  vi.stubGlobal('fetch', vi.fn(async (url: string) => (
    /\/scenarios\/[^/]+\/graph$/.test(String(url))
      ? new Response(JSON.stringify(read), { status: 200, headers: { 'Content-Type': 'application/json' } })
      : new Response('{}', { status: 404 })
  )))
})
afterEach(() => {
  cleanup(); vi.unstubAllGlobals(); window.history.replaceState(null, '', '/')
  useCanonicalAnalysisViewStore.setState({ scenarioId: null, view: null })
})

describe('a program board says CEE’s goal-chance notes under the chances', () => {
  it('a current Run: all three notes, verbatim, once each, in CEE’s order, under both options’ chance lines', async () => {
    await board(current as Json, NOTES)
    expect(said()).toEqual(NOTES)
    const text = block().textContent!
    for (const note of NOTES) expect(occurrences(text, note)).toBe(1)
    // Under the chances, in the same block: each option's own chance line still stands, and the notes follow the last one.
    const keep = screen.getByTestId(`analysis-view-only-chance-${KEEP}`), add = screen.getByTestId(`analysis-view-only-chance-${ADD}`)
    expect(keep.textContent).toMatch(/^‘Keep current staffing’: 0% chance/)
    expect(add.textContent).toMatch(/^‘Add one specialist’: about 76% chance/)
    const notes = screen.getByTestId('analysis-view-only-notes')
    expect(block()).toContainElement(notes)
    expect(add.compareDocumentPosition(notes) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(keep).not.toContainElement(notes)
    expect(add).not.toContainElement(notes)
  })

  it('the served read’s own single note is said too (contrast: the notes come from the view, not the test)', async () => {
    await board(current as Json, (current as Json).canonical_analysis_view.goal_chance.notes)
    expect(said()).toEqual(['No deadline is recorded yet for ‘Weekly support capacity’: is there one?'])
  })

  it('every option waiting: the notes as CEE now sends them are said verbatim beside the waits headline', async () => {
    // DL, 29 Oct (CEE GAP 3, shipping with this change): CEE no longer sends the note that restates a single waiting aim's
    // waits_on list (the headline and the cells' `why` carry it). The grant capture predates that, so its first note,
    // "‘come across as credible to the grant panel’ waits on ‘Score on the panel's published scoring sheet’, …", is left
    // out here, as CEE now serves it; its other two notes stand as served.
    const g = grant as Json
    const [singleAimWaits, covers, notChecked] = g.canonical_analysis_view.goal_chance.notes as string[]
    expect(singleAimWaits).toMatch(/^‘come across as credible to the grant panel’ waits on /)
    await board(g, [covers, notChecked])
    expect(screen.getByTestId('analysis-view-only-waits-headline')).toBeTruthy()
    // The program path: each option's own reason beside its name (W8 c5), which only a program board says.
    expect(screen.getByTestId('analysis-view-only-reason-prototype_led+protected_grant_block+learn_then_rebalance')).toBeTruthy()
    expect(said()).toEqual([covers, notChecked])
  })

  it('beside the waits headline: a note carrying the disclosure, a "not in this run" note and a Covers note, all verbatim', async () => {
    // The first note is the independent review's probe shape: waits-on words followed by a disclosure. The UI reads no
    // note's words, so it is said whole, as are the disclosure on its own and the two served notes.
    const probe = `The chance waits on ‘Score on the panel's published scoring sheet’. ${YOURS}`
    const notes = [probe, YOURS, NOT_IN_RUN, COVERS]
    await board(grant as Json, notes)
    expect(screen.getByTestId('analysis-view-only-waits-headline')).toBeTruthy()
    expect(said()).toEqual(notes)
    const text = block().textContent!
    expect(occurrences(text, probe)).toBe(1)
    expect(occurrences(text, NOT_IN_RUN)).toBe(1)
    expect(occurrences(text, COVERS)).toBe(1)
  })

  it('a Run that is not current: CEE’s not-current line, and none of the notes (the chance gate stands)', async () => {
    await board(stale as Json, NOTES)
    expect(screen.getByTestId(`analysis-view-only-chance-${KEEP}+${ADD}`).textContent).toBe(STALE_LINE)
    expect(said()).toEqual([])
    expect(screen.queryByTestId('analysis-view-only-notes')).toBeNull()
    for (const note of NOTES) expect(block().textContent).not.toContain(note)
  })

  it('CONTRAST: the same current Run on a board that is not a program: its chances as today, and no notes', async () => {
    await board(current as Json, NOTES, false)
    expect(screen.getByTestId(`analysis-view-only-chance-${ADD}`).textContent).toMatch(/^‘Add one specialist’: about 76% chance/)
    expect(said()).toEqual([])
    expect(screen.queryByTestId('analysis-view-only-notes')).toBeNull()
  })
})
