/**
 * W8 ACCEPTANCE (27 Oct, run 20261027T230057Z on CEE 1c16eb41 / UI 66b2aa56): the board's own defects on a program
 * scenario, one row each, on the european board as it was served.
 *
 *   · c7.1 said once: the one-country pilot card said "Olumi's estimate — estimate not yet confirmed" twice in a row, and
 *     the expansion card "From your brief" twice. Each of the option's two rows drew its own mark on the bottom row.
 *   · c7.6 consistent: after "Yes, that's what I meant" ("Your confirmed reading is saved"), CEE records the pilot as
 *     approved (`living_model.canonical.options[].approval`), yet the card still said "not yet confirmed".
 *   · c2 the canvas: "Additional monthly acquisitions before competitive losses" and "Change in monthly churn after
 *     expansion" (CEE: Olumi's, `status: 'unknown'`, no figure) showed neither a figure nor that none is known.
 *   · c5 the Run: each option's reason no chance is shown (CEE's `cell.why`) was not on the Analysis tab.
 *   · c7.6 consistent: the goal "Avoid operating losses" (CEE: `author: 'olumi'`) read "Source not recorded".
 *
 * Real path (as `programQuantityState.cards.spec.tsx`): the real `hydrateCanvasFromServer` read and saved-graph read (only
 * `fetch` stubbed), then the real cards and the Analysis block the dock mounts. Fixture: that run's served final-reload
 * read (`_source`), trimmed to the read's keys plus `canonical_analysis_view`. Expected words are spelled inline.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, cleanup, act } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import type { Node } from '@xyflow/react'
import european from './fixtures/served-w8-european-read-20261027.json'
import { useCanvasStore } from '../../store'
import { FactorNode } from '../FactorNode'
import { OptionNode } from '../OptionNode'
import { GoalNode } from '../GoalNode'
import { ConversationProvider } from '../../conversation/ConversationContext'
import { hydrateCanvasFromServer } from '../../hydrate/serverGraphHydration'
import { useCanonicalAnalysisViewStore } from '../../stores/canonicalAnalysisViewStore'
import { useViewOnlyRunChances, ViewOnlyRunChancesBlock } from '../../../components/results/analysisNew/ViewOnlyRunChances'

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

/** The served board as the draft served it, before the person confirmed the reading: every option `proposed`. */
const beforeConfirming = (): Json => {
  const board = structuredClone(european) as Json
  for (const option of board.graph.living_model.canonical.options) option.approval = 'proposed'
  return board
}

const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 30)) })

async function card(id: string, Card: typeof FactorNode | typeof OptionNode | typeof GoalNode) {
  const node = useCanvasStore.getState().nodes.find(x => x.id === id) as Node
  expect(node, `node ${id} hydrated`).toBeTruthy()
  const view = render(
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
  await settle()
  return view.container
}

/** The Analysis block exactly as the dock mounts it (OutputsDock: `useViewOnlyRunChances` → `ViewOnlyRunChancesBlock`). */
function AnalysisBlock() {
  const chances = useViewOnlyRunChances()
  return chances === null ? null : <ViewOnlyRunChancesBlock chances={chances} />
}

const count = (text: string, words: string) => text.split(words).length - 1
const UNCONFIRMED = 'Olumi\'s estimate — estimate not yet confirmed'
const ACCEPTED = 'Olumi’s estimate · you accepted it'

beforeEach(() => {
  window.history.replaceState({}, '', '/#/canvas?ai=core-route')
  Element.prototype.scrollIntoView = vi.fn()
})
afterEach(() => {
  cleanup(); vi.unstubAllGlobals(); window.history.replaceState({}, '', '/')
  useCanonicalAnalysisViewStore.setState({ scenarioId: null, view: null })
})

describe('c7.1 said once: an option card says each source of its figures once', () => {
  it('⭐ "European market expansion" (two rows from the brief): "From your brief" once, naming both rows', async () => {
    await openBoard(european)
    const el = await card('european_expansion', OptionNode)
    expect(count(el.textContent ?? '', 'From your brief')).toBe(1)
    const marks = el.querySelectorAll('[data-value-source="brief"]')
    expect(marks).toHaveLength(1)
    expect(marks[0].getAttribute('aria-label')).toBe('Expansion investment switched on and European sales launched targets: From your brief')
    // Both rows still show their figure.
    expect(screen.getByTestId('option-change-row-value-european_expansion-investment_active').textContent).toBe('0 → 1')
    expect(screen.getByTestId('option-change-row-value-european_expansion-launch_active').textContent).toBe('0 → 1')
  })

  it('⭐ "One-country pilot" before confirming (two rows of Olumi\'s): its mark once, never twice', async () => {
    await openBoard(beforeConfirming())
    const el = await card('one_country_pilot', OptionNode)
    expect(count(el.textContent ?? '', UNCONFIRMED)).toBe(1)
    expect(el.querySelectorAll('[data-value-source="olumi"]')).toHaveLength(1)
  })
})

describe('c7.6: the pilot\'s figures follow the saved confirmation', () => {
  it('⭐ after "Your confirmed reading is saved" (CEE: approved), the card says accepted, never "not yet confirmed"', async () => {
    await openBoard(european)
    const el = await card('one_country_pilot', OptionNode)
    const text = el.textContent ?? ''
    expect(text).toContain(ACCEPTED)
    expect(text).not.toContain('not yet confirmed')
    // Still Olumi's: the person accepted Olumi's figures, they did not become the person's own.
    expect(el.querySelector('[data-value-source="olumi"]')).not.toBeNull()
    expect(el.querySelector('[data-value-source="you"]')).toBeNull()
  })

  it('CONTRAST: before confirming (CEE: proposed), the same card still says "not yet confirmed"', async () => {
    await openBoard(beforeConfirming())
    const el = await card('one_country_pilot', OptionNode)
    expect(el.textContent).toContain(UNCONFIRMED)
    expect(el.textContent).not.toContain(ACCEPTED)
  })
})

describe('c2: a quantity nobody knows yet says so', () => {
  it.each([
    'gross_acquisition_gain',
    'expansion_churn_effect',
  ])('⭐ %s (CEE: Olumi\'s, unknown, no figure): "—" with "not known yet, no figure set"; never "unknown" or "Source not recorded"', async (id) => {
    await openBoard(european)
    const el = await card(id, FactorNode)
    expect(screen.getByTestId('factor-recorded-value').textContent).toContain('—')
    expect(el.textContent).toContain('Olumi’s: not known yet, no figure set')
    expect(el.textContent).not.toMatch(/\bunknown\b|Source not recorded/)
  })

  it('CONTRAST: an asked figure ("Months to reach 800 customers") keeps its hourglass, its words and its question', async () => {
    await openBoard(european)
    const el = await card('decision_horizon', FactorNode)
    const mark = screen.getByTestId('factor-value-source-decision_horizon')
    expect(mark.getAttribute('data-value-source')).toBe('asked')
    expect(el.textContent).toContain('Waiting for your answer')
    expect(el.textContent).not.toContain('not known yet')
  })
})

describe('c5: each option\'s reason no chance is shown is on the Analysis tab, beside the option', () => {
  it('⭐ every option withheld on the program board: the headline once, then each option\'s own reason in CEE\'s words', async () => {
    await openBoard(european)
    render(<AnalysisBlock />)
    await settle()
    expect(screen.getByTestId('analysis-view-only-waits-headline')).toBeInTheDocument()
    for (const { option_id: id, cell } of european.canonical_analysis_view.options as Json[]) {
      const label = (european.graph.nodes as Json[]).find(x => x.id === id)?.label
      expect(screen.getByTestId(`analysis-view-only-reason-${id}`).textContent).toBe(`‘${label}’: ${cell.why}`)
    }
    const block = screen.getByTestId('analysis-view-only-chances').textContent ?? ''
    // Never the withheld face, and the headline's list is still said once.
    expect(block).not.toContain('Not shown yet: needs your answer')
    expect(count(block, 'waits on 16 things')).toBe(1)
  })
})

describe('c7.6: a goal Olumi read from the brief says so', () => {
  it('⭐ "Avoid operating losses" (CEE: author olumi): "Olumi’s reading", never "Source not recorded"', async () => {
    await openBoard(european)
    const el = await card('avoid_operating_losses', GoalNode)
    expect(screen.getByTestId('goal-target-source-avoid_operating_losses').getAttribute('data-value-source')).toBe('olumi')
    expect(el.textContent).toContain('Olumi’s reading')
    expect(el.textContent).not.toContain('Source not recorded')
  })

  it('CONTRAST: "Reach 800 customers" (stamped from the brief) keeps "From your brief"', async () => {
    await openBoard(european)
    const el = await card('reach_customer_target', GoalNode)
    expect(screen.getByTestId('goal-target-source-reach_customer_target').getAttribute('data-value-source')).toBe('brief')
    expect(el.textContent).not.toContain('Olumi’s reading')
    expect(el.textContent).not.toContain('Source not recorded')
  })
})
