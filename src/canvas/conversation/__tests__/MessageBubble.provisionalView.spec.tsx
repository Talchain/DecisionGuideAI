/**
 * ⭐ SLICE C5 (Paul's ruling 5855324470, "Yes, labelled provisional"): when the analysis cannot put an option
 * forward, Olumi's PROVISIONAL view is on the face of the reply, labelled, with the one step that would confirm it.
 *
 * The defect this pins before it can ship (code-read at CEE 339ed343, #70 5855541127): the Agent route shapes an
 * analysis reply AFTER its post-gate appends, so a view appended at the end lands in `_answer_shape.detail`, and
 * with a shape the chat renders only headline, bullets and detail. The view would sit behind "Show more".
 * THIN UI (ChatGPT 5855577789 rule 1): the chat renders the TYPED `_agent.provisional_view` verbatim and never
 * parses or edits the producer's prose; keeping the view out of the prose is the producer's contract (5855633777).
 *
 * Base body: a SERVED withheld Run (#2175's fixture: DL run bf-20260927T101447Z turns.jsonl[8], analysis_result +
 * coaching + _answer_shape). The `_agent.provisional_view` sidecar and its prose copy are written from Runtime's
 * declared field names (5855331903), because the producer is not served yet. ⚠ A self-authored fixture for the
 * new field: re-bind it to served bytes when C5 serves.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'

vi.mock('../../../lib/supabase', () => ({
  supabase: {},
  getUserId: async () => null,
  getSessionIdentity: async () => ({ userId: null, accessToken: null }),
}))
vi.mock('../../../services/scenarioService', () => ({
  loadScenario: async () => null,
  storeAnalysis: async () => undefined,
}))
vi.mock('../../../lib/posthog', () => ({ trackEvent: () => undefined }))

import { parseV5Response } from '../../../v5/responseParser'
import { routeV5Response } from '../../../v5/responseRouter'
import { mapV5Blocks } from '../../../v5/blocks/mapV5Blocks'
import { extractPhase3FromV5Response, deriveV5AnalysisFactUpdate } from '../../../v5/extractPhase3FromV5Response'
import { buildSuggestedActionChips } from '../../../v5/blocks/suggestedActionChips'
import { composePhase3BridgedBlocks } from '../useConversation'
import { extractAnswerShapeSidecar } from '../answerShape'
import { extractOpenQuestionListSidecar } from '../serverOpenQuestions'
import { extractProvisionalViewSidecar } from '../provisionalView'
import { saveTranscript, loadTranscript, __resetTranscriptTombstonesForTests } from '../utils/transcriptStore'
import { ChatThread } from '../zones/ChatThread'
import type { ConversationMessage } from '../types'

import served from './fixtures/chat-served-turns.bf-20260927.json'

type Wire = Record<string, unknown>

const VIEW = 'I would hold the Pro price at £49 for now and test £59 on new customers only.'
const REASONING = 'Churn is already near your 10% limit, and a rise for existing customers is the move most likely to push it over.'
const STEP = 'Give me your real monthly churn figure, so the analysis can check the limit against it.'
const HEADING = 'Provisional view — the analysis can’t confirm this yet because your churn limit is checked against Olumi’s estimate, not your figure.'
/** A prose copy, as Runtime's first plan appended it (5855331903): one bold-led paragraph after the gate. */
const PROSE = `**${HEADING}** ${VIEW} ${STEP}`

const servedRun = (): Wire => {
  const t = (served as Array<{ source: string; body: Wire }>)[3]!
  expect(t.source).toContain('bf-20260927T101447Z turns.jsonl[8]')
  return JSON.parse(JSON.stringify(t.body)) as Wire
}

/** The served Run with the C5 sidecar; optionally a prose copy appended where the shaper puts it (detail). */
function withProvisional(body: Wire, opts: { shaped: boolean; sidecar?: boolean; prose?: boolean; heading?: boolean }): Wire {
  const b = JSON.parse(JSON.stringify(body)) as Wire
  const shape = b._answer_shape as { detail?: string } | undefined
  if (opts.prose) {
    b.assistant_text = `${String(b.assistant_text)}\n\n${PROSE}`
    if (shape) shape.detail = `${shape.detail ?? ''}\n\n${PROSE}`.trim()
  }
  if (opts.shaped) expect(shape, 'the served Run carries an answer shape').toBeTruthy()
  else delete b._answer_shape
  if (opts.sidecar !== false) {
    b._agent = {
      ...(b._agent as Wire | undefined),
      provisional_view: { view: VIEW, reasoning: REASONING, confirm_step: STEP, ...(opts.heading === false ? {} : { heading: HEADING }) },
    }
  }
  return b
}

/** The shipped chain, then the message exactly as `useConversation` builds it. */
async function messageFrom(body: Wire): Promise<ConversationMessage> {
  const res = new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
  const target = routeV5Response(await parseV5Response(res))
  if (target.kind !== 'blocks' && target.kind !== 'text_only') throw new Error(target.kind)
  const response = target.response
  const mapped = target.kind === 'blocks' ? mapV5Blocks(response.blocks, response.suggested_actions) : []
  const phase3 = extractPhase3FromV5Response(response)
  const fact = deriveV5AnalysisFactUpdate(response, phase3)
  const blocks = composePhase3BridgedBlocks(fact.action === 'set', phase3.rawBlocks, mapped)
  const actionChips = buildSuggestedActionChips(response.blocks, response.suggested_actions)
  const answerShape = extractAnswerShapeSidecar(response)
  const openQuestionList = extractOpenQuestionListSidecar(response)
  const provisionalView = extractProvisionalViewSidecar(response)
  return {
    id: 'a1',
    role: 'assistant',
    content: response.assistant_text,
    blocks,
    ...(actionChips.length > 0 ? { actionChips } : {}),
    ...(answerShape ? { answerShape } : {}),
    ...(openQuestionList ? { openQuestionList } : {}),
    ...(provisionalView ? { provisionalView } : {}),
    timestamp: new Date('2026-09-27T10:14:47Z'),
  } as ConversationMessage
}

function renderThread(assistant: ConversationMessage) {
  const messages = [{ id: 'u1', role: 'user', content: 'Run the analysis', timestamp: new Date('2026-09-27T10:14:40Z') }, assistant] as ConversationMessage[]
  return render(
    <ChatThread
      {...({
        messages, isThinking: false, longRunningHint: null, nodeCount: 12, patchBlockStates: new Map(), patchRejections: new Map(),
        onChipClick: vi.fn(async () => {}), onPatchAccept: () => {}, onPatchDismiss: () => {}, onFeedback: () => {}, onRetry: () => {}, compact: true,
      } as unknown as React.ComponentProps<typeof ChatThread>)}
    />,
  )
}

const flat = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim()
const count = (hay: string, needle: string) => hay.split(needle).length - 1

beforeEach(() => { Element.prototype.scrollIntoView = vi.fn() })
afterEach(() => cleanup())

describe('C5: the provisional view is on the face of the reply, labelled, said once', () => {
  it('RED: a SHAPED withheld Run shows the view AT REST (never behind "Show more"), labelled, with its step', async () => {
    renderThread(await messageFrom(withProvisional(servedRun(), { shaped: true })))
    expect(screen.getByTestId('message-answer-structured'), 'the served Run renders as a structured answer').toBeTruthy()
    const block = screen.getByTestId('message-provisional-view')
    expect(flat(within(block).getByTestId('message-provisional-view-heading').textContent), 'the producer\'s sentence, verbatim').toBe(HEADING)
    expect(screen.queryByTestId('answer-detail'), 'at rest, the detail is closed: the view does not depend on it').toBeNull()
    expect(flat(within(block).getByTestId('message-provisional-view-text').textContent)).toBe(VIEW)
    expect(flat(within(block).getByTestId('message-provisional-view-step').textContent)).toBe(`To confirm it: ${STEP}`)
    expect(block.getAttribute('role')).toBe('note')
  })

  it('THIN UI: the producer\'s prose is never parsed or edited: body and detail are byte-identical with and without the sidecar', async () => {
    const withSide = await messageFrom(withProvisional(servedRun(), { shaped: true, prose: true }))
    const without = await messageFrom(withProvisional(servedRun(), { shaped: true, prose: true, sidecar: false }))
    const open = () => { fireEvent.click(screen.getByTestId('answer-show-more')); return screen.getByTestId('answer-body').innerHTML }
    renderThread(withSide)
    const a = open()
    cleanup()
    renderThread(without)
    const b = open()
    expect(a).toBe(b)
  })

  it('RED: the why is one press away, never at rest', async () => {
    renderThread(await messageFrom(withProvisional(servedRun(), { shaped: true })))
    expect(screen.queryByTestId('message-provisional-view-why')).toBeNull()
    fireEvent.click(screen.getByTestId('message-provisional-view-why-toggle'))
    expect(flat(screen.getByTestId('message-provisional-view-why').textContent)).toBe(REASONING)
  })

  it('RED: a FREE-TEXT reply (no shape) carries the same block; with the producer keeping the view out of its prose, it is said once', async () => {
    renderThread(await messageFrom(withProvisional(servedRun(), { shaped: false })))
    expect(screen.queryByTestId('message-answer-structured')).toBeNull()
    expect(screen.getByTestId('message-provisional-view')).toBeTruthy()
    expect(count(flat(screen.getByTestId('chat-thread').textContent), VIEW)).toBe(1)
  })

  it('no `heading` from the producer → the fixed label alone; the UI writes no reason of its own', async () => {
    renderThread(await messageFrom(withProvisional(servedRun(), { shaped: true, heading: false })))
    expect(flat(screen.getByTestId('message-provisional-view-heading').textContent)).toBe('Provisional view')
  })

  it('never inside the analysis card or its leader line: the block is the bubble\'s, not the result\'s', async () => {
    renderThread(await messageFrom(withProvisional(servedRun(), { shaped: true })))
    const block = screen.getByTestId('message-provisional-view')
    for (const card of screen.queryAllByTestId(/analysis-result|v5-analysis/)) expect(card.contains(block)).toBe(false)
  })

  it('CONTROL: no sidecar → no block (even when the prose mentions a provisional view)', async () => {
    renderThread(await messageFrom(withProvisional(servedRun(), { shaped: false, sidecar: false, prose: true })))
    expect(screen.queryByTestId('message-provisional-view')).toBeNull()
    expect(flat(screen.getByTestId('chat-thread').textContent)).toContain(VIEW)
  })

  it('never mid-stream (Panel\'s N2 on #2185): a streaming reply carrying the view shows no block until it settles', async () => {
    const msg = await messageFrom(withProvisional(servedRun(), { shaped: false }))
    renderThread({ ...msg, isStreaming: true } as ConversationMessage)
    expect(screen.queryByTestId('message-provisional-view')).toBeNull()
  })

  it('the reader takes the wire\'s one spelling (`confirm_step`), never an alias (Panel\'s N3)', () => {
    const wire = (pv: unknown) => ({ assistant_text: 'x', __additive__: { _agent: { provisional_view: pv } } })
    expect(extractProvisionalViewSidecar(wire({ view: 'v', confirmStep: 's' }))).toEqual({ view: 'v' })
  })

  it('the reader: a sidecar with no `view` is dropped, never repaired', () => {
    const wire = (pv: unknown) => ({ assistant_text: 'x', __additive__: { _agent: { provisional_view: pv } } })
    expect(extractProvisionalViewSidecar(wire({ reasoning: 'r', confirm_step: 's' }))).toBeUndefined()
    expect(extractProvisionalViewSidecar(wire({ view: '  ' }))).toBeUndefined()
    expect(extractProvisionalViewSidecar(wire({ view: 'v', confirm_step: 's' }))).toEqual({ view: 'v', confirmStep: 's' })
  })

  it('a reload keeps it: the transcript stores the view and restores it through the same reader', async () => {
    __resetTranscriptTombstonesForTests()
    localStorage.clear()
    const msg = await messageFrom(withProvisional(servedRun(), { shaped: true }))
    saveTranscript('scn-c5', [{ id: 'u1', role: 'user', content: 'Run', timestamp: new Date() } as ConversationMessage, msg])
    const restored = loadTranscript('scn-c5')?.messages.find((m) => m.id === 'a1')
    expect(restored?.provisionalView).toEqual({ view: VIEW, reasoning: REASONING, confirmStep: STEP, heading: HEADING })
  })
})
