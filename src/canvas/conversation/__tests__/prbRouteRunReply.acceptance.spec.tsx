/**
 * PR-B ROUTE ACCEPTANCE — the first ROUTE-GENERATED OpenAI agent-lane Run turn
 * that carries the run-turn coaching card, rendered by the SHIPPED chain.
 *
 * ⚠ WHAT THE FIXTURE IS, AND IS NOT. `openai-agent-run-explicit.prb-route-c933aabf.json`
 * is the HTTP response body of CEE's real `POST /agent/v1/turn` route at PR #1854's
 * approved head `c933aabf` (byte-identical on `c933aabf` + staging `caf7d1a3`), driven
 * by CEE's own route test double with a SCRIPTED model. It is NOT a live capture: no
 * OpenAI or Anthropic call was made, and `assistant_text` is a fixed interpretation
 * written for the capture. Everything else — the run's blocks, `analysis_state`,
 * `analysis_ready`, the coaching card, `suggested_actions`, the envelope — is what the
 * route itself composed. Its `_provenance` says so in full and carries the sha256 of
 * the route's raw bytes, which §0 re-derives.
 *
 * The chain is `useConversation`'s, in its order: parse → route → `applyV5State` into
 * the REAL canvas store → phase-3 extraction → `composePhase3BridgedBlocks` → the
 * message → the real `ChatThread`. Production defaults throughout: promotion OFF
 * (`RUN_TURN_COACHING_PROMOTION_ENABLED`), compact coaching lines ON.
 *
 * No model calls: jsdom, fixture-only.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'
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
vi.mock('../../../lib/posthog', () => ({ trackEvent: () => undefined }))

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
import { RUN_TURN_COACHING_PROMOTION_ENABLED } from '../messageComposition'
import { RUN_TURN_NOTICE } from '../../../v5/blocks/coachingCurrency'
import { isCompactCoachingLinesEnabled } from '../../../flags'
import { useCanvasStore } from '../../store'
import { useGuidanceStore } from '../../stores/guidanceStore'
import type { ConversationMessage } from '../types'

import explicitRun from './fixtures/openai-agent-run-explicit.prb-route-c933aabf.json'
import blockedRun from './fixtures/openai-agent-run-blocked.prb-route-c933aabf.json'

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
async function messageFrom(body: Wire): Promise<ConversationMessage> {
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
    id: 'a1',
    role: 'assistant',
    content: response.assistant_text,
    blocks,
    ...(actionChips.length > 0 ? { actionChips } : {}),
    ...(answerShape ? { answerShape } : {}),
    timestamp: new Date('2026-09-24T21:00:00Z'),
  } as ConversationMessage
}

function renderThread(assistant: ConversationMessage, onChipClick = vi.fn(async (_chip: unknown) => {})) {
  const messages = [
    { id: 'u1', role: 'user', content: 'Run analysis', timestamp: new Date('2026-09-24T20:59:50Z') },
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
  // A reader sees a break between block elements; textContent does not.
  for (const el of body.querySelectorAll('p, li, ul, ol, div, br')) { el.before(' '); el.after(' ') }
  return (body.textContent ?? '').replace(/\s+/g, ' ').trim()
}
const words = (s: string) => s.split(/\s+/).filter(Boolean).length
/**
 * The source text as a reader reads it: markdown markers (`**`, a leading "- ")
 * removed, and `safeRichText`'s one existing text rewrite applied — every dash
 * variant (U+2012–U+2015) renders as a spaced hyphen (Step 1c, "safety net for
 * LLM output"). Nothing else may differ.
 */
const readable = (s: string) =>
  s
    .split('\n')
    .map((l) => l.replace(/^- /, '').replace(/\*\*/g, ''))
    .join(' ')
    .replace(/[‒–—―]/g, ' - ')
    .replace(/\s+/g, ' ')
    .trim()

const LEADER = /option in front|winner|recommend|best option|leading option/i
const sendChip = vi.fn()

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
  sendChip.mockReset()
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
  useGuidanceStore.setState({ _sendChip: null })
})

describe('§0 the fixture IS the route body, byte for byte', () => {
  it('re-derives the sha256 of the route bytes and is marked route-generated, not live', () => {
    for (const fixture of [explicitRun, blockedRun] as Wire[]) {
      const { body, provenance } = routeBody(fixture)
      expect(createHash('sha256').update(JSON.stringify(body), 'utf8').digest('hex')).toBe(provenance.route_body_sha256)
      expect(String(provenance.kind)).toMatch(/^ROUTE-GENERATED WITH A SCRIPTED MODEL — NOT A LIVE CAPTURE/)
      expect(String(provenance.producer)).toContain('c933aabfaffb4cac5572b7962d9e3a3658996de0')
    }
  })

  it('production defaults are what this spec measures: promotion OFF, compact coaching lines ON', () => {
    expect(RUN_TURN_COACHING_PROMOTION_ENABLED).toBe(false)
    expect(isCompactCoachingLinesEnabled()).toBe(true)
  })
})

describe('§1 the explicit Run: the route states a CURRENT run, and the store takes it', () => {
  it('card created_at = run_state.computed_at; card hash = graph_hash = analysis_ready.current_graph_hash', async () => {
    const { body } = routeBody(explicitRun as Wire)
    const card = cardOf(body)
    const state = body.analysis_state as { run_state: { kind: string; computed_at: string } }
    const ready = body.analysis_ready as { current_graph_hash: string }
    expect(card.source_handler).toBe('run_analysis')
    expect(card.freshness).toBe('fresh')
    expect(card.signal_id.endsWith(':explicit_run')).toBe(true)
    expect(state.run_state.kind).toBe('complete_current')
    expect(card.created_at).toBe(state.run_state.computed_at)
    expect(card.graph_hash_at_generation).toBe(body.graph_hash)
    expect(card.graph_hash_at_generation).toBe(ready.current_graph_hash)

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
    // 93 words as read (95 whitespace tokens in the raw text, 2 of them bullet markers).
    expect(words(rendered)).toBe(93)
    expect(screen.queryByTestId('answer-body'), 'no _answer_shape on the wire, so no concise view').toBeNull()
  })

  it('the card is on the face as ONE collapsed line whose words are the producer title, verbatim', async () => {
    const { body } = routeBody(explicitRun as Wire)
    const card = cardOf(body)
    renderThread(await messageFrom(body))
    const line = screen.getByTestId(`coaching-line-${card.block_id}`) as HTMLDetailsElement
    expect(line.tagName).toBe('DETAILS')
    expect(line.open, 'promotion OFF: the card is a closed line, not an expanded face').toBe(false)
    expect(screen.getByTestId(`coaching-line-summary-${card.block_id}`).textContent?.trim()).toBe(card.title)
    // Nothing hides it further: two blocks on this turn, both top-level points.
    expect(screen.queryByTestId('block-detail-toggle')).toBeNull()
  })

  it('opened: the verbatim body and action, CURRENT (no notice), the chip enabled; one click sends action_prompt verbatim, once', async () => {
    const { body } = routeBody(explicitRun as Wire)
    const card = cardOf(body)
    renderThread(await messageFrom(body))
    const line = screen.getByTestId(`coaching-line-${card.block_id}`) as HTMLDetailsElement
    expect(line.open).toBe(false)
    fireEvent.click(screen.getByTestId(`coaching-line-summary-${card.block_id}`))
    expect(line.open, 'one click on the line opens the card').toBe(true)
    const cardEl = line.querySelector(`[data-block-id="${card.block_id}"]`) as HTMLElement
    expect(cardEl).not.toBeNull()
    expect(cardEl.getAttribute('data-currency')).toBe('current')
    expect(cardEl.getAttribute('data-run-turn-reason')).toBeNull()
    expect(within(cardEl).queryByTestId('v5-coaching-freshness'), 'current: no notice').toBeNull()
    expect(within(cardEl).getByTestId('v5-coaching-body').textContent).toBe(card.body)
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

  it('CONTROL (the "current" verdict is not vacuous): the same card after a LATER run on the same model speaks the earlier-run notice and its action goes inert', async () => {
    const { body } = routeBody(explicitRun as Wire)
    const card = cardOf(body)
    const msg = await messageFrom(body)
    const verdict = useCanvasStore.getState().analysisStateV1
    expect(verdict).not.toBeNull()
    useCanvasStore.setState({
      analysisStateV1: { ...verdict!, run_state: { kind: 'complete_current', computed_at: '2026-09-24T17:02:11.004Z' } } as typeof verdict,
    })
    renderThread(msg)
    const cardEl = screen
      .getByTestId(`coaching-line-${card.block_id}`)
      .querySelector(`[data-block-id="${card.block_id}"]`) as HTMLElement
    expect(cardEl.getAttribute('data-currency')).toBe('changed')
    expect(cardEl.getAttribute('data-run-turn-reason')).toBe('earlier_run')
    expect(within(cardEl).getByTestId('v5-coaching-freshness').textContent).toBe(RUN_TURN_NOTICE.earlier_run)
    const chip = within(cardEl).getByTestId('v5-coaching-action') as HTMLButtonElement
    expect(chip.disabled).toBe(true)
    fireEvent.click(chip)
    expect(sendChip).not.toHaveBeenCalled()
  })

  it('no fabricated action: the route offered no suggested action on the completed Run, so no chip row renders', async () => {
    const { body } = routeBody(explicitRun as Wire)
    expect(body.suggested_actions).toEqual([])
    const msg = await messageFrom(body)
    expect(msg.actionChips).toBeUndefined()
    renderThread(msg)
    expect(screen.queryByTestId('suggested-chips')).toBeNull()
  })

  it('the run’s own result card renders beside it (summary, tentative copy, per-option frequencies)', async () => {
    const { body } = routeBody(explicitRun as Wire)
    renderThread(await messageFrom(body))
    expect(screen.getByTestId('v5-analysis-result-summary').textContent).toMatch(/^Ran analysis on your current scenario\. One limit on your model could not be checked/)
    expect(screen.getByTestId('v5-analysis-result-uncertainty-copy').textContent).toBe('This result is tentative. The uncertainty is substantial.')
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
