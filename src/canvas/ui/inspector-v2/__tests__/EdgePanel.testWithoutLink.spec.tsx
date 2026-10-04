/**
 * "Test without this link" is reachable from the link inspector.
 *
 * The press had one door: the Reasoning tab's Challenge signal, which mounts
 * only when the Run reports a sensitive, Olumi-estimated link. A current Run
 * whose leader is withheld reports none (no robustness rows), so across three
 * signed-in journeys on served staging the button never appeared, although the
 * service answers the press for any link on a current Run.
 *
 * The inspector is where a person is looking at one specific link, so it hosts
 * the same component (same gate, same sender, same press id).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { EdgePanel } from '../panels/EdgePanel'
import { useCanvasStore } from '../../../store'
import { useGuidanceStore } from '../../../stores/guidanceStore'
import type { ConversationContextValue } from '../../../conversation/ConversationContext'

let conversation: (Pick<ConversationContextValue, 'sendChip' | 'isThinking'> & { messages: unknown[] }) | null
vi.mock('../../../conversation/ConversationContext', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, useOptionalConversationContext: () => conversation }
})
vi.mock('../../../conversation/revealOlumi', () => ({ revealOlumiSurface: vi.fn() }))
vi.mock('../../../../lib/supabase', () => ({ supabase: {}, isSupabaseAvailable: () => false }))
vi.mock('../../../../adapters/plot', () => ({ plot: { validatePatch: vi.fn() } }))

const FLAG = 'feature.testWithoutLink'
const initialCanvas = useCanvasStore.getState()
const initialGuidance = useGuidanceStore.getState()
const sendChip = vi.fn<Parameters<ConversationContextValue['sendChip']>, ReturnType<ConversationContextValue['sendChip']>>()
const panelProps = { edgeId: 'link-1', techMode: false, onClose: vi.fn(), onNavigate: vi.fn() }
const NAME = 'Test without this link'

/**
 * A current Run with NO leader and NO robustness rows: the journeys' state.
 * The link is user-stated, so "Question this assumption" is not offered and
 * cannot be mistaken for this button.
 */
function seedCurrentRun(extra: Record<string, unknown> = {}) {
  useCanvasStore.setState({
    currentScenarioId: 'scenario-1',
    nodes: [
      { id: 'factor-a', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Price rise' } },
      { id: 'goal-b', type: 'goal', position: { x: 0, y: 100 }, data: { label: 'Revenue' } },
    ],
    edges: [
      { id: 'link-1', source: 'factor-a', target: 'goal-b', data: { weight: 0.6, weightSource: 'user', direction: 'positive' } },
      { id: 'link-9', source: 'factor-z', target: 'goal-b', data: {} },
    ],
    hasCompletedFirstRun: true,
    analysisFreshness: { freshness: 'fresh', freshnessReason: 'graph_hash_match' },
    analysisFreshnessDirty: false, analysisStateV1: null, importPendingServerRegistration: false,
    results: { status: 'complete', report: { option_probabilities: null } },
    ...extra,
  } as never)
}

beforeEach(() => {
  localStorage.removeItem(FLAG)
  sendChip.mockReset()
  sendChip.mockResolvedValue(undefined)
  conversation = { sendChip, isThinking: false, messages: [] }
})
afterEach(() => {
  cleanup()
  localStorage.removeItem(FLAG)
  useCanvasStore.setState(initialCanvas, true)
  useGuidanceStore.setState(initialGuidance, true)
})

describe('Test without this link in the link inspector', () => {
  it('is offered by default for a link on a current Run, without any Challenge signal naming it', () => {
    seedCurrentRun()
    render(<EdgePanel {...panelProps} />)
    const host = screen.getByTestId('edge-test-without-link')
    expect(host).toContainElement(screen.getByRole('button', { name: NAME }))
    // Plain words: the offer carries no figure.
    expect(host.textContent).toBe(NAME)
  })

  it('dispatches the exact press for THIS link, once', async () => {
    seedCurrentRun()
    let complete!: () => void
    sendChip.mockReturnValue(new Promise<void>(resolve => { complete = resolve }))
    render(<EdgePanel {...panelProps} />)
    fireEvent.click(screen.getByRole('button', { name: NAME }))
    // A second press while the first is in flight sends nothing.
    fireEvent.click(screen.getByRole('button', { name: 'Testing without this link…' }))
    expect(sendChip).toHaveBeenCalledTimes(1)
    expect(sendChip).toHaveBeenCalledWith({
      id: 'agent-test-without-link:["factor-a","goal-b"]',
      label: NAME, message: NAME, intent: 'primary',
      sourceBlockKey: 'test-without-link:scenario-1:factor-a::goal-b',
    })
    await act(async () => complete())
    expect(screen.getByRole('button', { name: NAME })).toBeEnabled()
  })

  it.each([
    ['before any Run', { results: { status: 'none', report: null }, hasCompletedFirstRun: false, analysisFreshness: null }],
    ['when the model changed after the Run', { analysisFreshnessDirty: true }],
  ])('is hidden %s', (_state, extra) => {
    seedCurrentRun(extra)
    render(<EdgePanel {...panelProps} />)
    expect(screen.queryByTestId('edge-test-without-link')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: NAME })).not.toBeInTheDocument()
  })

  it('is hidden when there is no conversation to send into', () => {
    seedCurrentRun()
    conversation = null
    render(<EdgePanel {...panelProps} />)
    expect(screen.queryByRole('button', { name: NAME })).not.toBeInTheDocument()
  })

  it('is hidden for a link that is on the canvas only, which the Run never saw', () => {
    seedCurrentRun()
    useCanvasStore.setState({
      edges: [{ id: 'link-1', source: 'factor-a', target: 'goal-b', data: { structuralAddStandDown: 'strength_not_stated' } }],
      lastAuthoritativeGraph: { edgePairs: [] },
    } as never)
    render(<EdgePanel {...panelProps} />)
    expect(screen.queryByRole('button', { name: NAME })).not.toBeInTheDocument()
  })

  it('can be switched off', () => {
    localStorage.setItem(FLAG, '0')
    seedCurrentRun()
    render(<EdgePanel {...panelProps} />)
    expect(screen.queryByRole('button', { name: NAME })).not.toBeInTheDocument()
  })
})
