/**
 * ⭐ PAUL'S FIRST SCREEN, ABOVE THE TEXT BOX (27 Oct, a program board). Three rows:
 *   4. "To work out the chance, Olumi needs:": every node or link of the saved model with `user_questions`, in graph
 *      order, the first 3 and "N more". A press puts the question into the composer as context and focuses it. The list
 *      follows the saved model, so an answered figure drops out on its own.
 *   5. Up to 3 coaching questions, from the decision node's `coaching_questions`; none when absent or empty. A press puts
 *      the question into the composer as a prompt. Kept apart from the figures list.
 *   6. The placeholder while either list shows: "Answer a question above, or tell me what I got wrong"; otherwise the
 *      stage placeholder as before.
 *
 * Real path: the real `AIInputBar` (the floating panel's composer) in the real `ConversationProvider` (only the network
 * hook it wraps is mocked), reading the real saved-graph read with only `fetch` stubbed: the served European read
 * (`served-acceptance-european-read-20261026.json`, 4 asked figures; its `_source` names the run). CEE is adding
 * `coaching_questions` now, so the coaching rows put a SYNTHETIC list on that read's decision node, named in each row.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('../../../lib/supabase', () => ({ getUserId: async () => null, getSessionIdentity: async () => ({ userId: null, accessToken: null }) }))
vi.mock('../../conversation/useConversation', () => ({
  useConversation: () => ({
    messages: [], isThinking: false, longRunningHint: null, lastSendFailure: null,
    sendMessage: vi.fn(), sendSystemEvent: vi.fn(), sendChip: vi.fn(), dispatchAction: vi.fn(), clearHistory: vi.fn(),
    retryLast: vi.fn(), cancelTurn: vi.fn(), patchBlockStates: new Map(), setPatchBlockState: vi.fn(),
    patchRejections: new Map(), setPatchRejection: vi.fn(),
  }),
}))
const STAGE_PLACEHOLDER = 'Ask about this model…'
vi.mock('../../hooks/useStageAwarePlaceholder', () => ({ useStageAwarePlaceholder: () => STAGE_PLACEHOLDER }))

import { AIInputBar } from '../AIInputBar'
import { ConversationProvider } from '../../conversation/ConversationContext'
import { useCanvasStore } from '../../store'
import { bumpSavedGraphEpoch } from '../../nodes/shared/savedGraphEpoch'
import europeanRead from '../../nodes/__tests__/fixtures/served-acceptance-european-read-20261026.json'

type Json = Record<string, any>
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T
const BASE = 'ai-input-bar-floating'
/** The four asked figures of the served read, in its graph order, each in CEE's words. */
const ASKED = [
  'By when do you want to reach 800 customers?',
  'How many new customers joined last month, before subtracting customers who left?',
  'How much would the proposed European expansion cost, including setup and regulatory compliance?',
  'What would the limited European pilot cost in total, including setup and regulatory compliance?',
]

let read: Json = europeanRead as Json
let n = 0
/** The saved model on screen: `graph` (default: the served read's), as a program board unless `program` is false. */
function board(graph: Json = clone(europeanRead.graph as Json), program = true) {
  n += 1
  read = { ...europeanRead, graph_hash: `${'35bd2bd1f79'}${String(n).padStart(5, '0')}`,
    graph: program ? graph : { ...graph, living_model: { aims: [], links: [], factors: [], options: [] } } }
  useCanvasStore.setState({ currentScenarioId: europeanRead.scenario_id, lastServerGraphHash: read.graph_hash } as never)
}
const decisionWith = (coaching: unknown): Json => {
  const graph = clone(europeanRead.graph as Json)
  graph.nodes.find((nd: Json) => nd.id === 'mp:decision').coaching_questions = coaching
  return graph
}
async function mount() {
  render(<ConversationProvider><AIInputBar variant="floating" hideChevron /></ConversationProvider>)
  await act(async () => { await new Promise((r) => setTimeout(r, 30)) })
}
const textarea = () => screen.getByTestId(`${BASE}-textarea`) as HTMLTextAreaElement
const figures = () => screen.queryAllByTestId(`${BASE}-figure`).map((b) => b.textContent)
const coaching = () => screen.queryAllByTestId(`${BASE}-coaching-question`).map((b) => b.textContent)
const nextFrame = () => act(async () => { await new Promise((r) => requestAnimationFrame(() => r(null))) })

beforeEach(() => {
  window.history.replaceState(null, '', '/?ai=core-route')
  vi.stubGlobal('fetch', vi.fn(async (url: string) => (
    /\/scenarios\/[^/]+\/graph$/.test(String(url))
      ? new Response(JSON.stringify(read), { status: 200, headers: { 'Content-Type': 'application/json' } })
      : new Response('{}', { status: 404 })
  )))
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.history.replaceState(null, '', '/') })

describe('4. the figures Olumi needs', () => {
  it('the served read’s asked figures in graph order, the first 3 and "1 more"; a press puts the question in the box, focused; an answered one drops out', async () => {
    board()
    expect((europeanRead.graph as Json).nodes.filter((nd: Json) => nd.user_questions).map((nd: Json) => nd.id))
      .toEqual(['target_deadline', 'baseline_acquisitions', 'planned_investment', 'pilot_total_investment'])
    await mount()
    expect(screen.getByTestId(`${BASE}-figures`).querySelector('p')?.textContent).toBe('To work out the chance, Olumi needs:')
    expect(figures()).toEqual(ASKED.slice(0, 3))
    fireEvent.click(screen.getByTestId(`${BASE}-figures-more`))
    expect(screen.queryByTestId(`${BASE}-figures-more`)).toBeNull()
    expect(figures()).toEqual(ASKED)
    // The question goes in as context, the caret after it, for the person to type the answer and send it.
    fireEvent.click(screen.getAllByTestId(`${BASE}-figure`)[1]!)
    await nextFrame()
    expect(textarea().value).toBe(`${ASKED[1]} `)
    expect(document.activeElement).toBe(textarea())
    expect(textarea().selectionStart).toBe(ASKED[1]!.length + 1)
    cleanup()
    // The next saved model, after the deadline is answered: CEE sends that card with no `user_questions` (synthetic: the
    // served read with the key removed), and the list follows it.
    const answered = clone(europeanRead.graph as Json)
    delete answered.nodes.find((nd: Json) => nd.id === 'target_deadline').user_questions
    board(answered)
    bumpSavedGraphEpoch()
    await mount()
    expect(figures()).toEqual(ASKED.slice(1))
    expect(screen.queryByTestId(`${BASE}-figures-more`)).toBeNull()
  })

  it('CONTRAST: the same graph on a board that is not a program board shows no list', async () => {
    board(clone(europeanRead.graph as Json), false)
    await mount()
    expect(screen.queryByTestId(`${BASE}-asks`)).toBeNull()
  })
})

describe('5. up to 3 coaching questions', () => {
  it('the decision node’s first 3 (SYNTHETIC: 4 on the served read’s decision node), apart from the figures; a press puts it in the box', async () => {
    const asked = ['What would make the pilot a clear success?', 'Who would argue against expanding now, and why?',
      'What happens to churn if the launch slips?', 'A fourth question is never shown.']
    board(decisionWith(asked))
    await mount()
    expect(coaching()).toEqual(asked.slice(0, 3))
    // Two lists: the coaching row is not inside the figures list.
    expect(screen.getByTestId(`${BASE}-figures`).contains(screen.getByTestId(`${BASE}-coaching`))).toBe(false)
    fireEvent.click(screen.getAllByTestId(`${BASE}-coaching-question`)[2]!)
    await nextFrame()
    expect(textarea().value).toBe(asked[2])
    expect(document.activeElement).toBe(textarea())
  })

  it('CONTRAST: absent or empty, there is no coaching row; the figures stay', async () => {
    for (const coachingQuestions of [undefined, []]) {
      board(decisionWith(coachingQuestions))
      await mount()
      expect(screen.queryByTestId(`${BASE}-coaching`)).toBeNull()
      expect(figures()).toEqual(ASKED.slice(0, 3))
      cleanup()
    }
  })
})

describe('6. the placeholder', () => {
  it('while a list shows it points at the questions; with nothing asked (and no coaching), and off a program board, it is the stage placeholder', async () => {
    board()
    await mount()
    expect(textarea().placeholder).toBe('Answer a question above, or tell me what I got wrong')
    cleanup()
    // Coaching alone is a list too (SYNTHETIC: the served read with nothing asked and one coaching question).
    const coachingOnly = decisionWith(['Who would argue against expanding now?'])
    for (const nd of coachingOnly.nodes) delete nd.user_questions
    board(coachingOnly)
    await mount()
    expect(textarea().placeholder).toBe('Answer a question above, or tell me what I got wrong')
    cleanup()
    const nothingAsked = clone(europeanRead.graph as Json)
    for (const nd of nothingAsked.nodes) delete nd.user_questions
    board(nothingAsked)
    await mount()
    expect(screen.queryByTestId(`${BASE}-asks`)).toBeNull()
    expect(textarea().placeholder).toBe(STAGE_PLACEHOLDER)
    cleanup()
    board(clone(europeanRead.graph as Json), false)
    await mount()
    expect(textarea().placeholder).toBe(STAGE_PLACEHOLDER)
  })
})
