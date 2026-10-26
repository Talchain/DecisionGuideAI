/**
 * ⭐ A QUANTITY CARD WITH NO FIGURE STILL SAYS WHAT IT IS, AND WHOSE IT IS (W12; acceptance run 2, checks 2 and 1).
 *
 * Served on the three program boards of that run, some quantity cards with no figure said nothing about their state:
 *   · capacity "Additional specialist capacity": CEE works it out (`value_basis: worked_out`) and sends its starting level,
 *     0, beside its words, so the card had no line at all;
 *   · Olumi's figures nobody knows yet (qualitative "Share of update recipients affected if the bug remains", european
 *     "Pilot acquisition ramp-up duration"): CEE_STATE_NOTE
 * Each now shows one state line from what CEE sends, keeping its author's mark.
 *
 * Real path (as `programUnitWords.cards.spec.tsx`): the real `hydrateCanvasFromServer` read and saved-graph read (only
 * `fetch` stubbed), then the real cards. Fixtures: that run's served reads (`_source` names each), trimmed to the read's keys.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, cleanup, act } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import type { Node } from '@xyflow/react'
import capacity from './fixtures/served-acceptance-capacity-read-20261026.json'
import european from './fixtures/served-acceptance-european-read-20261026.json'
import qualitative from './fixtures/served-acceptance-qualitative-read-20261026.json'
import { useCanvasStore } from '../../store'
import { FactorNode } from '../FactorNode'
import { OutcomeNode } from '../OutcomeNode'
import { ConversationProvider } from '../../conversation/ConversationContext'
import { hydrateCanvasFromServer } from '../../hydrate/serverGraphHydration'

vi.mock('../../../v5/streamedTurnTransport', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../v5/streamedTurnTransport')>()),
  openV5TurnStream: async () => { throw new TypeError('Failed to fetch') },
}))
vi.mock('../../../v5/eligibility', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../v5/eligibility')>()),
  isV5Eligible: () => ({ eligible: true }),
  isV5CanonicalRunPath: () => false,
}))
vi.mock('../../../flags', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../flags')>()),
  isOrchestratorV2Enabled: () => true,
  isOrchestratorStreamingEnabled: () => false,
}))
vi.mock('../../../lib/supabase', () => ({ getUserId: async () => null, getSessionIdentity: async () => ({ userId: null, accessToken: null }) }))
vi.mock('../../../services/scenarioService', () => ({ loadScenario: async () => null, storeAnalysis: async () => undefined }))
vi.mock('../../../lib/posthog', () => ({ trackEvent: () => undefined }))
vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual<typeof import('@xyflow/react')>('@xyflow/react')
  return { ...actual, Handle: () => null }
})
vi.mock('../../hooks/useScienceIcons', () => ({ useScienceIcons: vi.fn(() => []) }))

type Json = Record<string, any>
let read: Json = {}
// The saved-graph read is cached per scenario and hash, so each opening reads its own hash.
let n = 0
async function openBoard(board: Json) {
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
}

async function card(id: string, Card: typeof FactorNode | typeof OutcomeNode = FactorNode) {
  const node = useCanvasStore.getState().nodes.find(x => x.id === id) as Node
  expect(node, `node ${id} hydrated`).toBeTruthy()
  render(
    <ConversationProvider>
      <ReactFlowProvider>
        <Card
          id={id} type={node.type as string} data={node.data as never} selected={false} isConnectable
          positionAbsoluteX={0} positionAbsoluteY={0} dragging={false} zIndex={0} deletable selectable draggable
        />
      </ReactFlowProvider>
    </ConversationProvider>,
  )
  // The saved-graph read has answered before anything asserts.
  await act(async () => { await new Promise((r) => setTimeout(r, 30)) })
}
/** The outcome's state line: its visible text, and its accessible name (where the words sit, Paul 24 Oct). */
const outcomeLine = () => {
  const line = screen.getByTestId('outcome-recorded-value')
  const named = line.querySelector('[aria-label]')
  return { text: line.textContent, name: named?.getAttribute('aria-label') ?? '' }
}

beforeEach(() => {
  window.history.replaceState({}, '', '/#/canvas?ai=core-route')
  Element.prototype.scrollIntoView = vi.fn()
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.history.replaceState({}, '', '/') })

describe('a worked-out quantity with no figure yet', () => {
  it('capacity "Additional specialist capacity" (served 0 beside its words): the worked-out line, CEE\'s words in its name', async () => {
    await openBoard(capacity)
    await card('additional_capacity', OutcomeNode)
    const { text, name } = outcomeLine()
    expect(text).toBe('Today: —')
    expect(name).toBe('Today: no figure yet. Worked out from Additional specialists and Weekly capacity per additional specialist')
    expect(screen.getByTestId('node-provenance-mark')).toBeTruthy()
  })

  it('CONTRAST: capacity "Weekly support capacity", worked out with a figure, says its figure, as today', async () => {
    await openBoard(capacity)
    await card('total_capacity', OutcomeNode)
    expect(outcomeLine().text).toBe('Today: 80 ticket/week')
  })
})
