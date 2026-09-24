/**
 * ⭐ WITH NO COMPOSER REGISTERED, A FRONTIER DOOR OPENS THE ASK DRAWER — AND
 * STILL SENDS NOTHING UNTIL THE PERSON PRESSES SEND.
 *
 * `requestAsk` has two confirm surfaces: the composer when `_prefillChat` is
 * registered, and the Ask-Olumi drawer when it is not but a send channel is.
 * `ghostDoorsPrefillNeverSend.spec.tsx` pins the composer path; its contrast
 * case only shows the send channel stays silent on the drawer path. This file
 * pins what the person actually gets there: the question, visible and
 * editable, and exactly one send — after their own Send, never on the click.
 *
 * MOUNT: the REAL door (`GhostOptionNode` / `GhostTierNode`) → the REAL
 * `requestAsk` → the REAL `askOlumiStore` → the REAL `AskOlumiDrawer`, whose
 * Send button is clicked. Only the guidance-store channels are spies.
 *
 * ⚠ WHAT THIS DOES NOT EXERCISE: the drawer is mounted beside the door, not
 * inside `OutputsDock` (its deployed host), so nothing here proves it PAINTS
 * over the canvas (jsdom runs no layout) or that the dock mounts it in every
 * state. The spies stand in for the conversation: this proves what the drawer
 * hands to `_dispatchAction` / `_sendMessage`, not that a turn reaches CEE.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { GhostTierNode, GHOST_TIER_TESTID } from '../GhostTierNode'
import { GhostOptionNode } from '../GhostOptionNode'
import { GHOST_OPTION_DOOR_LABEL } from '../../utils/ghostTiers'
import { useGuidanceStore } from '../../stores/guidanceStore'
import { AskOlumiDrawer } from '../../../components/results/coaching/AskOlumiDrawer'
import { useAskOlumiStore } from '../../../components/results/coaching/askOlumiStore'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

const TIER_PROMPT = 'Which other factors drive Annual platform cost for Segment and RudderStack?'
const OPTION_PROMPT = 'I have 2 options for replacing our CDP: Segment and RudderStack. What else could I do?'
const EDITED = 'What would a phased migration to RudderStack look like?'

const DOORS = {
  'option ghost': {
    prompt: OPTION_PROMPT,
    mount: () => {
      const props = { id: 'ghost-option', type: 'ghost-option', data: { prompt: OPTION_PROMPT }, selected: false, zIndex: 0, isConnectable: false, xPos: 0, yPos: 0, dragging: false } as unknown as NodeProps
      return <GhostOptionNode {...props} />
    },
    activate: () => fireEvent.click(screen.getByRole('button', { name: GHOST_OPTION_DOOR_LABEL })),
  },
  'row-end tier': {
    prompt: TIER_PROMPT,
    mount: () => {
      const props = { id: '__ghost_factor', type: 'ghost-tier', data: { label: 'What else drives this?', prompt: TIER_PROMPT, tier: 'factor' }, selected: false, zIndex: 0, isConnectable: false, xPos: 0, yPos: 0, dragging: false } as unknown as NodeProps
      return <GhostTierNode {...props} />
    },
    activate: () => fireEvent.click(screen.getByTestId(GHOST_TIER_TESTID)),
  },
} as const

type Door = keyof typeof DOORS
type Channel = 'send channel only' | 'dispatch + send channels'

function channels(channel: Channel) {
  const sent: string[] = []
  const dispatched: Array<Record<string, unknown>> = []
  useGuidanceStore.setState({
    _prefillChat: null,
    _sendMessage: (t: string) => { sent.push(t) },
    _dispatchAction: channel === 'dispatch + send channels'
      ? (opts) => { dispatched.push(opts as Record<string, unknown>) }
      : null,
  })
  /** Every send, on either channel, as the text that would reach the thread. */
  const allSends = () => [...sent, ...dispatched.map((d) => d.message as string)]
  return { sent, dispatched, allSends }
}

const drawer = () => screen.queryByTestId('ask-olumi-drawer')
const draftBox = () => screen.getByTestId('ask-olumi-draft') as HTMLTextAreaElement
const sendButton = () => screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement

beforeEach(() => {
  useAskOlumiStore.setState({ isOpen: false, context: '', draft: '', label: '', targetId: null, parameters: undefined, source: 'chip' })
  useGuidanceStore.setState({ _sendMessage: null, _prefillChat: null, _dispatchAction: null })
})

describe('frontier doors with no composer registered: the Ask drawer is the confirm surface', () => {
  it.each([
    ['option ghost', 'send channel only'],
    ['option ghost', 'dispatch + send channels'],
    ['row-end tier', 'send channel only'],
    ['row-end tier', 'dispatch + send channels'],
  ] as Array<[Door, Channel]>)(
    '%s door, %s: the click opens the drawer holding EXACTLY the prompt and sends nothing; one Send sends it once; a second ask works',
    (doorName, channel) => {
      const door = DOORS[doorName]
      const c = channels(channel)
      render(
        <ReactFlowProvider>
          {door.mount()}
          <AskOlumiDrawer />
        </ReactFlowProvider>,
      )
      expect(drawer(), 'PRECONDITION: the drawer is closed').toBeNull()

      // ── Activation: the question is in front of the person; nothing is sent.
      act(() => { door.activate() })
      expect(c.allSends(), 'zero sends on activation').toEqual([])
      expect(drawer()).not.toBeNull()
      expect(useAskOlumiStore.getState().draft).toBe(door.prompt)
      expect(draftBox().value).toBe(door.prompt)
      expect(draftBox().readOnly).toBe(false)
      expect(draftBox().disabled).toBe(false)
      expect(document.activeElement, 'the drawer puts the person in the question').toBe(draftBox())
      expect(sendButton().disabled).toBe(false)

      // ── The person's own Send: exactly one send, carrying exactly the prompt.
      act(() => { fireEvent.click(sendButton()) })
      expect(c.allSends()).toEqual([door.prompt])
      if (channel === 'dispatch + send channels') {
        // The drawer prefers the typed turn; the bare channel stays silent.
        expect(c.sent).toEqual([])
        expect(c.dispatched).toHaveLength(1)
        expect(c.dispatched[0]).toMatchObject({ action_type: 'discuss', label: door.prompt, message: door.prompt, source: 'ghost-door' })
      } else {
        expect(c.sent).toEqual([door.prompt])
      }
      expect(drawer(), 'Send closes the drawer').toBeNull()

      // ── A second ask: the drawer comes back with the prompt, still unsent,
      // and the person's EDIT is what goes out.
      act(() => { door.activate() })
      expect(drawer()).not.toBeNull()
      expect(draftBox().value).toBe(door.prompt)
      expect(c.allSends(), 'the second activation sends nothing either').toEqual([door.prompt])
      act(() => { fireEvent.change(draftBox(), { target: { value: EDITED } }) })
      expect(useAskOlumiStore.getState().draft).toBe(EDITED)
      act(() => { fireEvent.click(sendButton()) })
      expect(c.allSends()).toEqual([door.prompt, EDITED])
    },
  )
})
