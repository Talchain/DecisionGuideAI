/**
 * SERVED-EQUIVALENT RUN ACCEPTANCE — the route-generated OpenAI agent-lane Run
 * turns from the CEE commit SERVED on staging tonight (`c673223`), rendered by
 * the CURRENT DecisionGuideAI `staging` (with #1973, the disabled refused Run
 * chip).
 *
 * ⚠ WHAT THE FIXTURES ARE, AND ARE NOT. The three `*.route-c673223.json`
 * fixtures are HTTP response bodies of CEE's real `POST /agent/v1/turn` route at
 * `c673223d7bc3f83fc344b68de53b44baf04c75f7`, driven by CEE's own route test
 * double with a SCRIPTED model. They are NOT live captures: no OpenAI or
 * Anthropic call was made, and `assistant_text` is a fixed interpretation
 * written for the capture. Everything else — the run's blocks, `analysis_state`,
 * `analysis_ready`, the coaching card, `suggested_actions`, the envelope — is
 * what the route itself composed. Each `_provenance` says so in full and carries
 * the sha256 of the route's raw bytes, which §0 re-derives.
 *
 * ⚠ ADAPTED FROM `origin/ai-conversation/prb-route-acceptance` (d2c96bdd).
 * That spec measured the PR-B UI branch, which carries the run-turn three-part
 * currency rule (`RUN_TURN_NOTICE`, `data-run-turn-reason`) and the promotion
 * flag (`RUN_TURN_COACHING_PROMOTION_ENABLED`). Current staging (64a3b385)
 * carries NEITHER. Run verbatim on staging it is 8 pass / 2 fail: the promotion
 * flag is undefined, and its earlier-run CONTROL stays `current`. Here those two
 * cases measure what staging actually does instead, and the earlier-run case is
 * kept as an explicitly-named GAP, not silently dropped.
 *
 * The chain is `useConversation`'s, in its order: parse → route → `applyV5State`
 * into the REAL canvas store → phase-3 extraction → `composePhase3BridgedBlocks`
 * → the message → the real `ChatThread` (and, in §4, the real
 * `ConversationPanel`, whose run gate #1973 hands to the chip row). Production
 * defaults throughout: compact coaching lines ON.
 *
 * No model calls: jsdom, fixture-only; §4 stubs `fetch` to a never-settling
 * promise.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent, cleanup, within, act, waitFor } from '@testing-library/react'
import { createHash } from 'node:crypto'

vi.mock('../../../lib/supabase', () => ({
  supabase: {},
  getUserId: async () => null,
  getSessionIdentity: async () => ({ userId: null, accessToken: null }),
}))
vi.mock('../../../services/scenarioService', () => ({
  loadScenario: async () => null,
  storeAnalysis: async () => undefined,
}))
vi.mock('../../../lib/posthog', () => ({
  initPostHog: () => undefined,
  identifyUser: () => undefined,
  resetPostHog: () => undefined,
  trackEvent: () => undefined,
}))
const { onChipTaken } = vi.hoisted(() => ({ onChipTaken: vi.fn() }))
vi.mock('../hooks/useThreadPersistence', () => ({
  useThreadPersistence: () => ({ onBlockAction: vi.fn(), onChipTaken }),
}))

import { parseV5Response } from '../../../v5/responseParser'
import { routeV5Response } from '../../../v5/responseRouter'
import { mapV5Blocks } from '../../../v5/blocks/mapV5Blocks'
import {
  extractPhase3FromV5Response,
  deriveV5AnalysisFactUpdate,
} from '../../../v5/extractPhase3FromV5Response'
import { buildSuggestedActionChips } from '../../../v5/blocks/suggestedActionChips'
import { applyV5State } from '../../../v5/applyV5State'
import { composePhase3BridgedBlocks } from '../useConversation'
import { extractAnswerShapeSidecar } from '../answerShape'
import { ChatThread } from '../zones/ChatThread'
import * as messageComposition from '../messageComposition'
import * as coachingCurrency from '../../../v5/blocks/coachingCurrency'
import { FRESHNESS_NOTICE } from '../../../v5/blocks/coachingCurrency'
import { isCompactCoachingLinesEnabled } from '../../../flags'
import { ConversationPanel } from '../ConversationPanel'
import { ToastProvider } from '../../ToastContext'
import { useCanvasStore } from '../../store'
import { useGuidanceStore } from '../../stores/guidanceStore'
import { useReadinessStore, __test__ as readinessTest } from '../../stores/readinessStore'
import type { ActionChip, ConversationMessage } from '../types'
import type { UseConversationReturn, PatchBlockState, PatchRejectionInfo } from '../useConversation'

import explicitRun from './fixtures/openai-agent-run-explicit.route-c673223.json'
import blockedRun from './fixtures/openai-agent-run-blocked.route-c673223.json'
import buildTurn from './fixtures/openai-agent-build-turn-first-pass.route-c673223.json'
import explicitRunC933 from './fixtures/openai-agent-run-explicit.prb-route-c933aabf.json'
import blockedRunC933 from './fixtures/openai-agent-run-blocked.prb-route-c933aabf.json'

const CEE_SERVED = 'c673223d7bc3f83fc344b68de53b44baf04c75f7'

type Wire = Record<string, unknown>
type Card = {
  type: string
  block_id: string
  title: string
  body: string
  action_label: string
  action_prompt: string
  action_intent?: string
  created_at: string
  graph_hash_at_generation: string
  source_handler: string
  freshness: string
  signal_id: string
  dsk_claim_provenance?: { claim_id: string; evidence_strength: string }
}

/** The route body exactly as the route sent it: the fixture minus its `_provenance`. */
function routeBody(fixture: Wire): { body: Wire; provenance: Record<string, unknown> } {
  const { _provenance, ...body } = JSON.parse(JSON.stringify(fixture)) as Wire
  return { body, provenance: _provenance as Record<string, unknown> }
}

function cardOf(body: Wire): Card {
  const cards = (body.blocks as Card[]).filter((b) => b.type === 'coaching')
  expect(cards, 'the route body carries exactly one coaching card').toHaveLength(1)
  return cards[0]
}

/** useConversation's chain, in its order, with `applyV5State` writing the REAL canvas store. */
async function messageFrom(body: Wire, id = 'a1'): Promise<ConversationMessage> {
  const res = new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
  const target = routeV5Response(await parseV5Response(res))
  if (target.kind !== 'blocks' && target.kind !== 'text_only') throw new Error(target.kind)
  const response = target.response
  const snapshot = useCanvasStore.getState()
  applyV5State(response, { ...snapshot, currentResultsHash: snapshot.results?.hash ?? null } as never)
  const mapped = target.kind === 'blocks' ? mapV5Blocks(response.blocks, response.suggested_actions) : []
  const phase3 = extractPhase3FromV5Response(response)
  const fact = deriveV5AnalysisFactUpdate(response, phase3)
  const blocks = composePhase3BridgedBlocks(fact.action === 'set', phase3.rawBlocks, mapped)
  const actionChips = buildSuggestedActionChips(response.blocks, response.suggested_actions)
  const answerShape = extractAnswerShapeSidecar(response)
  return {
    id,
    role: 'assistant',
    content: response.assistant_text,
    blocks,
    ...(actionChips.length > 0 ? { actionChips } : {}),
    ...(answerShape ? { answerShape } : {}),
    timestamp: new Date('2026-09-25T01:00:00Z'),
  } as ConversationMessage
}

function renderThread(assistant: ConversationMessage, onChipClick = vi.fn(async (_chip: unknown) => {})) {
  const messages = [
    { id: 'u1', role: 'user', content: 'Run analysis', timestamp: new Date('2026-09-25T00:59:50Z') },
    assistant,
  ] as ConversationMessage[]
  render(
    <ChatThread
      {...({
        messages,
        isThinking: false,
        longRunningHint: null,
        nodeCount: 5,
        patchBlockStates: new Map(),
        patchRejections: new Map(),
        onChipClick,
        onPatchAccept: () => {},
        onPatchDismiss: () => {},
        onFeedback: () => {},
        onRetry: () => {},
        compact: true,
      } as unknown as React.ComponentProps<typeof ChatThread>)}
    />,
  )
  return { onChipClick }
}

/** The assistant reply's own text node, as a reader sees it: paragraphs and bullets, markdown gone. */
function renderedReplyText(): string {
  const assistant = screen.getByTestId('chat-message-assistant')
  const body = within(assistant).getAllByTestId('message-body-text')[0].cloneNode(true) as HTMLElement
  for (const el of body.querySelectorAll('p, li, ul, ol, div, br')) { el.before(' '); el.after(' ') }
  return (body.textContent ?? '').replace(/\s+/g, ' ').trim()
}
/** Everything the assistant message puts on screen (closed <details> content included — jsdom does not hide it). */
function wholeMessageText(): string {
  const assistant = screen.getByTestId('chat-message-assistant').cloneNode(true) as HTMLElement
  for (const el of assistant.querySelectorAll('p, li, ul, ol, div, br, summary, h3, button, span')) { el.before(' '); el.after(' ') }
  return (assistant.textContent ?? '').replace(/\s+/g, ' ').trim()
}
const words = (s: string) => s.split(/\s+/).filter(Boolean).length
/** Source text as a reader reads it (see the PR-B spec): markdown markers gone, dashes spaced. */
const readable = (s: string) =>
  s
    .split('\n')
    .map((l) => l.replace(/^- /, '').replace(/\*\*/g, ''))
    .join(' ')
    .replace(/[‒–—―]/g, ' - ')
    .replace(/\s+/g, ' ')
    .trim()

const LEADER = /option in front|winner|recommend|best option|leading option|clearly ahead|most likely to be strongest|slightly ahead/i
const sendChip = vi.fn()

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
  sendChip.mockReset()
  onChipTaken.mockReset()
  useGuidanceStore.setState({ _sendChip: sendChip })
  useCanvasStore.setState({
    analysisFreshness: null,
    analysisFreshnessDirty: false,
    importPendingServerRegistration: false,
    analysisStateV1: null,
  })
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  useGuidanceStore.setState({ _sendChip: null, _runAnalysis: null } as never)
})

describe('§0 the fixtures ARE the c673223 route bodies, byte for byte', () => {
  it('re-derives the sha256 of each route body and is marked route-generated from c673223, not live', () => {
    for (const fixture of [explicitRun, blockedRun, buildTurn] as Wire[]) {
      const { body, provenance } = routeBody(fixture)
      const raw = JSON.stringify(body)
      expect(createHash('sha256').update(raw, 'utf8').digest('hex')).toBe(provenance.route_body_sha256)
      expect(new TextEncoder().encode(raw).length).toBe(provenance.route_body_bytes)
      expect(String(provenance.kind)).toMatch(/^ROUTE-GENERATED WITH A SCRIPTED MODEL — NOT A LIVE CAPTURE/)
      expect(String(provenance.producer)).toContain(CEE_SERVED)
    }
  })

  it('the explicit Run is BYTE-IDENTICAL to the c933aabf capture; the blocked Run differs only in a wall-clock duration', () => {
    const now = routeBody(explicitRun as Wire)
    const then = routeBody(explicitRunC933 as Wire)
    expect(now.provenance.route_body_sha256).toBe(then.provenance.route_body_sha256)
    expect(JSON.stringify(now.body)).toBe(JSON.stringify(then.body))

    const bNow = routeBody(blockedRun as Wire).body
    const bThen = routeBody(blockedRunC933 as Wire).body
    const calls = (b: Wire) => b._provider_calls as Array<Record<string, unknown>>
    expect(calls(bNow)).toHaveLength(1)
    expect(calls(bThen)).toHaveLength(1)
    for (const b of [bNow, bThen]) delete calls(b)[0].duration_ms
    expect(bNow).toEqual(bThen)
  })

  it('production defaults on THIS staging: compact coaching lines ON; the PR-B run-turn UI is NOT present', () => {
    expect(isCompactCoachingLinesEnabled()).toBe(true)
    // Recorded, not assumed: these are the two exports the PR-B spec needs.
    expect(messageComposition).not.toHaveProperty('RUN_TURN_COACHING_PROMOTION_ENABLED')
    expect(coachingCurrency).not.toHaveProperty('RUN_TURN_NOTICE')
  })
})

describe('§1 the explicit Run: the route states a CURRENT run, and the store takes it', () => {
  it('card created_at = run_state.computed_at; card hash = graph_hash = analysis_ready.current_graph_hash', async () => {
    const { body } = routeBody(explicitRun as Wire)
    const card = cardOf(body)
    const state = body.analysis_state as { run_state: { kind: string; computed_at: string }; leader_claim: Record<string, unknown> }
    const ready = body.analysis_ready as { current_graph_hash: string }
    expect(card.source_handler).toBe('run_analysis')
    expect(card.freshness).toBe('fresh')
    expect(card.signal_id.endsWith(':explicit_run')).toBe(true)
    expect(state.run_state.kind).toBe('complete_current')
    expect(card.created_at).toBe(state.run_state.computed_at)
    expect(card.graph_hash_at_generation).toBe(body.graph_hash)
    expect(card.graph_hash_at_generation).toBe(ready.current_graph_hash)
    expect(state.leader_claim).toEqual({ permitted: false, withheld_reason: 'constraint_verdict_withheld', separation: 'separated' })

    await messageFrom(body)
    const s = useCanvasStore.getState()
    expect(s.analysisStateV1?.run_state.kind, 'applyV5State accepted the verdict (not cleared as invalid)').toBe('complete_current')
    expect(s.analysisStateV1 && 'computed_at' in s.analysisStateV1.run_state ? s.analysisStateV1.run_state.computed_at : null).toBe(card.created_at)
    expect(s.analysisFreshness?.currentGraphHash).toBe(card.graph_hash_at_generation)
    expect(s.analysisFreshnessDirty).toBe(false)
  })
})

describe('§2 the explicit Run renders: reply verbatim, one CURRENT card with a live action', () => {
  it('the reply text renders in full — every sentence, no concise view, nothing clamped', async () => {
    const { body } = routeBody(explicitRun as Wire)
    renderThread(await messageFrom(body))
    const source = readable(String(body.assistant_text))
    const rendered = renderedReplyText()
    expect(rendered).toBe(source)
    expect(words(rendered)).toBe(93)
    expect(screen.queryByTestId('answer-body'), 'no _answer_shape on the wire, so no concise view').toBeNull()
  })

  it('the card is on the face as ONE collapsed line whose words are the producer title, verbatim', async () => {
    const { body } = routeBody(explicitRun as Wire)
    const card = cardOf(body)
    renderThread(await messageFrom(body))
    const line = screen.getByTestId(`coaching-line-${card.block_id}`) as HTMLDetailsElement
    expect(line.tagName).toBe('DETAILS')
    expect(line.open, 'the card is a closed line, not an expanded face').toBe(false)
    expect(screen.getByTestId(`coaching-line-summary-${card.block_id}`).textContent?.trim()).toBe(card.title)
    expect(screen.queryByTestId('block-detail-toggle')).toBeNull()
    expect(document.querySelectorAll('[data-testid^="coaching-line-summary-"]')).toHaveLength(1)
  })

  it('opened: the verbatim body and action, CURRENT (no notice), DSK grounding, the chip enabled; one click sends action_prompt verbatim, once', async () => {
    const { body } = routeBody(explicitRun as Wire)
    const card = cardOf(body)
    renderThread(await messageFrom(body))
    const line = screen.getByTestId(`coaching-line-${card.block_id}`) as HTMLDetailsElement
    fireEvent.click(screen.getByTestId(`coaching-line-summary-${card.block_id}`))
    expect(line.open, 'one click on the line opens the card').toBe(true)
    const cardEl = line.querySelector(`[data-block-id="${card.block_id}"]`) as HTMLElement
    expect(cardEl).not.toBeNull()
    expect(cardEl.getAttribute('data-currency')).toBe('current')
    expect(cardEl.getAttribute('data-run-turn-reason'), 'staging has no run-turn rule to name a limb').toBeNull()
    expect(within(cardEl).queryByTestId('v5-coaching-freshness'), 'current: no notice').toBeNull()
    expect(within(cardEl).getByTestId('v5-coaching-body').textContent).toBe(card.body)
    const dsk = within(cardEl).getByTestId('v5-coaching-dsk-provenance')
    expect(dsk.getAttribute('data-dsk-claim-id')).toBe(card.dsk_claim_provenance?.claim_id)
    expect(dsk.getAttribute('data-dsk-evidence-strength')).toBe(card.dsk_claim_provenance?.evidence_strength)
    const chip = within(cardEl).getByTestId('v5-coaching-action') as HTMLButtonElement
    expect(chip.tagName).toBe('BUTTON')
    expect(chip.textContent).toBe(card.action_label)
    expect(chip.disabled).toBe(false)
    expect(chip.getAttribute('data-inert')).toBeNull()
    for (const field of [card.title, card.body, card.action_label, card.action_prompt]) expect(field).not.toMatch(LEADER)

    fireEvent.click(chip)
    fireEvent.click(chip)
    expect(sendChip).toHaveBeenCalledTimes(1)
    expect(sendChip).toHaveBeenCalledWith(card.action_label, card.action_prompt, undefined)
    expect(chip.disabled, 'one chip, one turn').toBe(true)
  })

  it('CONTROL (staging’s rule — the "current" verdict is not vacuous): once the model moves (a new current graph hash), the card speaks the stale notice and its action goes inert', async () => {
    const { body } = routeBody(explicitRun as Wire)
    const card = cardOf(body)
    const msg = await messageFrom(body)
    const fr = useCanvasStore.getState().analysisFreshness
    expect(fr).not.toBeNull()
    useCanvasStore.setState({ analysisFreshness: { ...fr!, currentGraphHash: 'ffffffffffffffff' } })
    renderThread(msg)
    const cardEl = screen
      .getByTestId(`coaching-line-${card.block_id}`)
      .querySelector(`[data-block-id="${card.block_id}"]`) as HTMLElement
    expect(cardEl.getAttribute('data-currency')).toBe('changed')
    expect(within(cardEl).getByTestId('v5-coaching-freshness').textContent).toBe(FRESHNESS_NOTICE.stale)
    const chip = within(cardEl).getByTestId('v5-coaching-action') as HTMLButtonElement
    expect(chip.disabled).toBe(true)
    fireEvent.click(chip)
    expect(sendChip).not.toHaveBeenCalled()
  })

  it('GAP vs the PR-B UI (not on staging): after a LATER run on the SAME model the card still reads CURRENT and its action stays live', async () => {
    const { body } = routeBody(explicitRun as Wire)
    const card = cardOf(body)
    const msg = await messageFrom(body)
    const verdict = useCanvasStore.getState().analysisStateV1
    useCanvasStore.setState({
      analysisStateV1: { ...verdict!, run_state: { kind: 'complete_current', computed_at: '2026-09-24T17:02:11.004Z' } } as typeof verdict,
    })
    renderThread(msg)
    const cardEl = screen
      .getByTestId(`coaching-line-${card.block_id}`)
      .querySelector(`[data-block-id="${card.block_id}"]`) as HTMLElement
    // The PR-B spec asserts 'changed' + RUN_TURN_NOTICE.earlier_run + inert here.
    expect(cardEl.getAttribute('data-currency')).toBe('current')
    expect(within(cardEl).queryByTestId('v5-coaching-freshness')).toBeNull()
    expect((within(cardEl).getByTestId('v5-coaching-action') as HTMLButtonElement).disabled).toBe(false)
  })

  it('no fabricated action: the route offered no suggested action on the completed Run, so no chip row renders', async () => {
    const { body } = routeBody(explicitRun as Wire)
    expect(body.suggested_actions).toEqual([])
    const msg = await messageFrom(body)
    expect(msg.actionChips).toBeUndefined()
    renderThread(msg)
    expect(screen.queryByTestId('suggested-chips')).toBeNull()
  })

  it('the run’s own result card renders beside it (summary, tentative copy); nothing on the face names a leader', async () => {
    const { body } = routeBody(explicitRun as Wire)
    renderThread(await messageFrom(body))
    expect(screen.getByTestId('v5-analysis-result-summary').textContent).toMatch(/^Ran analysis on your current scenario\. One limit on your model could not be checked/)
    expect(screen.getByTestId('v5-analysis-result-uncertainty-copy').textContent).toBe('This result is tentative. The uncertainty is substantial.')
    expect(wholeMessageText()).not.toMatch(LEADER)
    // leader_claim withheld (constraint_verdict_withheld): rows are probability-ordered DATA, none designated.
    expect(document.querySelectorAll('[data-leader="true"]')).toHaveLength(0)
    expect(document.querySelectorAll('[data-leader="false"]')).toHaveLength(3)
  })
})

describe('§3 the blocked Run: no card, Olumi’s reason, the one next-step chip', () => {
  it('renders the reply and the producer chip; no coaching line', async () => {
    const { body } = routeBody(blockedRun as Wire)
    expect((body.blocks as unknown[]).length).toBe(0)
    const { onChipClick } = renderThread(await messageFrom(body))
    expect(renderedReplyText()).toBe(readable(String(body.assistant_text)))
    expect(document.querySelector('[data-testid^="coaching-line-"]')).toBeNull()
    const row = screen.getByTestId('suggested-chips')
    fireEvent.click(within(row).getByRole('button', { name: 'Suggest what it still needs' }))
    expect(onChipClick).toHaveBeenCalledTimes(1)
    expect(onChipClick.mock.calls[0][0]).toMatchObject({
      id: 'agent-suggest-what-it-needs',
      message: 'Suggest what this model still needs before the analysis can run, so I can approve it.',
    })
  })
})

// ---------------------------------------------------------------------------
// §4 — #1973 on the REAL ConversationPanel after the blocked Run
// ---------------------------------------------------------------------------
//
// The panel's run gate (`canRunAnalysis`) reads its readiness from
// `analysis_state.readiness` when a turn states it, else from the graph-readiness
// SIDE-CAR (`/bff/cee/graph-readiness`, `can_run_analysis`). This blocked turn's
// `analysis_state` is `{ run_state: never_run, leader_claim }` — no `readiness` —
// so the side-car decides. Its `analysis_ready.may_run: false` is not a refusal
// input to the gate (by design: `may_run` only WAIVES blockers — canRunAnalysis.ts
// "(c) mayRun … WAIVING (b) AND ONLY (b)").
//
// The side-car verdict below is the HARNESS's instance (as in the #1973 served
// witness, `runChipGateFixtures.ts` READINESS_BLOCKED), built from THIS turn's own
// `analysis_ready.readiness_issues[0]` — CEE's words for this graph — and it goes
// through the REAL readiness store (`refresh()` → fetch → normaliser).

/** A Run chip the route did NOT send — used only as the CONTROL that the gate is closed in this mount. */
const CONTROL_RUN_CHIP: ActionChip = {
  id: 'control_run',
  label: 'Run analysis',
  message: 'Run analysis',
  action_type: 'run_analysis',
  intent: 'primary',
}

function sidecarClosedFromTurn(body: Wire): Record<string, unknown> {
  const issue = (body.analysis_ready as { readiness_issues: Array<Record<string, unknown>> }).readiness_issues[0]
  return {
    readiness_score: 62,
    readiness_level: 'needs_work',
    confidence_level: 'medium',
    confidence_explanation: 'not ready',
    can_run_analysis: false,
    improvements: [],
    options_ready: 1,
    options_total: 2,
    goal_node_valid: true,
    blocker_reason: issue.message,
    readiness_issues: [{ ...issue, obligation: 'required' }],
  }
}

function conversationWith(assistant: ConversationMessage, dispatchAction: ReturnType<typeof vi.fn>, panelSendChip: ReturnType<typeof vi.fn>): UseConversationReturn {
  const patchStates = new Map<string, PatchBlockState>()
  const patchRejections = new Map<string, PatchRejectionInfo>()
  return {
    messages: [
      { id: 'u1', role: 'user', content: 'Run analysis', timestamp: new Date('2026-09-25T00:59:50Z') },
      assistant,
    ] as ConversationMessage[],
    isThinking: false,
    longRunningHint: null,
    lastSendFailure: null,
    dispatchAction: dispatchAction as unknown as UseConversationReturn['dispatchAction'],
    cancelTurn: vi.fn(),
    startNewDraft: vi.fn(async () => {}),
    sendMessage: vi.fn().mockResolvedValue(undefined),
    sendSystemEvent: vi.fn().mockResolvedValue(undefined) as unknown as UseConversationReturn['sendSystemEvent'],
    sendChip: panelSendChip as unknown as UseConversationReturn['sendChip'],
    clearHistory: vi.fn(),
    retryLast: vi.fn().mockResolvedValue(undefined),
    patchBlockStates: patchStates,
    setPatchBlockState: (key: string, state: PatchBlockState) => { patchStates.set(key, state) },
    patchRejections,
    setPatchRejection: (key: string, info: PatchRejectionInfo) => { patchRejections.set(key, info) },
  }
}

/**
 * Mount the real panel on the blocked Run. `sidecar`: 'closed' answers the
 * readiness side-car with CEE's own refusal for this graph; 'unanswered' leaves
 * it with no verdict (the side-car request is answered 503).
 */
async function mountPanelOnBlockedRun(sidecar: 'closed' | 'unanswered', extraChips: ActionChip[] = []) {
  const { body } = routeBody(blockedRun as Wire)
  const readinessCalls: string[] = []
  vi.stubGlobal('fetch', vi.fn((input: unknown) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url
    if (url.includes('/graph-readiness')) {
      readinessCalls.push(url)
      return Promise.resolve(sidecar === 'closed'
        ? new Response(JSON.stringify(sidecarClosedFromTurn(body)), { status: 200, headers: { 'Content-Type': 'application/json' } })
        : new Response('{"error":"unavailable"}', { status: 503, headers: { 'Content-Type': 'application/json' } }))
    }
    return new Promise(() => {})
  }))
  // Isolation: nothing from an earlier mount may still be in flight or armed.
  readinessTest.resetModuleState()
  await waitFor(() => { expect(readinessTest.getModuleState().fetchInFlight).toBe(false) })
  // …and outlive the shared request de-dup window (useGraphReadiness DEDUP_WINDOW_MS
  // = 750), so THIS mount's stub answers the side-car, not the previous mount's
  // settled response for the same payload.
  await new Promise((r) => setTimeout(r, 800))
  useReadinessStore.setState({ readiness: null, loading: false, error: null, stale: false, verdictAtMs: null })
  useCanvasStore.setState({
    nodes: [
      { id: 'goal_x', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Outcome' } },
      { id: 'opt_a', type: 'option', position: { x: 100, y: 0 }, data: { label: 'Option A' } },
      { id: 'opt_b', type: 'option', position: { x: 200, y: 0 }, data: { label: 'Option B' } },
    ],
    edges: [],
    currentScenarioId: '7b1e2d3c-4a5f-4e6d-8c7b-8a9f0e1d2cf2',
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
    results: { status: 'idle' },
    graphHealth: null,
    ceeAnalysisReady: null,
    _externalMutationActive: 0,
  } as never)
  const msg = await messageFrom(body)
  await act(async () => { useReadinessStore.getState().refresh() })
  if (sidecar === 'closed') {
    await waitFor(() => { expect(useReadinessStore.getState().readiness?.can_run_analysis).toBe(false) })
  } else {
    await waitFor(() => { expect(useReadinessStore.getState().error).not.toBeNull() })
  }
  expect(readinessCalls.length, 'the side-car was asked, and answered by this stub').toBeGreaterThan(0)
  const assistant = { ...msg, actionChips: [...(msg.actionChips ?? []), ...extraChips] } as ConversationMessage
  const dispatchAction = vi.fn().mockResolvedValue(undefined)
  const panelSendChip = vi.fn().mockResolvedValue(undefined)
  render(
    <ToastProvider>
      <ConversationPanel conversation={conversationWith(assistant, dispatchAction, panelSendChip)} onCollapse={vi.fn()} onAttach={vi.fn()} />
    </ToastProvider>,
  )
  await waitFor(() => { expect(useGuidanceStore.getState()._runAnalysis).toBeTypeOf('function') })
  return { dispatchAction, panelSendChip, body, readinessCalls }
}

describe('§4 #1973 on the real ConversationPanel after the blocked Run (side-car CLOSED, as CEE would answer for this graph)', () => {
  afterEach(() => {
    readinessTest.resetModuleState()
    useReadinessStore.setState({ readiness: null, loading: false, error: null, stale: false, verdictAtMs: null })
    vi.unstubAllEnvs()
  })

  it('the store took the turn’s refusal (may_run false); the composer’s Analyse control is disabled with the gate’s own sentence', async () => {
    const { body } = await mountPanelOnBlockedRun('closed')
    expect(useCanvasStore.getState().ceeAnalysisReady?.may_run).toBe(false)
    // HARNESS ARTEFACT, recorded: this turn's `analysis_state` is the CEE route
    // double's readback `{ run_state: never_run, leader_claim }` (no readiness,
    // robustness, usable_* …), which fails AnalysisStateV1 validation, so
    // applyV5State CLEARS the verdict. A served CEE readback carries the full object.
    expect(Object.keys(body.analysis_state as object).sort()).toEqual(['leader_claim', 'run_state'])
    expect(useCanvasStore.getState().analysisStateV1).toBeNull()
    const analyse = screen.getByTestId('run-analysis-chip')
    expect(analyse).toBeDisabled()
    const sentence = analyse.getAttribute('title') ?? ''
    expect(sentence).not.toBe('Run analysis')
    expect(sentence).toContain('Option B')
    expect((body.analysis_ready as { readiness_issues: Array<{ message: string }> }).readiness_issues[0].message).toContain('Option B')
  })

  it('the route’s own next-step chip is NOT a Run chip: it stays live under the closed gate, no gate sentence, and one click sends it once', async () => {
    const { dispatchAction, panelSendChip } = await mountPanelOnBlockedRun('closed')
    expect(screen.getByTestId('run-analysis-chip')).toBeDisabled()
    const chip = screen.getByTestId('suggested-chip-agent-suggest-what-it-needs')
    expect(chip).toBeEnabled()
    expect(chip).toHaveTextContent('Suggest what it still needs')
    expect(chip).not.toHaveAttribute('data-run-gated')
    expect(chip).not.toHaveAttribute('aria-describedby')
    expect(screen.queryByTestId('suggested-chips-run-gate-reason'), 'no Run chip on this turn, so no gate sentence under the row').toBeNull()
    await act(async () => { fireEvent.click(chip) })
    expect(panelSendChip).toHaveBeenCalledTimes(1)
    expect(panelSendChip).toHaveBeenCalledWith(expect.objectContaining({
      id: 'agent-suggest-what-it-needs',
      message: 'Suggest what this model still needs before the analysis can run, so I can approve it.',
    }))
    expect(dispatchAction).not.toHaveBeenCalled()
  })

  it('CONTROL, V5 flag unset (as the local served witness runs): a Run chip the route did NOT send renders DISABLED with the gate’s sentence under the row, and nothing dispatches', async () => {
    const { dispatchAction, panelSendChip } = await mountPanelOnBlockedRun('closed', [CONTROL_RUN_CHIP])
    const run = screen.getByTestId('suggested-chip-control_run')
    expect(run).toBeDisabled()
    expect(run).toHaveAttribute('data-run-gated', 'true')
    const reason = screen.getByTestId('suggested-chips-run-gate-reason')
    expect(reason.textContent).toBe(screen.getByTestId('run-analysis-chip').getAttribute('title'))
    expect(run).toHaveAttribute('aria-describedby', reason.id)
    await act(async () => { fireEvent.click(run) })
    expect(dispatchAction).not.toHaveBeenCalled()
    expect(panelSendChip).not.toHaveBeenCalled()
    expect(screen.getByTestId('suggested-chip-agent-suggest-what-it-needs')).toBeEnabled()
  })

  it('CONTROL, V5 flag ON: the same Run chip is not offered at all (the readiness filter hides it: status needs_user_input, may_run false); the next-step chip stays live', async () => {
    vi.stubEnv('VITE_ENABLE_V5_ORCHESTRATOR', 'true')
    await mountPanelOnBlockedRun('closed', [CONTROL_RUN_CHIP])
    expect(screen.queryByTestId('suggested-chip-control_run')).toBeNull()
    expect(screen.queryByTestId('suggested-chips-run-gate-reason')).toBeNull()
    expect(screen.getByTestId('suggested-chip-agent-suggest-what-it-needs')).toBeEnabled()
  })
})

describe('§4b RECORDED: the same blocked turn with NO side-car verdict (readiness request answered 503)', () => {
  afterEach(() => {
    readinessTest.resetModuleState()
    useReadinessStore.setState({ readiness: null, loading: false, error: null, stale: false, verdictAtMs: null })
  })

  it('the gate is OPEN — the composer’s Analyse control is live although this very turn said may_run:false (the gate does not read may_run as a refusal); the next-step chip is live', async () => {
    await mountPanelOnBlockedRun('unanswered')
    expect(useCanvasStore.getState().ceeAnalysisReady?.may_run).toBe(false)
    expect(useReadinessStore.getState().readiness).toBeNull()
    expect(screen.getByTestId('run-analysis-chip')).toBeEnabled()
    expect(screen.getByTestId('suggested-chip-agent-suggest-what-it-needs')).toBeEnabled()
  })
})

describe('§5 the build turn (automatic first pass, PR #1854): its own current card, bound to the first run', () => {
  it('renders the reply, the first-pass result and ONE current card whose body frames it as a first pass on Olumi’s estimates', async () => {
    const { body } = routeBody(buildTurn as Wire)
    const card = cardOf(body)
    expect(card.signal_id.endsWith(':auto_first_pass')).toBe(true)
    expect(card.created_at).toBe((body.analysis_state as { run_state: { computed_at: string } }).run_state.computed_at)
    renderThread(await messageFrom(body))
    expect(renderedReplyText()).toBe(readable(String(body.assistant_text)))
    const line = screen.getByTestId(`coaching-line-${card.block_id}`) as HTMLDetailsElement
    fireEvent.click(screen.getByTestId(`coaching-line-summary-${card.block_id}`))
    const cardEl = line.querySelector(`[data-block-id="${card.block_id}"]`) as HTMLElement
    expect(cardEl.getAttribute('data-currency')).toBe('current')
    expect(within(cardEl).getByTestId('v5-coaching-body').textContent).toBe(card.body)
    expect((within(cardEl).getByTestId('v5-coaching-action') as HTMLButtonElement).disabled).toBe(false)
    expect(wholeMessageText()).not.toMatch(LEADER)
  })
})
