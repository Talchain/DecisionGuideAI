/**
 * ⭐ Run-3 judge U2 (live/runs/2026-10-12T153555Z; UI a9a5c26f, CEE 3fdf0f38), DL ruling (b): CEE prefixes the same status
 * headline and bullets to every reply in one model state, and the thread drew them on every reply ("Not shown: some
 * relationships aren't sized yet" / "Olumi's estimates: 11, see Check estimates." on hiring steps 3, 3 and 7). They are
 * drawn ONCE per state; a reply in a NEW state always shows them again.
 *
 * The fixture is the three served replies (hiring turns 03, 04 and 07, answer shape and state only): 03 and 04 share
 * one state (graph 115f6121…, run 15:37:51Z); 07 is a new one (graph 9673b6fc…, run 15:40:48Z) with the same status.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import served from './fixtures/run3-hiring-status-turns.json'
import { ChatThread } from '../zones/ChatThread'
import { parseAnswerShape, answerStateKeyOf } from '../answerShape'
import { saveTranscript, loadTranscript, clearAllTranscripts } from '../utils/transcriptStore'
import type { ConversationMessage } from '../types'

vi.mock('../../store', () => ({
  useCanvasStore: Object.assign(
    (selector: (s: any) => any) => selector({ nodes: [], edges: [] }),
    { getState: () => ({ nodes: [], edges: [] }), setState: vi.fn(), subscribe: vi.fn() },
  ),
}))

vi.mock('../../../stores/uiStore', () => ({
  useUIStore: Object.assign(
    (selector: (s: any) => any) => selector({}),
    { getState: () => ({ setActiveOutputTab: vi.fn() }), setState: vi.fn() },
  ),
}))

vi.mock('../../stores/guidanceStore', () => ({
  useGuidanceStore: Object.assign(
    (selector: (s: any) => any) => selector({ guidanceItems: [], _dispatchAction: vi.fn() }),
    { getState: () => ({ guidanceItems: [], _dispatchAction: vi.fn(), dismissItem: vi.fn() }) },
  ),
}))

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
  clearAllTranscripts()
})

type Turn = (typeof served.turns)[number]
const [T03, T04, T07] = served.turns as Turn[]
const STATUS = T03._answer_shape.headline
const ESTIMATES = T03._answer_shape.bullets[0]

function reply(t: Turn, id: string, withState = true): ConversationMessage {
  const answerStateKey = answerStateKeyOf(t)
  return {
    id, role: 'assistant', content: t.assistant_text, timestamp: new Date(),
    answerShape: parseAnswerShape(t._answer_shape)!,
    ...(withState && answerStateKey ? { answerStateKey } : {}),
  } as ConversationMessage
}
const ask = (id: string, content: string) => ({ id, role: 'user', content, timestamp: new Date() }) as ConversationMessage

function renderThread(messages: ConversationMessage[]) {
  render(
    <ChatThread
      messages={messages}
      isThinking={false}
      longRunningHint={null}
      nodeCount={1}
      patchBlockStates={new Map()}
      patchRejections={new Map()}
      onChipClick={vi.fn().mockResolvedValue(undefined)}
      onPatchAccept={vi.fn()}
      onPatchDismiss={vi.fn()}
      onFeedback={vi.fn()}
      onRetry={vi.fn()}
    />,
  )
  return screen.getAllByTestId('message-answer-structured').map(bubble => ({
    headline: within(bubble).queryByTestId('answer-headline')?.textContent ?? null,
    bullets: within(bubble).queryAllByRole('listitem').map(li => li.textContent),
  }))
}

const THREAD = (withState = true) => [
  ask('u1', 'Run it'), reply(T03, 'a03', withState),
  ask('u2', 'What should I check?'), reply(T04, 'a04', withState),
  ask('u3', 'Run again'), reply(T07, 'a07', withState),
]

describe('U2: CEE\'s repeated status is drawn once per model state', () => {
  it('CONTROL: 03 and 04 share one state, 07 is a new one, and all three open with the same status', () => {
    expect(answerStateKeyOf(T03)).toBe(answerStateKeyOf(T04))
    expect(answerStateKeyOf(T07)).not.toBe(answerStateKeyOf(T03))
    expect([T03, T04, T07].map(t => t._answer_shape.headline)).toEqual([STATUS, STATUS, STATUS])
    expect([T03, T04, T07].map(t => t._answer_shape.bullets[0])).toEqual([ESTIMATES, ESTIMATES, ESTIMATES])
  })

  it('a new run on the same graph is a new state (hiring turns 06 → 07 kept graph 9673b6fc…), and no graph hash is no state', () => {
    const at = (graph_hash: string | undefined, computed_at?: string) => ({ graph_hash, analysis_state: computed_at ? { run_state: { computed_at } } : null })
    expect(answerStateKeyOf(at('9673b6fc2adfbee3', '2026-10-12T15:37:51.321Z'))).not.toBe(answerStateKeyOf(at('9673b6fc2adfbee3', '2026-10-12T15:40:48.373Z')))
    expect(answerStateKeyOf(at('9673b6fc2adfbee3'))).toBe('9673b6fc2adfbee3|no-run')
    expect(answerStateKeyOf(at(undefined, '2026-10-12T15:40:48.373Z'))).toBeNull()
  })

  it('⭐ the second reply in a state does not draw the status again; its own new line stays', () => {
    const [r03, r04] = renderThread(THREAD())
    expect(r03).toEqual({ headline: STATUS, bullets: [ESTIMATES] })
    expect(r04).toEqual({ headline: null, bullets: [T04._answer_shape.bullets[1]] })
  })

  it('⭐ a reply in a NEW state always draws the status again', () => {
    const r07 = renderThread(THREAD())[2]
    expect(r07).toEqual({ headline: STATUS, bullets: [ESTIMATES] })
  })

  it('CONTRAST: replies with no state (a transcript saved before states were kept) fold nothing', () => {
    const shown = renderThread(THREAD(false))
    expect(shown.map(r => r.headline)).toEqual([STATUS, STATUS, STATUS])
  })

  it('the state survives a reload of the transcript, so a reopened thread folds the same way', () => {
    saveTranscript('scenario-u2', THREAD())
    const restored = loadTranscript('scenario-u2')!.messages as ConversationMessage[]
    expect(restored.filter(m => m.role === 'assistant').map(m => m.answerStateKey)).toEqual(
      [T03, T04, T07].map(t => answerStateKeyOf(t)),
    )
    const shown = renderThread(restored)
    expect(shown.map(r => r.headline)).toEqual([STATUS, null, STATUS])
  })
})
