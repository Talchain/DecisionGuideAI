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
 * (CONTROL rows on the same boards: "6 developers", "£58,000", "9%").
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
import bookshop from './fixtures/served-bookshop-worked-out-read-20261027.json'
import paulChat from './fixtures/paul-ai-chat-deadline-read-20261028.json'
import mrr from '../../hydrate/__tests__/fixtures/served-3b6369b0-mrr-current.read.json'
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
    nodes: [], edges: [], currentScenarioId: board.scenario_id, serverGraphIdentity: null, results: { status: 'idle' } as never,
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
  it('hiring tech_leads_added (0, unit "tech_lead") reads "0 tech leads"', async () => {
    await openBoard(hiring)
    await card('tech_leads_added')
    expect(value()).toBe('0 tech leads')
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
  it('hiring current_developers reads "6 developers"', async () => {
    await openBoard(hiring)
    await card('current_developers')
    expect(value()).toBe('6 developers')
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

// Vision spec §2a (the worked-out author) + decision 8 A: a factor worked out from others with no number yet carried
// CEE's sentence as its value ("Worked out from …"), a paragraph on the card (staging, 27 Oct). It reads "= —"; the
// sentence is its hover and its accessible name, and the bottom row keeps the worked-out mark.
describe('a worked-out factor with no figure yet reads "= —", the parts on hover', () => {
  const WORDS = 'Worked out from Monthly book sales without either action and Sales share lost through newsletter annoyance'
  it('bookshop newsletter_sales_loss: "= —", never the sentence on the card', async () => {
    await openBoard(bookshop)
    await card('newsletter_sales_loss')
    expect(value()).toBe('= —')
    const readout = screen.getByTestId('factor-worked-out-newsletter_sales_loss')
    expect(readout).toHaveAttribute('aria-label', `No figure yet. ${WORDS}`)
    expect(screen.getByTestId('factor-recorded-value').textContent).not.toContain('Worked out')
    expect(screen.getByTestId('factor-bottom-marks-newsletter_sales_loss').querySelector('[data-testid="factor-value-source-newsletter_sales_loss"]')).not.toBeNull()
    // CONTROL, same board: a factor with a figure keeps it (newsletter_uplift_percent "10%").
    cleanup()
    await card('newsletter_uplift_percent')
    expect(value()).toContain('10')
    expect(screen.queryByTestId('factor-worked-out-newsletter_uplift_percent')).toBeNull()
  })

  // Codex r1 on #3049: the same node, still worked out, with a figure or with other words, is never the dash.
  it.each([
    // CEE's sentence kept, so only the figure tells them apart: the card reads as before this change, never the dash.
    ['a figure (SYNTHETIC observed_state 37)', (n: Json) => { n.observed_state = { ...(n.observed_state ?? {}), value: 37, raw_value: 37 } }, 'Worked out from'],
    ['other words (SYNTHETIC display_value)', (n: Json) => { n.display_value = 'About 37 books a month' }, 'About 37 books a month'],
  ] as const)('CONTRAST: newsletter_sales_loss, still worked out, with %s keeps them', async (_name, edit, shown) => {
    const graph = structuredClone(bookshop.graph) as Json
    edit(graph.nodes.find((x: Json) => x.id === 'newsletter_sales_loss'))
    await openBoard({ ...bookshop, graph })
    await card('newsletter_sales_loss')
    expect(screen.queryByTestId('factor-worked-out-newsletter_sales_loss')).toBeNull()
    expect(value()).toContain(shown)
  })
})

// Vision spec §2a (goal card): a level target draws a track, today's level against the target on one scale; the
// horizon is a chip. Served read 3b6369b0: MRR £75,000 today (brief), target £85,000 a month.
describe('the goal card draws today against its target', () => {
  it('MRR: a track with today filled and the target marked, named in words', async () => {
    await openBoard(mrr)
    await card('mrr', GoalNode)
    const track = screen.getByTestId('goal-track-mrr')
    expect(track.getAttribute('aria-label')).toMatch(/^Today .*75,000.*, target .*85,000/)
    const fill = track.firstElementChild as HTMLElement
    const marker = screen.getByTestId('goal-track-mrr-target')
    // 75,000 and 85,000 on a scale to 85,000 × 4/3: 66.2% and 75%.
    expect(parseFloat(fill.style.width)).toBeCloseTo(66.18, 1)
    expect(parseFloat(marker.style.left)).toBeCloseTo(75, 1)
  })

  // Codex r1 on #3049: the contrast keeps today's level known, so only the change frame can withhold the track.
  it('CONTRAST: the same MRR goal as a change target ("+£10,000 on today"; SYNTHETIC frame) draws no track', async () => {
    const graph = structuredClone(mrr.graph) as Json
    const goal = graph.nodes.find((x: Json) => x.id === 'mrr')
    goal.goal_threshold_frame = 'change_abs'
    goal.goal_threshold_raw = 10000
    await openBoard({ ...mrr, graph })
    await card('mrr', GoalNode)
    expect(screen.getByTestId('goal-today-level-mrr').textContent).toContain('75,000')
    expect(screen.queryByTestId('goal-track-mrr')).toBeNull()
  })
})

// UI-SURGICAL 3 (Paul, 28 Oct, his AI-chat board as served): a unit word is counted against its figure — "2 months",
// "at most 2 months", "0 months" — never "2 month". One stays singular.
describe('a unit word is counted against its figure', () => {
  it('Paul’s current_engineering_time reads "2 months"; zero_extra_delay reads "0 months"', async () => {
    await openBoard(paulChat)
    await card('current_engineering_time')
    expect(value()).toBe('2 months')
    cleanup()
    await card('zero_extra_delay')
    expect(value()).toBe('0 months')
  })

  it('Paul’s goal target reads "at most 2 months"', async () => {
    await openBoard(paulChat)
    await card('launch_on_time', GoalNode)
    expect(document.body.textContent).toContain('at most 2 months')
    expect(document.body.textContent).not.toContain('at most 2 month ')
  })
})
