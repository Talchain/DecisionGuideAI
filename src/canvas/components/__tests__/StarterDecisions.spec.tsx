/**
 * StarterDecisions — first-run starter strip.
 *
 * The pins that matter here are ALLOW-LIST pins. The response fixture below is
 * deliberately the REAL live shape: 15 templates, dev fixtures FIRST (they sort
 * first live), so "dev fixtures never reach the first screen" is asserted
 * against a response that actually contains them — not against a response we
 * quietly cleaned up first.
 *
 * Mocking pattern: the loadTemplateBlueprint module is mocked via
 * importOriginal-SPREAD (the repo rule — a hand-listed factory silently drops
 * every export added later), so the REAL fetchTemplateList and the REAL
 * TEMPLATE_LOAD_FAILED_MESSAGE stay live while only the loader + confirm gate
 * are stubbed. That keeps the array-vs-{items} shape guard under test and
 * makes the failure-copy pins read the constant the product actually shows.
 */

import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- mocks -----------------------------------------------------------------

const templatesMock = vi.fn()
vi.mock('../../../adapters/plot', () => ({
  plot: {
    templates: () => templatesMock(),
  },
}))

const loadTemplateBlueprintMock = vi.fn()
const confirmReplaceCanvasMock = vi.fn(() => true)
vi.mock('../../blueprints/loadTemplateBlueprint', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../blueprints/loadTemplateBlueprint')>()
  return {
    ...actual,
    loadTemplateBlueprint: (id: string) => loadTemplateBlueprintMock(id),
    confirmReplaceCanvas: () => confirmReplaceCanvasMock(),
  }
})

const showToastMock = vi.fn()
vi.mock('../../ToastContext', () => ({
  useShowToastSafe: () => showToastMock,
}))

import { StarterDecisions } from '../StarterDecisions'
import { useCanvasStore } from '../../store'
import {
  TEMPLATE_LOAD_FAILED_MESSAGE,
  __resetTemplateListCacheForTests,
} from '../../blueprints/loadTemplateBlueprint'

// --- fixtures --------------------------------------------------------------

/** The producer's verbatim label/summary, post-adapter (label→name,
 *  summary→description in httpV1Adapter.templates). Dev fixtures sort first,
 *  exactly as they do live. */
function liveLikeResponse() {
  return {
    schema: 'template-list.v1',
    items: [
      { id: 'edge', name: 'Edge Case', description: 'Near-zero baseline', version: '1.0' },
      { id: 'medium', name: 'Medium Demo', description: 'Medium demo graph', version: '1.0' },
      { id: 'small', name: 'Small Demo', description: 'Small demo graph', version: '1.0' },
      { id: 'architecture_choice', name: 'Architecture Decision', description: 'Monolith vs modular vs microservices', version: '1.0' },
      { id: 'decommission_vs_maintain_legacy', name: 'Legacy System', description: 'Decommission vs maintain', version: '1.0' },
      { id: 'experiment_vs_decide_now', name: 'Experiment First', description: 'Test vs commit', version: '1.0' },
      { id: 'feature_rollout_phased_learning', name: 'Feature Rollout', description: 'Phased learning', version: '1.0' },
      { id: 'funding_strategy_runway', name: 'Funding Strategy', description: 'Runway vs dilution', version: '1.0' },
      { id: 'hire_now_vs_delay', name: 'Hire Now', description: 'Hire now vs delay', version: '1.0' },
      { id: 'hiring_strategy_tech_lead', name: 'Tech Lead Hiring', description: 'Delivery confidence vs knowledge retention vs burn', version: '1.0' },
      { id: 'market_expansion_choice', name: 'Market Expansion', description: 'Which market to enter next', version: '1.0' },
      { id: 'multi_stage_launch', name: 'Multi Stage Launch', description: 'Staged launch', version: '1.0' },
      { id: 'portfolio_prioritisation', name: 'Portfolio Prioritisation', description: 'Where to spend', version: '1.0' },
      { id: 'supplier_selection_resilience', name: 'Supplier Selection', description: 'Cost vs resilience vs lead time', version: '1.0' },
      { id: 'ux_ab_test', name: 'UX A/B Test', description: 'Variant choice', version: '1.0' },
    ],
  }
}

/**
 * The bus arrives as a PROP from the mount that also subscribes to it —
 * that is the fix for the silent dead click on bus-less mounts, and the spec
 * exercises the component exactly the way FirstUseComposer now provides it.
 */
function makeBus() {
  const emit = vi.fn((_bp: unknown) => ({}))
  return { emit, subscribe: vi.fn(() => () => {}) }
}
let bus: ReturnType<typeof makeBus>

function renderStrip() {
  return render(<StarterDecisions bus={bus} />)
}

beforeEach(() => {
  vi.clearAllMocks()
  __resetTemplateListCacheForTests()
  bus = makeBus()
  confirmReplaceCanvasMock.mockReturnValue(true)
  templatesMock.mockResolvedValue(liveLikeResponse())
  useCanvasStore.setState({ nodes: [], edges: [] })
})

// --- specs -----------------------------------------------------------------

describe('StarterDecisions', () => {
  it('renders the 4 featured starters with the producer label + summary verbatim', async () => {
    renderStrip()

    expect(await screen.findByText('Tech Lead Hiring')).toBeInTheDocument()
    expect(screen.getByText('Delivery confidence vs knowledge retention vs burn')).toBeInTheDocument()
    expect(screen.getByText('Architecture Decision')).toBeInTheDocument()
    expect(screen.getByText('Monolith vs modular vs microservices')).toBeInTheDocument()
    expect(screen.getByText('Market Expansion')).toBeInTheDocument()
    expect(screen.getByText('Which market to enter next')).toBeInTheDocument()
    expect(screen.getByText('Supplier Selection')).toBeInTheDocument()
    expect(screen.getByText('Cost vs resilience vs lead time')).toBeInTheDocument()

    // Exactly 4 — nothing else from the 15 leaked onto the first screen.
    expect(screen.getAllByTestId(/^starter-decision-/)).toHaveLength(4)
  })

  it('never surfaces the dev fixtures, even though the response contains them', async () => {
    renderStrip()
    await screen.findByText('Tech Lead Hiring')

    // Asserted against a response that DOES carry small/medium/edge.
    expect(screen.queryByText('Small Demo')).not.toBeInTheDocument()
    expect(screen.queryByText('Medium Demo')).not.toBeInTheDocument()
    expect(screen.queryByText('Edge Case')).not.toBeInTheDocument()
    expect(screen.queryByText('Near-zero baseline')).not.toBeInTheDocument()
    expect(screen.queryByTestId('starter-decision-small')).not.toBeInTheDocument()
    expect(screen.queryByTestId('starter-decision-medium')).not.toBeInTheDocument()
    expect(screen.queryByTestId('starter-decision-edge')).not.toBeInTheDocument()
  })

  it('fails closed: a featured id absent from the response renders NOTHING for it', async () => {
    const partial = liveLikeResponse()
    partial.items = partial.items.filter((t) => t.id !== 'architecture_choice')
    templatesMock.mockResolvedValue(partial)

    renderStrip()
    await screen.findByText('Tech Lead Hiring')

    // No placeholder, no broken card, no title text — nothing.
    expect(screen.queryByTestId('starter-decision-architecture_choice')).not.toBeInTheDocument()
    expect(screen.queryByText('Architecture Decision')).not.toBeInTheDocument()
    expect(screen.getAllByTestId(/^starter-decision-/)).toHaveLength(3)
  })

  it('renders nothing at all when none of the featured ids resolve', async () => {
    templatesMock.mockResolvedValue({
      schema: 'template-list.v1',
      items: [
        { id: 'small', name: 'Small Demo', description: 'Small demo graph', version: '1.0' },
        { id: 'medium', name: 'Medium Demo', description: 'Medium demo graph', version: '1.0' },
      ],
    })

    const { container } = renderStrip()
    // Flush the full then-chain (fetch → filter → setFeatured → re-render):
    // templatesMock is called synchronously in the mount effect, so waiting on
    // the CALL alone can assert against the pre-settle render — where the
    // container is empty whether or not the fail-closed filter works (repo
    // trap: an absence assertion must not be satisfiable by "not yet").
    await act(async () => {})

    // No regression: the screen is exactly as it is today.
    expect(templatesMock).toHaveBeenCalled()
    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByTestId('starter-decisions')).not.toBeInTheDocument()
  })

  it('renders nothing when the templates fetch fails', async () => {
    templatesMock.mockRejectedValue(new Error('network down'))

    const { container } = renderStrip()
    await act(async () => {})

    expect(templatesMock).toHaveBeenCalled()
    expect(container).toBeEmptyDOMElement()
  })

  it('is hidden once a graph exists — and does not even fetch for it', async () => {
    useCanvasStore.setState({
      nodes: [{ id: 'n1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'Real work' } }] as any,
      edges: [],
    })

    const { container } = renderStrip()

    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByText('Tech Lead Hiring')).not.toBeInTheDocument()
    // Rendering null is free; a fetch is not. A mount that can never show the
    // strip must not pay for the list.
    expect(templatesMock).not.toHaveBeenCalled()
  })

  it('is hidden when only an edge exists (hasGraph covers edges too)', async () => {
    useCanvasStore.setState({
      nodes: [],
      edges: [{ id: 'e1', source: 'a', target: 'b' }] as any,
    })

    const { container } = renderStrip()

    expect(container).toBeEmptyDOMElement()
    expect(templatesMock).not.toHaveBeenCalled()
  })

  it('clicking a starter loads THAT template through the shared loader and emits on the PROP bus', async () => {
    const blueprint = { id: 'architecture_choice', name: 'Architecture Decision', description: 'x', nodes: [], edges: [] }
    loadTemplateBlueprintMock.mockResolvedValue({ blueprint, templateDetail: {}, graph: {} })

    renderStrip()
    await screen.findByText('Architecture Decision')

    await userEvent.click(screen.getByTestId('starter-decision-architecture_choice'))

    await waitFor(() => {
      expect(loadTemplateBlueprintMock).toHaveBeenCalledWith('architecture_choice')
    })
    expect(loadTemplateBlueprintMock).toHaveBeenCalledTimes(1)
    expect(bus.emit).toHaveBeenCalledWith(blueprint)
  })

  // An adversarial audit caught this: the catch logged under import.meta.env.DEV
  // and did nothing else, so a failed template fetch produced a card that
  // swallowed the click — no toast, no error, no change — on the first screen a
  // new user ever sees. The strip emits on the blueprint bus directly, so it
  // inherits NONE of the Templates panel's error surface and must raise its own.
  // The copy is pinned via the SHARED CONSTANT the panel also renders, so the
  // "one dialect, not two" invariant is a compile-time fact, not a hope.
  // MUTATION-CHECK: delete the showToast call in StarterDecisions' load-failure
  // catch and this test goes RED.
  it('surfaces a failed load instead of swallowing the click (no dead cards)', async () => {
    loadTemplateBlueprintMock.mockRejectedValueOnce(new Error('graph fetch failed'))

    renderStrip()
    await screen.findByText('Tech Lead Hiring')

    await userEvent.click(screen.getByTestId('starter-decision-hiring_strategy_tech_lead'))

    await waitFor(() => {
      expect(showToastMock).toHaveBeenCalledWith(TEMPLATE_LOAD_FAILED_MESSAGE, 'error')
    })
    // The click must not silently "succeed" either.
    expect(bus.emit).not.toHaveBeenCalled()
  })

  it('honours the shared replace-canvas confirm gate when the user declines', async () => {
    confirmReplaceCanvasMock.mockReturnValue(false)

    renderStrip()
    await screen.findByText('Tech Lead Hiring')

    await userEvent.click(screen.getByTestId('starter-decision-hiring_strategy_tech_lead'))

    expect(loadTemplateBlueprintMock).not.toHaveBeenCalled()
    expect(bus.emit).not.toHaveBeenCalled()
  })

  // The review found this race browser-reachable: both clicks pass the confirm
  // gate while the canvas is still empty, the first emit inserts the template,
  // and the second emit lands on a canvas that now carries data.templateId —
  // popping ReactFlowGraph's "template already exists / replace?" dialog as
  // the user's very first interaction.
  // MUTATION-CHECK: remove the pickInFlight latch and this test goes RED.
  it('a double-click runs ONE load→emit cycle, not two (re-entrancy latch)', async () => {
    const blueprint = { id: 'hiring_strategy_tech_lead', name: 'Tech Lead Hiring', description: 'x', nodes: [], edges: [] }
    let release!: () => void
    loadTemplateBlueprintMock.mockImplementation(
      () => new Promise((resolve) => {
        release = () => resolve({ blueprint, templateDetail: {}, graph: {} })
      })
    )

    renderStrip()
    await screen.findByText('Tech Lead Hiring')

    const card = screen.getByTestId('starter-decision-hiring_strategy_tech_lead')
    // Two clicks while the first load is still in flight.
    await userEvent.click(card)
    await userEvent.click(card)
    release()

    await waitFor(() => expect(bus.emit).toHaveBeenCalledTimes(1))
    expect(loadTemplateBlueprintMock).toHaveBeenCalledTimes(1)
  })

  // The confirm gate runs BEFORE the await; the canvas can gain content while
  // the fetch is in flight (a hydrating saved scenario, a CEE draft landing).
  // insertBlueprint REPLACES the whole graph, so emitting a stale click would
  // silently destroy work the user was never asked about.
  // MUTATION-CHECK: remove the post-await emptiness re-check and this goes RED.
  it('drops the click when the canvas gains content during the fetch (never silently replaces)', async () => {
    const blueprint = { id: 'hiring_strategy_tech_lead', name: 'Tech Lead Hiring', description: 'x', nodes: [], edges: [] }
    let release!: () => void
    loadTemplateBlueprintMock.mockImplementation(
      () => new Promise((resolve) => {
        release = () => resolve({ blueprint, templateDetail: {}, graph: {} })
      })
    )

    renderStrip()
    await screen.findByText('Tech Lead Hiring')
    await userEvent.click(screen.getByTestId('starter-decision-hiring_strategy_tech_lead'))

    // A saved scenario hydrates while the template fetch is in flight.
    useCanvasStore.setState({
      nodes: [{ id: 'hydrated-1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'Saved work' } }] as any,
      edges: [],
    })
    release()

    // The stale click is dropped: the user's hydrated work is never replaced.
    await waitFor(() => expect(loadTemplateBlueprintMock).toHaveBeenCalledTimes(1))
    expect(bus.emit).not.toHaveBeenCalled()
  })

  // emit sits OUTSIDE the load try/catch: a subscriber throw is an insert
  // failure, not a load failure — but it must still surface, not vanish.
  it('surfaces a subscriber throw during insert instead of swallowing it', async () => {
    const blueprint = { id: 'architecture_choice', name: 'Architecture Decision', description: 'x', nodes: [], edges: [] }
    loadTemplateBlueprintMock.mockResolvedValue({ blueprint, templateDetail: {}, graph: {} })
    bus.emit.mockImplementation(() => {
      throw new Error('subscriber blew up')
    })

    renderStrip()
    await screen.findByText('Architecture Decision')
    await userEvent.click(screen.getByTestId('starter-decision-architecture_choice'))

    await waitFor(() => {
      expect(showToastMock).toHaveBeenCalledWith(TEMPLATE_LOAD_FAILED_MESSAGE, 'error')
    })
  })
})
