/**
 * ⭐ ON A PROGRAM BOARD THE REVIEW QUEUE HOLDS THE MODEL'S OWN REASONING RECORDS (Paul, 27 Oct: "make the review queue
 * include the model's assumptions, claims, dissent and conditions").
 *
 * Served on UI 91a5dc86: the hiring board said "Nothing to review" while its saved model held seven assumptions, two claims
 * and a preference; Paul's AI chat launch board (bb169869) said "1 to review" while it held the team's disagreement, two
 * conditions, four assumptions and three claims, none accepted. The queue read figure checks and legacy findings only.
 *
 * Real path: the real `hydrateCanvasFromServer` and saved-graph read (only `fetch` stubbed), then the real
 * `ModelReviewTool`, opened and read through its own item list. Fixture: Paul's saved record (see its `_capture`).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, act, screen, fireEvent } from '@testing-library/react'
import paul from './fixtures/paul-ai-launch-saved-read-20261027.json'
import { useCanvasStore } from '../../../../canvas/store'
import { hydrateCanvasFromServer } from '../../../../canvas/hydrate/serverGraphHydration'
import { ModelReviewTool } from '../sections/ModelReviewTool'

vi.mock('../../../../v5/streamedTurnTransport', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../v5/streamedTurnTransport')>()),
  openV5TurnStream: async () => { throw new TypeError('Failed to fetch') },
}))
vi.mock('../../../../v5/eligibility', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../v5/eligibility')>()),
  isV5Eligible: () => ({ eligible: true }),
  isV5CanonicalRunPath: () => false,
}))
vi.mock('../../../../flags', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../flags')>()),
  isOrchestratorV2Enabled: () => true,
  isOrchestratorStreamingEnabled: () => false,
}))
vi.mock('../../../../lib/supabase', () => ({ getUserId: async () => null, getSessionIdentity: async () => ({ userId: null, accessToken: null }) }))
vi.mock('../../../../services/scenarioService', () => ({ loadScenario: async () => null, storeAnalysis: async () => undefined }))
vi.mock('../../../../lib/posthog', () => ({ trackEvent: () => undefined }))

type Json = Record<string, any>
let read: Json = {}
let n = 0
/** Opens the saved board, opens its review, and returns the count words and each item's "<n>. <name>" line. */
async function reviewOf(board: Json): Promise<{ count: string; items: string[] }> {
  n += 1
  read = { ...board, graph_hash: `${board.graph_hash}${n}` }
  useCanvasStore.setState({
    nodes: [], edges: [], currentScenarioId: board.scenario_id, results: { status: 'idle' } as never,
    lastServerGraphHash: null, serverGraphIdentity: null, lastAuthoritativeGraph: null, analysisFreshness: null, analysisStateV1: null,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
  } as never)
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => (
    /\/scenarios\/[^/]+\/graph/.test(String(input))
      ? new Response(JSON.stringify(read), { status: 200, headers: { 'content-type': 'application/json' } })
      : new Response(JSON.stringify({ assistant_text: '', cards: [], notes: [], run: null, model: null }), { status: 200, headers: { 'content-type': 'application/json' } })
  )))
  await act(async () => { await hydrateCanvasFromServer(board.scenario_id) })
  render(<ModelReviewTool interventions={[]} onAsk={() => undefined} />)
  await act(async () => { await new Promise((r) => setTimeout(r, 30)) })
  const count = (screen.queryByTestId('analysis-new-review-count') ?? screen.getByTestId('analysis-new-review-empty')).textContent ?? ''
  const toggle = screen.queryByTestId('analysis-new-review-toggle')
  if (toggle) fireEvent.click(toggle)
  const items = [...(screen.queryByTestId('analysis-new-review-select')?.querySelectorAll('option') ?? [])].map((o) => o.textContent ?? '')
  return { count, items }
}
/** The saved record with its canonical reasoning lists replaced. */
const withRecords = (board: Json, lists: Json): Json => ({
  ...board,
  graph: { ...board.graph, living_model: { ...board.graph.living_model, canonical: { ...board.graph.living_model.canonical, ...lists } } },
})

beforeEach(() => {
  window.history.replaceState({}, '', '/#/canvas?ai=core-route')
  Element.prototype.scrollIntoView = vi.fn()
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.history.replaceState({}, '', '/') })

describe('the review queue holds the model\'s disagreement, assumptions, conditions and claims', () => {
  it('⭐ Paul\'s AI chat launch board: each record is an item, in that order, in its own words', async () => {
    const { count, items } = await reviewOf(paul)
    const c = (paul as Json).graph.living_model.canonical
    const records = [...c.dissent.map((d: Json) => d.position), ...c.assumptions.map((a: Json) => a.text),
      ...c.conditions.map((x: Json) => x.text), ...c.claims.map((x: Json) => x.text)]
    expect(records.length).toBe(10)
    const names = items.map((line) => line.replace(/^\d+\. /, ''))
    expect(names.slice(-records.length)).toEqual(records)
    expect(names[names.length - records.length]).toBe("The team doesn't think they can do this, mainly because they lack experience developing AI.")
    expect(count).toBe(`${items.length} to review`)
  })

  it('the item says what it is, whose it is and that it is not yet accepted', async () => {
    await reviewOf(withRecords(paul, { assumptions: [], conditions: [], claims: [] }))
    const select = screen.getByTestId('analysis-new-review-select') as HTMLSelectElement
    const last = select.querySelectorAll('option').length - 1
    fireEvent.change(select, { target: { value: String(last) } })
    expect(screen.getByTestId('analysis-new-review-kind').textContent).toBe('Disagreement')
    expect(screen.getByTestId('analysis-new-review-reason').textContent).toBe('The team · not yet accepted')
  })

  it('CONTRAST: a board whose model keeps no reasoning records adds none', async () => {
    const { count, items } = await reviewOf(withRecords(paul, { dissent: [], assumptions: [], conditions: [], claims: [] }))
    expect(items.some((line) => /doesn't think they can do this/.test(line))).toBe(false)
    expect(count).toBe(items.length === 0 ? 'Nothing to review' : `${items.length} to review`)
  })
})
