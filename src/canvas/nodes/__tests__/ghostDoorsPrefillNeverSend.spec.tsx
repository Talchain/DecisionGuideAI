/**
 * ⭐ A CANVAS PROMPT FILLS THE COMPOSER; THE PERSON SENDS IT (Experience Design,
 * #63 5807363175, 24 Sep 2026: "prompts prefill-and-confirm, never send").
 *
 * Both frontier doors — the option ghost ("What else could you do?") and the
 * row-end tier doors for Factor / Outcome / Risk — used to call
 * `guidanceStore._sendMessage`. One click put a sentence into the user's
 * transcript, under the user's own name, that they had not said. The product
 * test (reasoning enhancement, the human stays the author) rules that out.
 *
 * They now go through `requestAsk`, the one ask seam: it fills the composer
 * and reveals Olumi; the person reads the sentence and chooses to send it.
 *
 * Why this could not ship before: an ask from the MINIMISED pill disconnected
 * every ask door on the canvas (`OlumiTabBody` did not re-register after the
 * floating host unmounted). That is fixed in this PR and pinned by
 * `askFromMinimisedPillKeepsRegistration.spec.tsx`; this file pins the doors.
 *
 * Bound by IDENTITY: the composer receives exactly the `data.prompt` the mount
 * built (equality, not a keyword), and the send channel receives nothing.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { GhostTierNode, GHOST_TIER_TESTID } from '../GhostTierNode'
import { GhostOptionNode } from '../GhostOptionNode'
import { GHOST_OPTION_DOOR_LABEL } from '../../utils/ghostTiers'
import { useGuidanceStore } from '../../stores/guidanceStore'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

const TIER_PROMPT = 'Which other factors drive Annual platform cost for Segment and RudderStack?'
const OPTION_PROMPT = 'I have 2 options for replacing our CDP: Segment and RudderStack. What else could I do?'

function channels() {
  const prefilled: string[] = []
  const sent: string[] = []
  useGuidanceStore.setState({
    _prefillChat: (t: string) => { prefilled.push(t) },
    _sendMessage: (t: string) => { sent.push(t) },
  })
  return { prefilled, sent }
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
  useGuidanceStore.setState({ _sendMessage: null, _prefillChat: null, _dispatchAction: null })
})

describe('row-end tier door (Factor / Outcome / Risk): prefill, never send', () => {
  it('a click puts EXACTLY the mounted prompt in the composer and sends nothing', () => {
    const c = channels()
    mountTier({ label: 'What else drives this?', prompt: TIER_PROMPT, tier: 'factor' })
    fireEvent.click(screen.getByTestId(GHOST_TIER_TESTID))
    expect(c.prefilled).toEqual([TIER_PROMPT])
    expect(c.sent).toEqual([])
  })

  it('Enter does the same — the keyboard path is the same door', () => {
    const c = channels()
    mountTier({ label: 'What else could go wrong?', prompt: TIER_PROMPT, tier: 'risk' })
    fireEvent.keyDown(screen.getByTestId(GHOST_TIER_TESTID), { key: 'Enter' })
    expect(c.prefilled).toEqual([TIER_PROMPT])
    expect(c.sent).toEqual([])
  })

  it('no prompt → nothing in either channel (the door invents no sentence)', () => {
    const c = channels()
    mountTier({ label: 'Where else could this lead?', tier: 'outcome' })
    fireEvent.click(screen.getByTestId(GHOST_TIER_TESTID))
    expect(c.prefilled).toEqual([])
    expect(c.sent).toEqual([])
  })
})

describe('option ghost door ("What else could you do?"): prefill, never send', () => {
  it('a click puts EXACTLY the mounted prompt in the composer and sends nothing', () => {
    const c = channels()
    mountOption({ prompt: OPTION_PROMPT })
    fireEvent.click(screen.getByRole('button', { name: GHOST_OPTION_DOOR_LABEL }))
    expect(c.prefilled).toEqual([OPTION_PROMPT])
    expect(c.sent).toEqual([])
  })

  it('CONTRAST CONTROL: with no composer registered but a send channel present, it still never sends', () => {
    // `requestAsk` falls back to the Ask drawer (the person still confirms);
    // it never takes the send channel as a substitute for the composer.
    const sent: string[] = []
    useGuidanceStore.setState({ _prefillChat: null, _sendMessage: (t: string) => { sent.push(t) } })
    mountOption({ prompt: OPTION_PROMPT })
    fireEvent.click(screen.getByRole('button', { name: GHOST_OPTION_DOOR_LABEL }))
    expect(sent).toEqual([])
  })
})
