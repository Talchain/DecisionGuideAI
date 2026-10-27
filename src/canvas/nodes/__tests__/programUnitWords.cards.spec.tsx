/**
 * A UNIT IS SHOWN IN ITS READING WORDS (DL, 23 Oct; batch-3 fit on the served hiring-r1 and marketing-r1 reads).
 *
 * Program graphs carry units as identifiers: the dimensionless "1", and underscored words ("tech_lead",
 * "GBP/tech_lead"). The cards printed them as written: "0.55 1 · Range: -0.2–1 1", "1 1", "0 1", "0 tech_lead",
 * "145,000 GBP/tech_lead", and the goal's empty today slot "— 1". Now:
 *   · the dimensionless "1" prints no unit (card, range, goal today slot);
 *   · an underscore reads as a space ("0 tech lead");
 *   · money per a thing written with an underscore goes through the one money rule ("£145,000 / tech lead",
 *     "Range: £135,000–£155,000 / tech lead").
 * Display only: the numbers, signs and the unit the write sends are unchanged. A unit that is neither keeps its text
 * (CONTROL rows on the same boards: "6 developer", "£58,000", "9%").
 *
 * Driven through the real path (as `FactorNode.askedFigureEditsInCard.spec.tsx`): the real `hydrateCanvasFromServer`
 * read and the real saved-graph read (stubbed global `fetch` only), the real cards. Fixtures: CEE's served reads
 * (S3 batch 3, accept3 spike), trimmed to nodes, edges, `model_program` and the canonical quantities.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, cleanup, act } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import type { Node } from '@xyflow/react'
import hiring from '../../runView/__tests__/fixtures/accept3-hiring-r1-read.json'
import marketing from '../../runView/__tests__/fixtures/accept3-marketing-r1-read.json'
import { useCanvasStore } from '../../store'
import { FactorNode } from '../FactorNode'
import { GoalNode } from '../GoalNode'
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
// The saved-graph read is cached per scenario and hash, so each board reads its own hash.
let n = 0
async function openBoard(board: Json) {
  n += 1
  read = { ...board, graph_hash: `${board.graph_hash}${n}` }
  useCanvasStore.setState({
    nodes: [], edges: [], currentScenarioId: board.scenario_id, results: { status: 'idle' } as never,
    lastServerGraphHash: null, lastAuthoritativeGraph: null, analysisFreshness: null, analysisStateV1: null,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
  } as never)
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => (
    /\/scenarios\/[^/]+\/graph/.test(String(input))
      ? new Response(JSON.stringify(read), { status: 200, headers: { 'content-type': 'application/json' } })
      : new Response(JSON.stringify({ assistant_text: '', cards: [], notes: [], run: null, model: null }), { status: 200, headers: { 'content-type': 'application/json' } })
  )))
  await act(async () => { await hydrateCanvasFromServer(board.scenario_id) })
}

async function card(id: string, Card: typeof FactorNode | typeof GoalNode = FactorNode) {
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
/** The card's value line as read: the figure and unit. (Paul, 27 Oct 2026: its mark is on the card's bottom row now.) */
const value = () => screen.getByTestId('factor-recorded-value').textContent
const range = (id: string) => screen.getByTestId(`factor-stored-range-${id}`).textContent
/** The value's mark, read from THIS card's bottom row by identity (Paul, 27 Oct: the mark left the value line). */
const markWords = (id: string) => {
  const band = screen.getByTestId(`factor-bottom-marks-${id}`)
  const mark = band.querySelector(`[data-testid="factor-value-source-${id}"], [data-testid="estimate-marker"]`)
  expect(screen.getByTestId('factor-recorded-value').contains(mark)).toBe(false)
  return mark?.textContent?.trim() ?? null
}

beforeEach(() => {
  window.history.replaceState({}, '', '/#/canvas?ai=core-route')
  Element.prototype.scrollIntoView = vi.fn()
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.history.replaceState({}, '', '/') })

describe('the dimensionless unit "1" prints no unit', () => {
  it('hiring new_developer_relative_output (0.55, range -0.2–1, unit "1"): "0.55" and "Range: -0.2–1"', async () => {
    await openBoard(hiring)
    await card('new_developer_relative_output')
    expect(value()).toBe('0.55')
    expect(markWords('new_developer_relative_output')).toBe('est.')
    expect(range('new_developer_relative_output')).toBe('Range: -0.2–1')
  })

  it('hiring baseline_productivity (1, unit "1", fixed by the model) reads "1", not "1 1"', async () => {
    await openBoard(hiring)
    await card('baseline_productivity')
    expect(value()).toBe('1')
    expect(markWords('baseline_productivity')).toBe('Fixed by how the model is built')
  })

  it('marketing ai_selected (0, unit "1", a switch) reads "0", not "0 1"', async () => {
    await openBoard(marketing)
    await card('ai_selected')
    expect(value()).toBe('0')
    expect(markWords('ai_selected')).toBe('Fixed by how the model is built')
  })

  it('hiring goal increase_productivity (goal_threshold_unit "1"): the empty today slot has no "1" beside it', async () => {
    await openBoard(hiring)
    await card('increase_productivity', GoalNode)
    const slot = screen.getByTestId('goal-today-level-empty-increase_productivity')
    expect(slot.textContent).toBe('—')
  })
})

describe('an underscored unit reads in words, and money per a thing takes the money rule', () => {
  it('hiring tech_leads_added (0, unit "tech_lead") reads "0 tech lead"', async () => {
    await openBoard(hiring)
    await card('tech_leads_added')
    expect(value()).toBe('0 tech lead')
    expect(markWords('tech_leads_added')).toBe('Fixed by how the model is built')
  })

  it('hiring tech_lead_cost_per_hire (145,000 GBP/tech_lead, range 135,000–155,000): "£145,000 / tech lead" and its range', async () => {
    await openBoard(hiring)
    await card('tech_lead_cost_per_hire')
    expect(value()).toBe('£145,000 / tech lead')
    expect(markWords('tech_lead_cost_per_hire')).toBe('Set by you')
    expect(range('tech_lead_cost_per_hire')).toBe('Range: £135,000–£155,000 / tech lead')
  })
})

describe('CONTROL: a unit that is neither keeps its text, on the same boards', () => {
  it('hiring current_developers reads "6 developer"', async () => {
    await openBoard(hiring)
    await card('current_developers')
    expect(value()).toBe('6 developer')
    expect(markWords('current_developers')).toBe('From your brief')
  })

  it('marketing manager_cost reads "£58,000" and baseline_conversion_rate reads "9%"', async () => {
    await openBoard(marketing)
    await card('manager_cost')
    expect(value()).toBe('£58,000')
    expect(markWords('manager_cost')).toBe('Set by you')
    cleanup()
    await card('baseline_conversion_rate')
    expect(value()).toBe('9%')
    expect(markWords('baseline_conversion_rate')).toBe('Set by you')
  })
})
