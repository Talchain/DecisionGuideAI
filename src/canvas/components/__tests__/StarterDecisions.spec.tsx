/**
 * StarterDecisions — first-run starter strip.
 *
 * The pins that matter here are ALLOW-LIST pins. The response fixture below is
 * deliberately the REAL live shape: 15 templates, dev fixtures FIRST (they sort
 * first live), so "dev fixtures never reach the first screen" is asserted
 * against a response that actually contains them — not against a response we
 * quietly cleaned up first.
 */

import { render, screen, waitFor } from '@testing-library/react'
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
vi.mock('../../blueprints/loadTemplateBlueprint', () => ({
  loadTemplateBlueprint: (id: string) => loadTemplateBlueprintMock(id),
  confirmReplaceCanvas: () => confirmReplaceCanvasMock(),
}))

const emitMock = vi.fn((_bp: unknown) => ({}))
vi.mock('../../blueprints/eventBus', () => ({
  blueprintEventBus: { emit: (bp: unknown) => emitMock(bp) },
}))

const showToastMock = vi.fn()
vi.mock('../../ToastContext', () => ({
  useShowToastSafe: () => showToastMock,
}))

import { StarterDecisions } from '../StarterDecisions'
import { useCanvasStore } from '../../store'

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

beforeEach(() => {
  vi.clearAllMocks()
  confirmReplaceCanvasMock.mockReturnValue(true)
  templatesMock.mockResolvedValue(liveLikeResponse())
  useCanvasStore.setState({ nodes: [], edges: [] })
})

// --- specs -----------------------------------------------------------------

describe('StarterDecisions', () => {
  it('renders the 4 featured starters with the producer label + summary verbatim', async () => {
    render(<StarterDecisions />)

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
    render(<StarterDecisions />)
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

    render(<StarterDecisions />)
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

    const { container } = render(<StarterDecisions />)
    await waitFor(() => expect(templatesMock).toHaveBeenCalled())

    // No regression: the screen is exactly as it is today.
    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByTestId('starter-decisions')).not.toBeInTheDocument()
  })

  it('renders nothing when the templates fetch fails', async () => {
    templatesMock.mockRejectedValue(new Error('network down'))

    const { container } = render(<StarterDecisions />)
    await waitFor(() => expect(templatesMock).toHaveBeenCalled())

    expect(container).toBeEmptyDOMElement()
  })

  it('is hidden once a graph exists', async () => {
    useCanvasStore.setState({
      nodes: [{ id: 'n1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'Real work' } }] as any,
      edges: [],
    })

    const { container } = render(<StarterDecisions />)
    await waitFor(() => expect(templatesMock).toHaveBeenCalled())

    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByText('Tech Lead Hiring')).not.toBeInTheDocument()
  })

  it('is hidden when only an edge exists (hasGraph covers edges too)', async () => {
    useCanvasStore.setState({
      nodes: [],
      edges: [{ id: 'e1', source: 'a', target: 'b' }] as any,
    })

    const { container } = render(<StarterDecisions />)
    await waitFor(() => expect(templatesMock).toHaveBeenCalled())

    expect(container).toBeEmptyDOMElement()
  })

  it('clicking a starter loads THAT template through the shared loader', async () => {
    const blueprint = { id: 'architecture_choice', name: 'Architecture Decision', description: 'x', nodes: [], edges: [] }
    loadTemplateBlueprintMock.mockResolvedValue({ blueprint, templateDetail: {}, graph: {} })

    render(<StarterDecisions />)
    await screen.findByText('Architecture Decision')

    await userEvent.click(screen.getByTestId('starter-decision-architecture_choice'))

    await waitFor(() => {
      expect(loadTemplateBlueprintMock).toHaveBeenCalledWith('architecture_choice')
    })
    expect(loadTemplateBlueprintMock).toHaveBeenCalledTimes(1)
    expect(emitMock).toHaveBeenCalledWith(blueprint)
  })

  // An adversarial audit caught this: the catch logged under import.meta.env.DEV
  // and did nothing else, so a failed template fetch produced a card that
  // swallowed the click — no toast, no error, no change — on the first screen a
  // new user ever sees. The strip emits on the blueprint bus directly, so it
  // inherits NONE of the Templates panel's error surface and must raise its own.
  // MUTATION-CHECK: delete the showToast call in StarterDecisions' catch and
  // this test goes RED. The 9 pins that existed before it all stayed GREEN
  // through the dead click — which is exactly why it is here.
  it('surfaces a failed load instead of swallowing the click (no dead cards)', async () => {
    loadTemplateBlueprintMock.mockRejectedValueOnce(new Error('graph fetch failed'))

    render(<StarterDecisions />)
    await screen.findByText('Tech Lead Hiring')

    await userEvent.click(screen.getByTestId('starter-decision-hiring_strategy_tech_lead'))

    await waitFor(() => {
      expect(showToastMock).toHaveBeenCalledWith('Failed to load template.')
    })
    // The click must not silently "succeed" either.
    expect(emitMock).not.toHaveBeenCalled()
  })

  it('uses the SAME failure copy as the Templates panel (one dialect, not two)', async () => {
    loadTemplateBlueprintMock.mockRejectedValueOnce(new Error('boom'))

    render(<StarterDecisions />)
    await screen.findByText('Tech Lead Hiring')
    await userEvent.click(screen.getByTestId('starter-decision-architecture_choice'))

    // TemplatesPanel.tsx uses this exact string; two surfaces failing in two
    // dialects is how copy drift starts.
    await waitFor(() => {
      expect(showToastMock).toHaveBeenCalledWith('Failed to load template.')
    })
  })

  it('honours the shared replace-canvas confirm gate when the user declines', async () => {
    confirmReplaceCanvasMock.mockReturnValue(false)

    render(<StarterDecisions />)
    await screen.findByText('Tech Lead Hiring')

    await userEvent.click(screen.getByTestId('starter-decision-hiring_strategy_tech_lead'))

    expect(loadTemplateBlueprintMock).not.toHaveBeenCalled()
    expect(emitMock).not.toHaveBeenCalled()
  })
})
