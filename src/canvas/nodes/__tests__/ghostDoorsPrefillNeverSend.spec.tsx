// Inverted before implementation: 7 Oct explicit auto-send ruling.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { GhostTierNode, GHOST_TIER_TESTID } from '../GhostTierNode'
import { GhostOptionNode } from '../GhostOptionNode'
import { GHOST_OPTION_DOOR_LABEL } from '../../utils/ghostTiers'
import { useGuidanceStore } from '../../stores/guidanceStore'
import { chooseWhatElse } from './chooseWhatElse'
import { clearAskTargetBinding, takeAskTargetBinding } from '../../ui/inspector-v2/askTargetBinding'
import { useCanvasStore } from '../../store'
import { revealOlumiSurface } from '../../conversation/revealOlumi'
vi.mock('../../conversation/revealOlumi', () => ({ revealOlumiSurface: vi.fn(() => true) }))

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

const TIER_PROMPT = 'Which other factors drive Annual platform cost for Segment and RudderStack?'
const OPTION_PROMPT = 'I have 2 options for replacing our CDP: Segment and RudderStack. What else could I do?'

function channels() {
  const prefilled: string[] = []
  const sent: string[] = []
  const dispatched: Array<{ id: string; message: string; source: string }> = []
  useGuidanceStore.setState({
    _dispatchAction: (o) => { dispatched.push(o as never) },
    _isConversationBusy: () => false,
    _prefillChat: (t: string) => { prefilled.push(t) },
    _sendMessage: (t: string) => { sent.push(t) },
  })
  return { prefilled, sent, dispatched }
}

function mountTier(data: Record<string, unknown>) {
  const props = { id: '__ghost_factor', type: 'ghost-tier', data, selected: false, zIndex: 0, isConnectable: false, xPos: 0, yPos: 0, dragging: false } as unknown as NodeProps
  return render(<ReactFlowProvider><GhostTierNode {...props} /></ReactFlowProvider>)
}
function mountOption(data: Record<string, unknown>) {
  const props = { id: 'ghost-option', type: 'ghost-option', data, selected: false, zIndex: 0, isConnectable: false, xPos: 0, yPos: 0, dragging: false } as unknown as NodeProps
  return render(<ReactFlowProvider><GhostOptionNode {...props} /></ReactFlowProvider>)
}

beforeEach(() => {
  vi.clearAllMocks(); clearAskTargetBinding()
  useCanvasStore.setState({ nodes: [], edges: [], hasCompletedFirstRun: false, results: { status: 'idle' }, v5AnalysisFact: null } as never)
  useGuidanceStore.setState({ _sendMessage: null, _prefillChat: null, _dispatchAction: null })
})

describe('row-end tier door (Factor / Outcome / Risk): send once as a chip', () => {
  it('a click sends the registered question once as a chip', () => {
    const c = channels()
    mountTier({ label: 'What else drives this?', prompt: TIER_PROMPT, tier: 'factor' })
    fireEvent.click(screen.getByTestId(GHOST_TIER_TESTID))
    chooseWhatElse('factor')
    expect(c.prefilled).toEqual([])
    expect(c.dispatched).toEqual([expect.objectContaining({ id: 'ask:missing-factor', source: 'chip', message: 'What else could change how this turns out that the model doesn’t have yet?' })])
    expect(revealOlumiSurface).toHaveBeenCalled()
    expect(c.sent).toEqual([])
    const bound = takeAskTargetBinding(c.dispatched[0].message)
    expect(bound?.nodeIds).toEqual(new Set())
    expect(bound?.edgeIds).toEqual(new Set())
  })

  it('Enter does the same — the keyboard path is the same door', () => {
    const c = channels()
    mountTier({ label: 'What else could go wrong?', prompt: TIER_PROMPT, tier: 'risk' })
    fireEvent.keyDown(screen.getByTestId(GHOST_TIER_TESTID), { key: 'Enter' })
    chooseWhatElse('risk')
    expect(c.prefilled).toEqual([])
    expect(c.dispatched).toEqual([{ id: 'ask:risks', source: 'chip', label: 'What could go wrong, or unexpectedly well, that this model doesn’t have yet?', message: 'What could go wrong, or unexpectedly well, that this model doesn’t have yet?' }])
    expect(c.sent).toEqual([])
    const bound = takeAskTargetBinding(c.dispatched[0].message)
    expect(bound?.nodeIds).toEqual(new Set())
    expect(bound?.edgeIds).toEqual(new Set())
  })

  it('no prompt → nothing in either channel (the door invents no sentence)', () => {
    const c = channels()
    mountTier({ label: 'Where else could this lead?', tier: 'outcome' })
    fireEvent.click(screen.getByTestId(GHOST_TIER_TESTID))
    expect(c.prefilled).toEqual([])
    expect(c.sent).toEqual([])
    expect(c.dispatched).toEqual([])
  })
})

describe('option ghost door ("What else could you do?"): send once as a chip', () => {
  it('a click sends the registered question once as a chip', () => {
    const c = channels()
    mountOption({ prompt: OPTION_PROMPT })
    fireEvent.click(screen.getByRole('button', { name: GHOST_OPTION_DOOR_LABEL }))
    chooseWhatElse('option')
    expect(c.prefilled).toEqual([])
    expect(c.dispatched).toEqual([{ id: 'agent-next-widen', source: 'chip', label: 'What other ways could we reach the goal that aren’t on the board yet?', message: 'What other ways could we reach the goal that aren’t on the board yet?' }])
    const bound = takeAskTargetBinding(c.dispatched[0].message)
    expect(bound?.nodeIds).toEqual(new Set())
    expect(bound?.edgeIds).toEqual(new Set())
    expect(c.sent).toEqual([])
  })

  it('CONTRAST CONTROL: with no composer registered but a send channel present, it still never sends', () => {
    // `requestAsk` falls back to the Ask drawer (the person still confirms);
    // it never takes the send channel as a substitute for the composer.
    const sent: string[] = []

    useGuidanceStore.setState({ _prefillChat: null, _sendMessage: (t: string) => { sent.push(t) } })
    mountOption({ prompt: OPTION_PROMPT })
    fireEvent.click(screen.getByRole('button', { name: GHOST_OPTION_DOOR_LABEL }))
    chooseWhatElse('option')
    expect(sent).toEqual([])
  })
})
