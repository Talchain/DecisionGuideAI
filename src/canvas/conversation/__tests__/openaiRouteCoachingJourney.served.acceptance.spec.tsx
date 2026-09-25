/**
 * ⭐ THE OPENAI RUN TURN, AS SERVED — real route bodies through the shipped
 * chain, end to end (Paul's goal, 25 Sep: "verify the rendered reply against
 * the actual OpenAI route, not only authored fixtures").
 *
 * THE BYTES: two signed-in journeys, same six steps, each sent through
 * `/proxy/v5/turn` with `x-olumi-ai-mode: openai`:
 *   · `fixtures/openai-route-coaching-journey.c673223.json` — served CEE
 *     `c673223d` (#1854), first pass `analysis_ready.status: needs_user_input`;
 *   · `fixtures/openai-route-coaching-journey.e39f6e0.json` — served CEE
 *     `e39f6e09` (#1854 + #1866 copy v2), first pass `ready`.
 * Each file's `__provenance` is authoritative: an OpenAI-only provider ledger
 * on every turn, UUIDs redacted consistently, nothing else changed. NOT
 * authored here.
 *
 * THE CHAIN: the REAL `useConversation` hook drives the REAL `ConversationPanel`
 * (which registers the chip seam with `guidanceStore`), so a card click goes
 * `ActionChip` → guidanceStore `_sendChip` → the panel's glue → the hook →
 * `fetch`, exactly as shipped. Only `fetch` is stubbed: it returns the served
 * body for each turn, in order, and records what the UI sent.
 *
 * WHAT THE USER MUST GET, per the goal and `run-turn-coaching/v1`:
 *   · the reply leads with its conclusion (the wire's first sentence, first);
 *   · a completed Run shows ONE real next action — its own card, on the face of
 *     the reply, live — while every earlier card is inert with the sentence
 *     for the limb it failed;
 *   · the card's detail ("Why this, and how sure") is on demand, closed at rest;
 *   · the click sends the producer's prompt verbatim, once, as an ordinary
 *     OpenAI message — never a typed Run or approval.
 *
 * Every card is bound by the served `block_id`, never by a value predicate.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, act, fireEvent, waitFor } from '@testing-library/react'

import servedBeforeCopyV2 from './fixtures/openai-route-coaching-journey.c673223.json'
import servedCopyV2 from './fixtures/openai-route-coaching-journey.e39f6e0.json'
import { useConversation, type UseConversationReturn } from '../useConversation'
import { ConversationPanel } from '../ConversationPanel'
import { ToastProvider } from '../../ToastContext'
import { useCanvasStore } from '../../store'
import { useGuidanceStore } from '../../stores/guidanceStore'
import { RUN_TURN_NOTICE } from '../../../v5/blocks/coachingCurrency'

vi.mock('../turnService', () => ({
  callOrchestratorTurn: vi.fn(),
  streamOrchestratorTurn: vi.fn(),
  OrchestratorError: class OrchestratorError extends Error {},
}))
// The streamed draft sibling is unreachable, so each turn is ONE buffered
// request (the state of a deployment without the stream route).
vi.mock('../../../v5/streamedTurnTransport', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../v5/streamedTurnTransport')>()
  return { ...actual, openV5TurnStream: async () => { throw new TypeError('Failed to fetch') } }
})
vi.mock('../../../lib/supabase', () => ({
  getUserId: async () => null,
  getSessionIdentity: async () => ({ userId: null, accessToken: null }),
}))
vi.mock('../../../services/scenarioService', () => ({ loadScenario: async () => null, storeAnalysis: async () => undefined }))
vi.mock('../../../lib/posthog', () => ({ initPostHog: vi.fn(), identifyUser: vi.fn(), resetPostHog: vi.fn(), trackEvent: vi.fn() }))
vi.mock('../hooks/useThreadPersistence', () => ({ useThreadPersistence: () => ({ onBlockAction: vi.fn(), onChipTaken: vi.fn() }) }))
// The canvas-edit transport (`sendSystemEvent`) sits behind this flag; the
// edit path is live on staging, and five specs on it pin the same value
// (e.g. runAfterEditStaysCurrent.spec.ts).
vi.mock('../../../flags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../flags')>()
  return { ...actual, isOrchestratorV2Enabled: () => true }
})
vi.mock('../../../v5/eligibility', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../v5/eligibility')>()
  return { ...actual, isV5Eligible: () => ({ eligible: true }), isV5CanonicalRunPath: () => false }
})

// ── The served journey ───────────────────────────────────────────────────────

type Wire = Record<string, unknown> & { assistant_text?: string; blocks?: Array<Record<string, unknown>> }
type Journey = { turns: Array<{ turn: string; json: Wire }> }

/**
 * TWO served journeys, same steps. They differ where it matters:
 *   · c673223 (before copy v2): the first pass's `analysis_ready.status` is
 *     `needs_user_input` — the UI's contract validator drops that payload from
 *     the inline draft, which is the path #1983's first guard missed;
 *   · e39f6e0 (#1866 copy v2 served): the first pass is `ready`, and the copy is
 *     what users see now.
 */
const JOURNEYS: ReadonlyArray<[string, Journey]> = [
  ['c673223 — first pass needs_user_input', servedBeforeCopyV2 as Journey],
  ['e39f6e0 — copy v2, first pass ready', servedCopyV2 as Journey],
]
let TURNS: Journey['turns'] = []
const turn = (label: string): Wire => {
  const t = TURNS.find((x) => x.turn === label)
  if (!t) throw new Error(`fixture has no turn "${label}"`)
  return t.json
}
const cardOf = (label: string): Record<string, unknown> => {
  const cards = (turn(label).blocks ?? []).filter((b) => b.type === 'coaching')
  if (cards.length !== 1) throw new Error(`"${label}" must carry exactly one coaching card, has ${cards.length}`)
  return cards[0]
}

let C1_CARD: Record<string, unknown> = {}
let C2_CARD: Record<string, unknown> = {}
let C6_CARD: Record<string, unknown> = {}

// ── Harness ─────────────────────────────────────────────────────────────────

const queue: Wire[] = []
const sent: Array<{ mode: string | null; body: Record<string, unknown> }> = []
const conv: { current: UseConversationReturn | null } = { current: null }

function Harness() {
  const c = useConversation()
  conv.current = c
  return (
    <ToastProvider>
      <ConversationPanel conversation={c} onCollapse={vi.fn()} onAttach={vi.fn()} />
    </ToastProvider>
  )
}

async function reply(label: string, send: () => Promise<unknown>): Promise<void> {
  queue.push(turn(label))
  const before = sent.length
  await act(async () => { await send() })
  expect(sent.length, `${label}: exactly one request left the UI`).toBe(before + 1)
  expect(queue, `${label}: its served body was consumed`).toHaveLength(0)
}

const say = (label: string, text: string) => reply(label, () => conv.current!.sendMessage(text))

/** Markdown emphasis off, dashes and whitespace normalised — the renderer spaces an em dash (" - "). */
const flat = (s: string) =>
  s.replace(/\*\*/g, '').replace(/\s*[—–-]\s*/g, ' - ').replace(/\s+/g, ' ').trim()
const firstSentence = (text: string) => flat(text).split(/(?<=[.!?])\s/)[0]

const cardEl = (card: Record<string, unknown>) =>
  document.querySelector(`[data-block-id="${String(card.block_id)}"]`) as HTMLElement | null
const actionOf = (el: HTMLElement) =>
  el.querySelector(`[data-testid="${el.getAttribute('data-testid')}-action"]`) as HTMLButtonElement | null
const noticeOf = (el: HTMLElement) =>
  el.querySelector(`[data-testid="${el.getAttribute('data-testid')}-freshness"]`)?.textContent ?? null
const lastAssistant = () =>
  [...document.querySelectorAll('[data-testid="chat-message-assistant"]')].pop() as HTMLElement

function expectCurrentOnTheFace(card: Record<string, unknown>) {
  const el = cardEl(card)
  expect(el, `card ${String(card.block_id)} renders`).not.toBeNull()
  expect(el!.getAttribute('data-currency')).toBe('current')
  expect(document.querySelector(`[data-testid="coaching-line-${String(card.block_id)}"]`), 'promoted: no collapsed line').toBeNull()
  const action = actionOf(el!)
  expect(action?.textContent).toBe(String(card.action_label))
  expect(action!.disabled).toBe(false)
  // Its detail is on demand: the "Why this, and how sure" disclosure is offered, closed at rest.
  const details = el!.querySelector(`[data-testid="${el!.getAttribute('data-testid')}-details"]`) as HTMLDetailsElement | null
  expect(details?.tagName, 'the "Why this" detail is offered').toBe('DETAILS')
  expect(details!.open).toBe(false)
}

function expectInert(card: Record<string, unknown>, notice: string) {
  const el = cardEl(card)
  expect(el, `card ${String(card.block_id)} still renders, as history`).not.toBeNull()
  expect(el!.getAttribute('data-currency')).toBe('changed')
  expect(noticeOf(el!)).toBe(notice)
  expect(actionOf(el!)!.disabled).toBe(true)
}

/** Live card actions anywhere in the thread — the user's "what next" at rest. */
const liveCardActions = () =>
  [...document.querySelectorAll('[data-coaching-kind]')]
    .map((el) => actionOf(el as HTMLElement))
    .filter((b): b is HTMLButtonElement => b !== null && !b.disabled)

/**
 * "A short conclusion": ONE sentence of at most 30 words — about two lines at
 * the docked panel's width. The bar comes from the goal and copy v2's "lead
 * with one short sentence", not from these bytes (their longest is 25).
 */
const CONCLUSION_MAX_WORDS = 30

function expectConclusionFirst(label: string) {
  const wire = String(turn(label).assistant_text ?? '')
  const opening = firstSentence(wire)
  const words = opening.split(' ').filter((w) => /[\p{L}\p{N}]/u.test(w)).length
  expect(words, `${label}: the conclusion is one short sentence`).toBeLessThanOrEqual(CONCLUSION_MAX_WORDS)
  expect(flat(lastAssistant().textContent ?? '').startsWith(opening), `${label}: the reply leads with "${opening}"`).toBe(true)
}

async function mount(journey: Journey): Promise<void> {
  TURNS = journey.turns
  C1_CARD = cardOf('C1 brief')
  C2_CARD = cardOf('C2 run')
  C6_CARD = cardOf('C6 re-run')
  queue.length = 0
  sent.length = 0
  Element.prototype.scrollIntoView = vi.fn()
  window.history.replaceState(null, '', '/?ai=openai#/canvas')
  useCanvasStore.setState({
    currentScenarioId: '00000000-0000-4000-8000-000000000001',
    // EMPTY, as a user starts: the first brief then takes the real draft path
    // (applyDraftResult), which is where the served first pass diverged from the
    // wire (Panel's joined witness #63 5824916222: a false "Model changed").
    nodes: [],
    edges: [],
    analysisFreshness: null,
    analysisFreshnessDirty: false,
    analysisStateV1: null,
    results: { status: 'idle' } as never,
    currentScenarioLastResultHash: null,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
  } as never)
  vi.stubGlobal('fetch', vi.fn(async (url: unknown, init?: RequestInit) => {
    // Only the conversation turn is answered from the served journey. Everything
    // else the mounted panel asks for (the readiness service, …) gets a quiet 404,
    // which each of those callers already treats as "no verdict".
    if (!/\/v5\/turn(\?|$)/.test(String(url))) return new Response('{}', { status: 404 })
    sent.push({
      mode: new Headers(init?.headers).get('x-olumi-ai-mode'),
      body: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>,
    })
    const body = queue.shift()
    if (!body) throw new Error('the UI sent a request no served turn answers')
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
  }))
  render(<Harness />)
  await waitFor(() => expect(useGuidanceStore.getState()._sendChip).toBeTypeOf('function'))
  // One conversation per journey: the hook's state outlives a remount.
  await act(async () => { conv.current!.clearHistory() })
  expect(conv.current!.messages, 'each journey starts with an empty thread').toHaveLength(0)
}

// The suite's setup unmounts after each test; the fetch stub goes with it.
afterEach(() => { vi.unstubAllGlobals() })

// ── The journey, in served order ────────────────────────────────────────────

/**
 * ONE `it`: the journey is one mounted panel, and the suite's setup
 * (`tests/setup/rtl.ts`) unmounts everything and clears mocks after each test.
 * Each step names itself, so a failure says which turn broke.
 */
async function step(name: string, fn: () => Promise<void> | void): Promise<void> {
  try { await fn() } catch (e) { if (e instanceof Error) e.message = `[${name}] ${e.message}`; throw e }
}

describe.each(JOURNEYS)('the served OpenAI run turn (%s), through the shipped chain', (_name, journey) => {
  it('C1 → C6, as served: conclusion first, one live card action per completed run, history inert, a safe click, OpenAI only', async () => {
  await mount(journey)
  await step('C1 — the automatic first pass: conclusion first, and its own card is the one live next action', async () => {
    await say('C1 brief', 'We sell a Pro plan at £49/month. Should we raise it to £59 with the next feature release?')
    expectConclusionFirst('C1 brief')
    expect(String(C1_CARD.signal_id)).toMatch(/:auto_first_pass$/)
    // The user has edited nothing: the brief built the model and CEE ran the
    // first pass on it (`complete_current`, hash = computed_against). A local
    // "dirty" flag here is the false "Model changed" (#63 5824916222), and it
    // would make this card — the turn's one next action — inert.
    expect(useCanvasStore.getState().analysisFreshnessDirty, 'no local edit since the first pass').toBe(false)
    expectCurrentOnTheFace(C1_CARD)
    expect(liveCardActions()).toEqual([actionOf(cardEl(C1_CARD)!)])
  })

  await step('C2 — an explicit Run: the new card takes over; the first-pass card is history about an EARLIER RUN', async () => {
    // The served C2 was the typed Run; which UI control sent it does not change
    // what renders from its reply, so a neutral message carries it here.
    await say('C2 run', 'Go ahead.')
    expectConclusionFirst('C2 run')
    expectCurrentOnTheFace(C2_CARD)
    expectInert(C1_CARD, RUN_TURN_NOTICE.earlier_run)
    expect(liveCardActions()).toEqual([actionOf(cardEl(C2_CARD)!)])
  })

  await step('C3 — a question makes no run: no new card, and the Run’s card stays the live next action', async () => {
    await say('C3 question', 'Which of these assumptions is weakest?')
    expectConclusionFirst('C3 question')
    expect((turn('C3 question').blocks ?? []).some((b) => b.type === 'coaching')).toBe(false)
    expect(liveCardActions()).toEqual([actionOf(cardEl(C2_CARD)!)])
  })

  await step('C4 — the click sends the producer’s prompt verbatim, once, as an ordinary OpenAI message', async () => {
    const before = sent.length
    queue.push(turn('C4 click'))
    await act(async () => { fireEvent.click(actionOf(cardEl(C2_CARD)!)!) })
    await waitFor(() => expect(queue).toHaveLength(0))
    const clicks = sent.slice(before)
    expect(clicks).toHaveLength(1)
    const [{ mode, body }] = clicks
    expect(mode).toBe('openai')
    expect(body.kind ?? 'message').toBe('message')
    expect(body.message).toBe(C2_CARD.action_prompt)
    // Never the typed Run or approval: CEE withholds authority on any other chip.
    const chip = (body.chip ?? {}) as { id?: string; action_type?: string }
    expect(chip.action_type).toBeUndefined()
    expect(String(chip.id ?? '')).not.toMatch(/^agent-(run-analysis|approve-proposal)/)
    expectConclusionFirst('C4 click')
    // Acknowledged on the chip itself (settled, no longer clickable) — and
    // nothing more leaves the UI on a second click.
    const settled = actionOf(cardEl(C2_CARD)!)!
    expect(settled.getAttribute('data-settled')).toBe('true')
    expect(settled.disabled).toBe(true)
    await act(async () => { fireEvent.click(settled) })
    expect(sent.length).toBe(before + 1)
  })

  await step('C5 — a canvas edit: every card is history, "your model has changed", and none is live', async () => {
    // The served C5 was a canvas factor edit, forwarded; the UI sends it as a
    // system event, exactly as the Canvas does (values from the served patch).
    const patch = (turn('C5 edit').blocks ?? []).find((b) => b.type === 'graph_patch') as
      { target_id: string; after: { value: number; raw_value: number; unit?: string } }
    await reply('C5 edit', () => conv.current!.sendSystemEvent({
      type: 'factor_value_edit',
      payload: { target_id: patch.target_id, value: patch.after.value, raw_value: patch.after.raw_value, ...(patch.after.unit ? { unit: patch.after.unit } : {}), field: 'value' },
    }))
    expectInert(C1_CARD, RUN_TURN_NOTICE.model_changed)
    expectInert(C2_CARD, RUN_TURN_NOTICE.model_changed)
    expect(liveCardActions()).toEqual([])
  })

  await step('C6 — a re-run: a NEW card is the one live next action; the older two stay history', async () => {
    await say('C6 re-run', 'Once more, please.')
    expectConclusionFirst('C6 re-run')
    expect(C6_CARD.block_id).not.toBe(C2_CARD.block_id)
    expectCurrentOnTheFace(C6_CARD)
    expectInert(C1_CARD, RUN_TURN_NOTICE.model_changed)
    expectInert(C2_CARD, RUN_TURN_NOTICE.model_changed)
    expect(liveCardActions()).toEqual([actionOf(cardEl(C6_CARD)!)])
  })

  await step('every request the UI sent carried the OpenAI mode', () => {
    expect(sent.length).toBe(TURNS.length)
    expect(sent.map((s) => s.mode)).toEqual(TURNS.map(() => 'openai'))
  })
  })
})
