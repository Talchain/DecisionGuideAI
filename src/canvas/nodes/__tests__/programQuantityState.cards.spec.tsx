/**
 * ⭐ A QUANTITY CARD SAYS ITS FIGURE, OR SHOWS THE NO-FIGURE INDICATOR, AND KEEPS WHOSE IT IS (W12; acceptance run 2,
 * checks 2 and 1; DL (B), keeping Paul's 24 Oct "visual indicators, not default text").
 *
 * Served on the three program boards of that run:
 *   · capacity "Additional specialist capacity": CEE works it out and holds 0 before an option adds anyone, but a zero was
 *     never a recorded value, so the card had no line at all. On a program graph a zero is a figure: "Today: 0 ticket/week".
 *   · Olumi's figures nobody knows yet (qualitative "Share of update recipients affected if the bug remains", european
 *     "Months until pilot acquisition effect"): the value line read "Source not recorded unknown". It now shows the
 *     no-figure indicator the worked-out cards show, "—", with Olumi's mark saying "Olumi’s: no figure yet" on hover and
 *     in its name. No new visible words.
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

/** A factor's value line, and its mark's accessible words. */
const factorLine = (id: string) => ({
  text: screen.getByTestId('factor-recorded-value').textContent,
  mark: screen.getByTestId(`factor-value-source-${id}`),
})

describe('a zero is a figure on a program graph', () => {
  it('capacity "Additional specialist capacity" (worked out, 0 before an option adds anyone): "Today: 0 ticket/week"', async () => {
    await openBoard(capacity)
    await card('additional_capacity', OutcomeNode)
    expect(outcomeLine().text).toBe('Today: 0 ticket/week')
    expect(screen.getByTestId('node-provenance-mark')).toBeTruthy()
  })

  it('CONTRAST: capacity "Weekly support capacity", worked out to 80, says its figure, as today', async () => {
    await openBoard(capacity)
    await card('total_capacity', OutcomeNode)
    expect(outcomeLine().text).toBe('Today: 80 ticket/week')
  })
})

describe('a worked-out quantity with no figure: the indicator, CEE\'s words in its name (as today)', () => {
  it('european "Customer base": "Today: —", named with CEE\'s worked-out words', async () => {
    await openBoard(european)
    await card('customers', OutcomeNode)
    const { text, name } = outcomeLine()
    expect(text).toBe('Today: —')
    expect(name).toBe('Today: no figure yet. Worked out from Current customers, New customers per month and Customers leaving per month')
  })
})

describe('Olumi\'s figure nobody knows yet: the no-figure indicator, with Olumi\'s mark', () => {
  it.each([
    ['qualitative', 'affected_share_if_unfixed'],
    ['qualitative', 'bug_persists_at_planned_release'],
    ['european', 'pilot_acquisition_start'],
    ['european', 'full_acquisition_ramp_duration'],
  ] as const)('%s %s: "—" with Olumi\'s mark, "Olumi’s: no figure yet"; never "Source not recorded" or "unknown"', async (board, id) => {
    await openBoard(board === 'qualitative' ? qualitative : european)
    await card(id)
    const { text, mark } = factorLine(id)
    expect(text).toContain('—')
    expect(text).not.toMatch(/unknown|Source not recorded/)
    expect(mark.getAttribute('data-value-source')).toBe('olumi')
    expect(mark.textContent + (mark.getAttribute('aria-label') ?? '') + (mark.getAttribute('title') ?? '')).toContain('Olumi’s: no figure yet')
  })

  it('CONTRAST: a figure still to be given (european "Time to reach the customer target") keeps its asked mark and field', async () => {
    await openBoard(european)
    await card('target_deadline')
    expect(factorLine('target_deadline').mark.getAttribute('data-value-source')).toBe('asked')
    expect(screen.getByTestId('node-value-editor-target_deadline')).toBeTruthy()
  })

  it('CONTRAST: a figure from the brief keeps its figure and mark (capacity "Existing weekly support capacity")', async () => {
    await openBoard(capacity)
    await card('existing_capacity')
    expect(factorLine('existing_capacity').text).toBe('From your brief 80 ticket/week')
  })
})
