/**
 * EDIT-UX slice 1: the real Router → shell → panel boundary.
 * These are DOM, accessible-name and handler contracts, not layout claims.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { Edge, Node } from '@xyflow/react'

import { InspectorRouter } from '../InspectorRouter'
import { requestAsk } from '../askSemantic'
import { EXAMINE_LINK_LIMIT, EXAMINE_LINK_WHY } from '../examine/examineLinkView'
import { useCanvasStore } from '../../../store'
import { useGuidanceStore } from '../../../stores/guidanceStore'
import { mapDraftEdgeToCanvas } from '../../../utils/applyDraftResult'
import { revealOlumiSurface } from '../../../conversation/revealOlumi'

vi.mock('@xyflow/react', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useViewport: () => ({ x: 0, y: 0, zoom: 1 }),
}))
vi.mock('../../../../lib/supabase', () => ({ supabase: {}, isSupabaseAvailable: () => false }))
vi.mock('../../../../adapters/plot', () => ({ plot: { validatePatch: vi.fn() } }))
vi.mock('../../../conversation/revealOlumi', () => ({ revealOlumiSurface: vi.fn(() => true) }))
vi.mock('../askSemantic', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  requestAsk: vi.fn(() => 'sent'),
}))

const initialCanvas = useCanvasStore.getState()
const initialGuidance = useGuidanceStore.getState()
const sendChip = vi.fn()
const onClose = vi.fn()
const BAND_WORD = /\b(slight|moderate|strong|very strong)\b/i
const NODES: Node[] = [
  { id: 'factor-a', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'A', kind: 'factor', category: 'controllable' } },
  { id: 'factor-b', type: 'factor', position: { x: 0, y: 100 }, data: { label: 'B', kind: 'factor' } },
]

/** Shape copied from EdgePanel.questionAssumption.spec, through real ingestion. */
function mappedEdge(magnitude = 'olumi_estimate', definitional = false): Edge {
  return mapDraftEdgeToCanvas({
    id: 'link-1', from: 'factor-a', to: 'factor-b',
    strength: { mean: 0.55, std: 0.1 }, effect_direction: 'positive', exists_probability: 0.8,
    provenance: {
      source: 'cee_hypothesis', magnitude, ...(definitional ? { definitional: true } : {}),
      natural_effect: {
        amount: 3, amount_unit: '£/month', per_source_change: 1, per_source_change_unit: 'customers',
        strength_mean: 0.55, strength_mean_frame: 'edge_strength',
      },
    },
  }, 0) as Edge
}

function seed(edge = mappedEdge(), withGoal = false, nodes = NODES) {
  useCanvasStore.setState({
    nodes: [...nodes, ...(withGoal ? [{ id: 'goal', type: 'goal', position: { x: 0, y: 200 }, data: { label: 'Margin', kind: 'goal' } }] : [])],
    edges: [edge, ...(withGoal ? [{ id: 'link-2', source: 'factor-b', target: 'goal', data: {} }] : [])],
    ceeAnalysisReady: withGoal ? { goal_node_id: 'goal', options: [] } : null,
    results: { status: 'none', report: null }, analysisStateV1: null, analysisFreshness: null,
    lastAuthoritativeGraph: null, hasCompletedFirstRun: false, v5AnalysisFact: null,
    goalThreshold: null, confirmedNodeIds: new Set(), _internal: {},
    selection: { nodeIds: new Set(), edgeIds: new Set(['link-1']), anchorPosition: null },
  } as never)
}

function openEdge() {
  render(<InspectorRouter nodeId={null} edgeId="link-1" onClose={onClose} />)
  return screen.getByRole('region', { name: 'Inspector panel' })
}

function summary() { return screen.getByTestId('inspector-summary-sentence') }
function more() { return screen.getByTestId('inspector-more') }
function openMore() { fireEvent.click(screen.getByTestId('inspector-more-toggle')) }

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.setItem('feature.questionAssumption', '1')
  useGuidanceStore.setState({
    guidanceItems: [], _sendChip: sendChip, _prefillChat: vi.fn(), _sendMessage: null,
    _dispatchAction: vi.fn(), _isConversationBusy: () => false,
  } as never)
})
afterEach(() => {
  cleanup()
  localStorage.removeItem('feature.questionAssumption')
  useCanvasStore.setState(initialCanvas, true)
  useGuidanceStore.setState(initialGuidance, true)
})

describe('Relationship inspector anatomy', () => {
  it('has one exact sized sentence and one honest Olumi provenance chip', () => {
    seed()
    const panel = openEdge()
    expect(within(panel).getAllByTestId('inspector-summary-sentence')).toHaveLength(1)
    expect(summary().textContent).toBe('As A increases, B increases: strong.')
    const directionControl = within(panel).getByTestId('edge-direction-control')
    expect(within(directionControl).getByText('Direction', { exact: true })).toBeVisible()
    expect(within(directionControl).getByTestId('edge-direction-increases').textContent).toBe('increases B')
    expect(within(directionControl).getByTestId('edge-direction-decreases').textContent).toBe('decreases B')
    const chips = within(panel).getAllByTestId('inspector-provenance-chip')
    expect(chips).toHaveLength(1)
    expect(chips[0]).toHaveAttribute('data-provenance', 'olumi')
    expect(chips[0].textContent).toBe("Olumi's estimate")
  })

  it('licenses no band word on a placeholder, with the marker-removal contrast', () => {
    const edge = mappedEdge('olumi_placeholder')
    expect(edge.data?.strengthPlaceholder).toBe(0.55)
    seed(edge)
    openEdge()
    expect(summary().textContent).toContain("isn't sized in the model yet")
    expect(summary().textContent).toContain('How strong do you think it is?')
    expect(summary().textContent?.replace('How strong do you think it is?', '')).not.toMatch(BAND_WORD)
    expect(screen.getByTestId('inspector-provenance-chip')).toHaveAttribute('data-provenance', 'unsized')
    expect(screen.getByTestId('inspector-provenance-chip').textContent).toBe('Not sized yet')
    cleanup()
    const data = { ...edge.data }
    delete data.strengthPlaceholder
    seed({ ...edge, data })
    openEdge()
    expect(summary().textContent).toMatch(BAND_WORD)
  })

  it('renders the example attribution from the example-template source', () => {
    const edge = mappedEdge('example_figure')
    // Same source shape used by template fixtures; no inferred authorship.
    seed({ ...edge, data: { ...edge.data, weightSource: 'template' } })
    openEdge()
    expect(summary().textContent).toBe('As A increases, B increases: strong.')
    const chip = screen.getByTestId('inspector-provenance-chip')
    expect(chip).toHaveAttribute('data-provenance', 'example')
    expect(chip.textContent).toBe('Example figure')
  })

  it('says when direction is unstated instead of promoting the display default', () => {
    const edge = mappedEdge()
    const data = { ...edge.data }
    delete data.directionSource
    delete data.serverStrength
    delete data.effect_direction
    seed({ ...edge, data })
    openEdge()
    expect(summary().textContent).toBe("A has a strong effect on B; the direction isn't stated.")
  })

  it('keeps a definition free of estimate provenance and editable strength', () => {
    seed(mappedEdge('olumi_estimate', true))
    openEdge()
    expect(summary().textContent).toBe('B follows from A by definition.')
    expect(screen.queryByTestId('inspector-provenance-chip')).not.toBeInTheDocument()
    expect(screen.getByTestId('edge-strength-definitional')).toBeInTheDocument()
    expect(screen.queryByTestId('edge-strength-controls')).not.toBeInTheDocument()
    expect(screen.queryByTestId('edge-confirm-current-strength')).not.toBeInTheDocument()
  })

  it('offers exactly one Ask Olumi and retires the three separate ask names', () => {
    seed()
    const panel = openEdge()
    const asks = within(panel).getAllByRole('button', { name: /^Ask Olumi/ })
    expect(asks).toHaveLength(1)
    expect(asks[0]).toHaveAttribute('data-testid', 'inspector-quick-ask')
    expect(asks[0]).toHaveAttribute('aria-label', 'Ask Olumi about A → B')
    expect(asks[0].closest('fieldset')).toBeNull()
    for (const name of ['Examine with Olumi', 'Explore with Olumi', 'Question this assumption']) {
      expect(within(panel).queryByRole('button', { name })).not.toBeInTheDocument()
    }
  })

  it('preserves today’s exact question-assumption sender payload and gives it priority', () => {
    seed(mappedEdge(), true)
    openEdge()
    fireEvent.click(screen.getByTestId('inspector-quick-ask'))
    expect(sendChip.mock.calls).toEqual([
      ['Question this assumption', 'Question this assumption', { id: 'agent-question-assumption:factor-a>factor-b' }],
    ])
    expect(requestAsk).not.toHaveBeenCalled()
  })

  it('without a goal preserves the existing examine-link request and helper tooltip', () => {
    seed()
    openEdge()
    const ask = screen.getByTestId('inspector-quick-ask')
    expect(ask).toHaveAttribute('title', EXAMINE_LINK_LIMIT)
    fireEvent.click(ask)
    expect(requestAsk).toHaveBeenCalledTimes(1)
    expect(requestAsk).toHaveBeenCalledWith({
      text: 'Why would ‘A’ change ‘B’, and how sure are we?', label: 'Examine A → B',
      targetId: 'link-1', edgeIds: ['link-1'], nodeIds: [], intent: 'examine-link',
    })
    expect(sendChip).not.toHaveBeenCalled()
  })

  it('a structural link preserves the existing explore request', () => {
    seed({ id: 'link-1', source: 'factor-a', target: 'factor-b', data: {} }, false, [
      { ...NODES[0], type: 'decision', data: { label: 'A', kind: 'decision' } },
      { ...NODES[1], type: 'option', data: { label: 'B', kind: 'option' } },
    ])
    openEdge()
    fireEvent.click(screen.getByTestId('inspector-quick-ask'))
    expect(requestAsk).toHaveBeenCalledTimes(1)
    expect(requestAsk).toHaveBeenCalledWith({
      text: 'Why would ‘A’ change ‘B’, and how sure are we?',
      label: 'Ask about A → B', context: '', targetId: 'link-1', intent: 'link',
      edgeIds: ['link-1'], nodeIds: [],
    })
    expect(sendChip).not.toHaveBeenCalled()
  })

  it('a canonical structural strength signature on factor endpoints preserves the explore request', () => {
    const edge = mappedEdge()
    seed({ ...edge, data: { ...edge.data, weight: 1, strengthStd: 0.01, beliefExists: 1 } })
    openEdge()
    expect(screen.queryByTestId('inspector-examine-link-why')).not.toBeInTheDocument()
    const ask = screen.getByTestId('inspector-quick-ask')
    expect(ask).not.toHaveAttribute('title')
    fireEvent.click(ask)
    expect(requestAsk).toHaveBeenCalledTimes(1)
    expect(requestAsk).toHaveBeenCalledWith({
      text: 'Why would ‘A’ change ‘B’, and how sure are we?',
      label: 'Ask about A → B', context: '', targetId: 'link-1', intent: 'link',
      edgeIds: ['link-1'], nodeIds: [],
    })
    expect(sendChip).not.toHaveBeenCalled()
  })

  it('an intervention without the canonical structural signature preserves its examine request and More context', () => {
    seed(mappedEdge(), false, [
      { ...NODES[0], type: 'option', data: { label: 'A', kind: 'option' } },
      NODES[1],
    ])
    openEdge()
    const why = screen.getByTestId('inspector-examine-link-why')
    expect(why).toHaveAttribute('data-basis', 'olumi_estimate')
    expect(why.textContent).toBe(EXAMINE_LINK_WHY.olumi_estimate)
    expect(more()).toContainElement(why)
    const helper = within(more()).getByText(EXAMINE_LINK_LIMIT, { exact: true })
    expect(more()).toHaveAttribute('hidden')
    expect(why).not.toBeVisible()
    expect(helper).not.toBeVisible()
    const ask = screen.getByTestId('inspector-quick-ask')
    expect(ask).toHaveAttribute('title', EXAMINE_LINK_LIMIT)
    expect(ask.closest('fieldset')).toBeNull()
    fireEvent.click(ask)
    expect(requestAsk).toHaveBeenCalledTimes(1)
    expect(requestAsk).toHaveBeenCalledWith({
      text: 'Why would ‘A’ change ‘B’, and how sure are we?', label: 'Examine A → B',
      targetId: 'link-1', edgeIds: ['link-1'], nodeIds: [], intent: 'examine-link',
    })
    expect(sendChip).not.toHaveBeenCalled()
    openMore()
    expect(why).toBeVisible()
    expect(helper).toBeVisible()
  })

  it('mounts every moved block inside one collapsed More and reveals them together', () => {
    seed()
    const panel = openEdge()
    const disclosure = more()
    expect(disclosure).toHaveAttribute('hidden')
    expect(screen.getByTestId('inspector-more-toggle')).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByTestId('inspector-more-toggle')).toHaveAttribute('aria-controls', disclosure.id)
    const ids = ['edge-existence-readout', 'edge-relationship-summary', 'edge-values-provenance',
      'inspector-tech-toggle', 'inspector-authority-notice', 'edge-label-mode-toggle']
    const moved = ids.map(id => {
      const matches = within(panel).getAllByTestId(id)
      expect(matches).toHaveLength(1)
      expect(disclosure).toContainElement(matches[0])
      expect(matches[0].closest('[hidden]')).toBe(disclosure)
      return matches[0]
    })
    expect(screen.getByTestId('edge-label-mode-toggle').closest('fieldset')).toBeNull()
    openMore()
    expect(disclosure).not.toHaveAttribute('hidden')
    moved.forEach(element => {
      expect(element.closest('[hidden]')).toBeNull()
      expect(element).toBeVisible()
    })
    // Closing keeps both the portal DOM and the shell's technical state mounted.
    fireEvent.click(screen.getByTestId('inspector-tech-toggle'))
    expect(screen.getByTestId('inspector-tech-toggle')).toHaveAttribute('aria-pressed', 'true')
    openMore()
    expect(disclosure).toHaveAttribute('hidden')
    moved.forEach((element, index) => expect(screen.getByTestId(ids[index])).toBe(element))
    openMore()
    expect(screen.getByTestId('inspector-tech-toggle')).toHaveAttribute('aria-pressed', 'true')
  })

  it('keeps one standalone strength readout and removes the duplicated current-estimate sentence', () => {
    seed()
    const panel = openEdge()
    const spread = screen.getByTestId('edge-strength-spread')
    expect(spread.closest('[data-testid="inspector-more"]')).toBeNull()
    const band = within(spread).getByText('Strong', { exact: true })
    const bandText = Array.from(band.childNodes)
      .filter(node => node.nodeType === globalThis.Node.TEXT_NODE)
      .map(node => node.textContent).join('')
    expect(bandText).toBe('Strong')
    // The summary intentionally names the band, and Fine-tune has endpoint
    // captions. The duplicate contract is the standalone ScienceQuantity.
    const readouts = Array.from(panel.querySelectorAll('[data-testid="science-quantity"][data-kind="strength"]'))
      .filter(element => !element.closest('[data-testid="inspector-more"]'))
    expect(readouts).toHaveLength(1)
    expect(spread).toContainElement(readouts[0] as HTMLElement)
    const standaloneBands = within(panel).getAllByText(/^Strong$/i)
      .filter(element => !element.closest('[data-testid="inspector-more"]') && !element.closest('button'))
    expect(standaloneBands).toHaveLength(1)
    expect(spread).toContainElement(standaloneBands[0])
    expect(panel.textContent).not.toMatch(/Olumi[’']s current estimate is/)
    expect(screen.getByTestId('edge-confirm-current-strength').textContent).toBe("Keep Olumi's estimate")
  })

  it.each([false, true])('preserves portal fieldset authority when strength reaches the model = %s', reaches => {
    const edge = mappedEdge()
    const data = { ...edge.data }
    if (!reaches) delete data.serverStrength
    seed({ ...edge, data })
    openEdge()
    openMore()
    fireEvent.click(screen.getByTestId('inspector-tech-toggle'))
    const betaLabel = within(more()).getByText('β =')
    const beta = betaLabel.parentElement!.querySelector('input')!
    expect(beta, 'the named beta field must contain an input').not.toBeNull()
    const betaFence = beta.closest('fieldset')!
    expect(betaFence, 'the portal must retain a fieldset boundary').not.toBeNull()
    if (reaches) {
      expect(beta).not.toBeDisabled()
      expect(betaFence).not.toHaveAttribute('data-authority')
    } else {
      expect(beta).toBeDisabled()
      expect(betaFence).toHaveAttribute('data-authority', 'no-strength-basis')
      expect(betaFence).toHaveAttribute('aria-describedby', 'inspector-authority-notice')
    }
    const existence = within(more()).getByRole('slider', { name: 'Connection existence probability' })
    expect(existence).toBeDisabled()
    expect(existence.closest('fieldset')).toHaveAttribute('data-authority', 'disabled')
    expect(existence.closest('fieldset')).toHaveAttribute('aria-describedby', 'inspector-authority-notice')
  })

  it('keeps Fine-tune and Effect on target reachable while More is collapsed', () => {
    seed()
    openEdge()
    const fineTune = screen.getByText('Fine-tune', { selector: 'summary' })
    expect(fineTune.closest('[data-testid="inspector-more"]')).toBeNull()
    expect(fineTune).toBeVisible()
    expect(fineTune.parentElement).not.toHaveAttribute('open')
    fireEvent.click(fineTune)
    const slider = screen.getByRole('slider', { name: 'Effect on target' })
    expect(slider.closest('[data-testid="inspector-more"]')).toBeNull()
    expect(slider).not.toBeDisabled()
    expect(more()).toHaveAttribute('hidden')
  })

  it('also routes controllable factors into the shared anatomy, retaining Ask and save truth', () => {
    seed()
    render(<InspectorRouter nodeId="factor-a" edgeId={null} onClose={onClose} />)
    expect(screen.getByRole('button', { name: 'Ask Olumi about A' })).toBeVisible()
    expect(screen.getByTestId('inspector-more-toggle')).toBeVisible()
    expect(screen.getByTestId('inspector-more')).toContainElement(screen.getByTestId('inspector-authority-notice'))
    expect(screen.getByTestId('inspector-header-menu')).toBeVisible()
    openMore()
    expect(screen.getByTestId('inspector-authority-notice')).toBeVisible()
    fireEvent.click(screen.getByTestId('inspector-header-menu'))
    expect(screen.getByRole('menuitem', { name: 'Back to the conversation' })).toBeVisible()
  })

  it('moves the existing conversation navigation into the header menu, closes it and the inspector', () => {
    seed()
    openEdge()
    const menuButton = screen.getByTestId('inspector-header-menu')
    expect(menuButton).toHaveAttribute('aria-label', 'More actions')
    expect(menuButton).toHaveAttribute('aria-haspopup', 'menu')
    expect(menuButton).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(menuButton)
    expect(menuButton).toHaveAttribute('aria-expanded', 'true')
    const back = within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Back to the conversation' })
    expect(back).toHaveAttribute('data-testid', 'inspector-back-to-conversation')
    fireEvent.click(back)
    expect(revealOlumiSurface).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(menuButton).toHaveAttribute('aria-expanded', 'false')
  })
})
