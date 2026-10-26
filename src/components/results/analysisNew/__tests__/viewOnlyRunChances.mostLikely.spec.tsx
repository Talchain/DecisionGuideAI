/**
 * W6 (Paul 6 and 14 Oct; CEE #3792): CEE's model program now serves `canonical_analysis_view.leader.words`, its own
 * sentence on which option is most likely to achieve the goal in this model, or that the options are too close to call.
 * The parser kept the leader's ids and dropped the words, and no program-board surface said them. Now the board's
 * pre-run slot says them verbatim, once, under the chances, for a current Run only. The UI composes and decides none of it.
 *
 * Fixtures: CEE's served reads of the capacity program board (pass 35463f30, current) and of the same board opened after a
 * deploy (s2, stale). Those reads predate W6, so the leader below is spelled inline in CEE #3792's own sentence shapes
 * (`present.ts`: "is the option most likely to achieve the goal: … against … the next most likely, …" and "… are too close
 * to call: the simulation cannot tell apart their chances of …"), with the fixture's own displays and chance words.
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
import { openStrategicChallenge } from './analysisNewFixtures'
import current from '../../../../canvas/runView/__tests__/fixtures/pass-capacity-35463f30-read.json'
import stale from '../../../../canvas/runView/__tests__/fixtures/s2-capacity-stale-after-deploy-read.json'

type Json = Record<string, any>
const KEEP = 'keep_current_staffing'
const ADD = 'add_one_specialist'
const OF = '‘Weekly support capacity’ being at least 100 ticket / week with no deadline recorded yet'
const BASIS = 'if ‘Weekly capacity per additional specialist’ follows Olumi’s provisional conversion of your range, 10 ticket / week / specialist to 30 ticket / week / specialist, into a bell-shaped spread, held within those bounds'
const MOST_LIKELY = `In this model, ‘Add one specialist’ is the option most likely to achieve the goal: about 76% chance of ${OF}, against 0% for ‘Keep current staffing’, the next most likely, ${BASIS}.`
const TOO_CLOSE = `In this model, ‘Keep current staffing’ (0%) and ‘Add one specialist’ (about 76%) are too close to call: the simulation cannot tell apart their chances of ${OF}, ${BASIS}.`
const STALE_LINE = 'Run the analysis again to see the chance.'
const PERMITTED = (words: unknown): Json => ({ licence: 'permitted', option_id: null, goal_chance_leader: ADD, similar_option_ids: [], words })
const WITHHELD = (words: unknown): Json => ({ licence: 'withheld', option_id: null, goal_chance_leader: null, similar_option_ids: [KEEP, ADD], words })

let read: Json = {}
let n = 0

/** CEE's served view with this `leader` (or none), through the real parser. */
function viewWith(source: Json, leader: Json | undefined) {
  const served: Json = { ...source.canonical_analysis_view }
  delete served.leader
  return parseCanonicalAnalysisView(leader === undefined ? served : { ...served, leader_licence: leader.licence, leader })
}

/** The program board on screen (pre-run), its saved read served, and the read's view adopted with this leader. */
async function board(source: Json, leader: Json | undefined) {
  n += 1
  read = { ...source, graph_hash: `${String(source.graph_hash).slice(0, 12)}${String(n).padStart(4, '0')}` }
  useCanvasStore.setState({
    currentScenarioId: source.scenario_id, lastServerGraphHash: read.graph_hash,
    nodes: source.graph.nodes.map((x: Json, i: number) => ({ id: x.id, type: x.kind, position: { x: 0, y: i * 100 }, data: { label: x.label } })),
    edges: [], goalThreshold: null, results: { ...useCanvasStore.getState().results, report: null, status: 'idle' },
  } as never)
  const view = viewWith(source, leader)
  expect(view).not.toBeNull()
  useCanonicalAnalysisViewStore.getState().adopt(source.scenario_id, view)
  render(<AnalysisNewTabBody resultsSectionData={openStrategicChallenge()} isPreRun isRunning={false} isStale={false}
    blockedListing={null} canRunAnalysis onReanalyse={() => {}} />)
  await act(async () => { await new Promise((r) => setTimeout(r, 30)) })
}
const block = () => screen.getByTestId('analysis-view-only-chances')
const said = () => screen.queryAllByTestId('analysis-view-only-most-likely').map(e => e.textContent)
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

describe('a program board says CEE’s words on which option is most likely to achieve the goal', () => {
  it('a current Run: CEE’s sentence, exactly and once, under both options’ chance lines', async () => {
    await board(current as Json, PERMITTED(MOST_LIKELY))
    expect(said()).toEqual([MOST_LIKELY])
    expect(occurrences(block().textContent!, MOST_LIKELY)).toBe(1)
    // Under the chances: each option's own chance line still stands, and the sentence follows the last of them.
    const keep = screen.getByTestId(`analysis-view-only-chance-${KEEP}`), add = screen.getByTestId(`analysis-view-only-chance-${ADD}`)
    expect(keep.textContent).toMatch(/^‘Keep current staffing’: 0% chance/)
    expect(add.textContent).toMatch(/^‘Add one specialist’: about 76% chance/)
    const words = screen.getByTestId('analysis-view-only-most-likely')
    expect(add.compareDocumentPosition(words) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(keep).not.toContainElement(words)
    expect(add).not.toContainElement(words)
  })

  it('too close to call (licence withheld): CEE’s sentence, exactly; the UI names no option of its own', async () => {
    await board(current as Json, WITHHELD(TOO_CLOSE))
    expect(said()).toEqual([TOO_CLOSE])
    expect(block().textContent).not.toContain(MOST_LIKELY)
  })

  it('no leader served (an older CEE, or one option): no sentence; the chance lines stand (contrast: the same board with one)', async () => {
    await board(current as Json, undefined)
    expect(said()).toEqual([])
    expect(screen.getByTestId(`analysis-view-only-chance-${ADD}`).textContent).toMatch(/^‘Add one specialist’: about 76% chance/)
    expect(block().textContent).not.toContain('most likely')
  })

  it('a stale Run: CEE’s not-current line alone, never the sentence (the chance gate stands)', async () => {
    await board(stale as Json, PERMITTED(MOST_LIKELY))
    expect(screen.getByTestId(`analysis-view-only-chance-${KEEP}+${ADD}`).textContent).toBe(STALE_LINE)
    expect(said()).toEqual([])
    expect(block().textContent).not.toContain(MOST_LIKELY)
  })

  it.each([
    ['two lines', MOST_LIKELY.replace(', against', ',\nagainst')],
    ['blank', '  '],
    ['not a string', 76],
  ])('a malformed sentence (%s) is dropped on its own: the view, the leader’s ids and the chances still stand', async (_name, words) => {
    const view = viewWith(current as Json, PERMITTED(words))
    expect(view).not.toBeNull()
    expect(view!.leader).toEqual({ licence: 'permitted', option_id: null, goal_chance_leader: ADD, similar_option_ids: [] })
    expect('words' in view!.leader!).toBe(false)
    // Contrast: the same leader with CEE's well-formed sentence keeps it.
    expect(viewWith(current as Json, PERMITTED(MOST_LIKELY))!.leader?.words).toBe(MOST_LIKELY)
    await board(current as Json, PERMITTED(words))
    expect(said()).toEqual([])
    expect(screen.getByTestId(`analysis-view-only-chance-${KEEP}`).textContent).toMatch(/^‘Keep current staffing’: 0% chance/)
    expect(screen.getByTestId(`analysis-view-only-chance-${ADD}`).textContent).toMatch(/^‘Add one specialist’: about 76% chance/)
  })
})
