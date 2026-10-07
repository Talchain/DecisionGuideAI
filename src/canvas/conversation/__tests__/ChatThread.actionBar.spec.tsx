/**
 * S-B slice 1 — CEE's action bar in chat: under the LATEST reply, once, and a
 * suggested action that is already a press on the bar is not drawn a second time.
 * The bar is one CEE captured from its routes (`actionBar/__tests__/fixtures`).
 */
import '@testing-library/jest-dom/vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { ChatThread } from '../zones/ChatThread'
import { parseActionBar, type ActionBarV1 } from '../actionBar/actionBarContract'
import { useActionBarStore } from '../actionBar/actionBarStore'
import { resetPressOfferClocks } from '../actionBar/pressOffer'
import type { ActionChip, ConversationMessage } from '../types'

const SCENARIO = 'scn-chat-bar'
const dispatch = vi.hoisted(() => vi.fn())

vi.mock('../../store', () => {
  const state = { nodes: [], edges: [], currentScenarioId: 'scn-chat-bar' }
  return { useCanvasStore: Object.assign((selector: (s: typeof state) => unknown) => selector(state), { getState: () => state, setState: vi.fn(), subscribe: vi.fn() }) }
})
vi.mock('../../../stores/uiStore', () => ({
  useUIStore: Object.assign((selector: (s: object) => unknown) => selector({}), { getState: () => ({ setActiveOutputTab: vi.fn() }), setState: vi.fn() }),
}))
vi.mock('../../stores/guidanceStore', () => {
  const state = { guidanceItems: [], _dispatchAction: dispatch, _isConversationBusy: () => false, dismissItem: vi.fn() }
  return { useGuidanceStore: Object.assign((selector: (s: typeof state) => unknown) => selector(state), { getState: () => state }) }
})
vi.mock('../revealOlumi', () => ({ revealOlumiSurface: vi.fn() }))

const BAR: ActionBarV1 = parseActionBar(JSON.parse(readFileSync(join(__dirname, '../actionBar/__tests__/fixtures/action-bar-v1-withheld-run.json'), 'utf8')))!
const ON_BAR: ActionChip = { id: 'agent-next-review-decision', label: 'Review this decision', intent: 'secondary', message: 'Review this decision' }
const NOT_ON_BAR: ActionChip = { id: 'agent-approve-proposal:gmh_0123456789ab', label: 'Approve 2 changes', intent: 'primary', message: 'Approve' }

let seq = 0
const msg = (overrides: Partial<ConversationMessage>): ConversationMessage =>
  ({ id: `m-${(seq += 1)}`, role: 'assistant', content: 'A reply.', timestamp: new Date(), ...overrides }) as ConversationMessage

const renderThread = (messages: ConversationMessage[]) =>
  render(
    <ChatThread
      messages={messages}
      isThinking={false}
      longRunningHint={null}
      nodeCount={3}
      patchBlockStates={new Map()}
      patchRejections={new Map()}
      onChipClick={vi.fn().mockResolvedValue(undefined)}
      onPatchAccept={vi.fn()}
      onPatchDismiss={vi.fn()}
      onFeedback={vi.fn()}
      onRetry={vi.fn()}
    />,
  )

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
  dispatch.mockClear()
  resetPressOfferClocks()
  useActionBarStore.setState({ bar: null, scenarioId: null, dismissed: [] })
})

describe('the action bar in chat', () => {
  it('PRECONDITION: the captured bar holds the press the first chip repeats, and not the second', () => {
    const onBar = [...BAR.priority, ...BAR.standard, ...BAR.more].map((o) => o.press_id)
    expect(onBar).toContain(ON_BAR.id)
    expect(onBar).not.toContain(NOT_ON_BAR.id)
  })

  it('⛔ CONTRAST (no bar on the answer): both chips are drawn and there is no bar', () => {
    renderThread([msg({ role: 'user', content: 'q' }), msg({ actionChips: [ON_BAR, NOT_ON_BAR] })])
    expect(screen.getByTestId(`suggested-chip-${ON_BAR.id}`)).toBeInTheDocument()
    expect(screen.getByTestId(`suggested-chip-${NOT_ON_BAR.id}`)).toBeInTheDocument()
    expect(screen.queryByTestId('chat-action-bar')).toBeNull()
  })

  it('with a bar: it sits under the reply, the chip already on it is not drawn twice, and the approval stays a chip', () => {
    useActionBarStore.getState().setBar(SCENARIO, BAR)
    renderThread([msg({ role: 'user', content: 'q' }), msg({ actionChips: [ON_BAR, NOT_ON_BAR] })])
    expect(screen.getByTestId('chat-action-bar')).toHaveAttribute('data-surface', 'chat')
    expect(screen.queryByTestId(`suggested-chip-${ON_BAR.id}`)).toBeNull()
    expect(screen.getByTestId(`suggested-chip-${NOT_ON_BAR.id}`)).toBeInTheDocument()
    expect(screen.getByTestId('chat-action-bar-icon-review')).toBeInTheDocument()
  })

  it('a reply with no chips of its own still gets the bar, and a press on it sends CEE’s press id', () => {
    useActionBarStore.getState().setBar(SCENARIO, BAR)
    renderThread([msg({ role: 'user', content: 'q' }), msg({})])
    fireEvent.click(screen.getByTestId('chat-action-bar-icon-review'))
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      id: 'agent-next-review-decision', source: 'chip', parameters: { offer_key: BAR.standard[0]!.offer_key, revision: BAR.revision },
    }))
  })

  it('only the LATEST reply carries the bar', () => {
    useActionBarStore.getState().setBar(SCENARIO, BAR)
    renderThread([msg({ role: 'user', content: 'q1' }), msg({ content: 'First reply.' }), msg({ role: 'user', content: 'q2' }), msg({ content: 'Second reply.' })])
    expect(screen.getAllByTestId('chat-action-bar')).toHaveLength(1)
  })

  it('a bar that belongs to another scenario is not drawn here', () => {
    useActionBarStore.getState().setBar('another-scenario', BAR)
    renderThread([msg({ role: 'user', content: 'q' }), msg({ actionChips: [ON_BAR] })])
    expect(screen.queryByTestId('chat-action-bar')).toBeNull()
    expect(screen.getByTestId(`suggested-chip-${ON_BAR.id}`)).toBeInTheDocument()
  })
})
