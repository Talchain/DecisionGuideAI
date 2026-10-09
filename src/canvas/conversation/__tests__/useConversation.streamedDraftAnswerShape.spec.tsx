/**
 * DL: first streamed draft -> real SSE consumer/caller/parser/useConversation -> MessageBubble.
 * Captured payload: /private/tmp/accel-cs-contract-fixtures/p02-fwC2-draft.json
 * sha256: e6781936c7de561b9fb3e8362a4f776d57bfe689f26b48e2dc2f8b8c05d26158
 * The capture is a projection: supply only the four required envelope fields
 * it omits. Every captured field is retained; assistant_text is unchanged.
 * DGAI_ROW_DROP_ANSWER_SHAPE=1 stubs the real hook's extractor to null for
 * the requested caller-path mutant, without editing production source.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { useConversation } from '../useConversation'
import { MessageBubble } from '../MessageBubble'
import { useCanvasStore } from '../../store'
import { useDraftStore } from '../../stores/draftStore'
import { ADDITIVE_EXTENSIONS_KEY } from '../../../v5/responseParser'
import { OPEN_QUESTIONS_LABEL, SERVER_OPEN_QUESTIONS_MARKER } from '../serverOpenQuestions'

const seams = vi.hoisted(() => ({ openStream: vi.fn(), bufferedTurn: vi.fn(), extract: vi.fn() }))
vi.mock('../../../v5/streamedTurnTransport', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../v5/streamedTurnTransport')>()
  return { ...actual, openV5TurnStream: (...args: unknown[]) => seams.openStream(...args) }
})
vi.mock('../../../v5/v5Adapter', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../v5/v5Adapter')>()
  return {
    ...actual,
    callV5Turn: (...args: unknown[]) => seams.bufferedTurn(...args),
    getV5Endpoint: () => 'https://cee.test/proxy/v5/turn',
  }
})
vi.mock('../../../v5/eligibility', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../v5/eligibility')>()
  return { ...actual, isV5Eligible: () => ({ eligible: true }) }
})
vi.mock('../../../lib/supabase', () => ({
  getUserId: async () => null,
  getSessionIdentity: async () => ({ userId: null, accessToken: null }),
}))
vi.mock('../../../services/scenarioService', () => ({ loadScenario: async () => null }))
vi.mock('../answerShape', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../answerShape')>()
  return {
    ...actual,
    extractAnswerShapeSidecar: (response: unknown) => {
      seams.extract(response)
      return process.env.DGAI_ROW_DROP_ANSWER_SHAPE === '1'
        ? null
        : actual.extractAnswerShapeSidecar(response)
    },
  }
})

// Embedded verbatim so this one spec does not depend on an untracked fixture file.
const CAPTURE = {
 "assistant_text": "I’ve drafted the decision model, but it cannot yet answer the price question reliably.\n\nThe arithmetic still answers part of this. If MRR is Pro plan price × Pro paying subscribers (Olumi’s reading of your goal): at 49 £/subscriber/month and 300 Pro paying subscribers (Olumi’s estimate), MRR is 14,700 £/month today. At 59 £/subscriber/month, MRR stays at least that while 250 or more of the 300 stay (a loss of at most 50). At 54 £/subscriber/month (Olumi’s estimate), MRR stays at least that while 273 or more of the 300 stay (a loss of at most 27). 20,000 £/month needs 339 at 59 £/subscriber/month, 371 at 54 £/subscriber/month or 409 at 49 £/subscriber/month. This is arithmetic on these figures, not the analysis ranking the options, and it says nothing about how many will stay.\n\n- The £20k/month target and under-4% churn limit are included.\n- A provisional first pass cannot put an option forward: the price–subscriber trade-off is unconfirmed.\n- Current MRR is also needed to test the target.\n\n\"Olumi reads ‘MRR’ as ‘Pro plan price’ × ‘Pro paying subscribers’. Is that how you work it out?\" Please confirm on the button.\n\nThis run doesn’t show how often each option reaches the goal’s target. Olumi reads 'MRR' as 'Pro plan price' × 'Pro paying subscribers', but that hasn't been confirmed, so this run gives no chance of reaching the target for 'MRR'.\n\nOlumi can't show each option's chance of reaching your MRR target yet: the model doesn't have MRR's current level to measure from. The rest of this Run's results still stand. What I proposed above is not made until you approve it. Questions this model does not answer yet: Does \"MRR\" get there within 12 months? The model holds the deadline; no result answers that yet. Olumi reads \"MRR\" as depending on \"Pro plan price\" times \"Pro paying subscribers\". 8 more questions remain unresolved.",
 "_answer_shape": null,
 "suggested_actions": [
  {
   "id": "agent-approve-proposal:prop_073b18d242f4feb1b6f70fc401296388",
   "label": "Yes, that's how",
   "message": "Yes — Olumi reads ‘MRR’ as ‘Pro plan price’ × ‘Pro paying subscribers’. Is that how you work it out?",
   "detail": "Olumi reads ‘MRR’ as ‘Pro plan price’ × ‘Pro paying subscribers’. Is that how you work it out?"
  },
  {
   "id": "agent-amend-proposal",
   "label": "Change something first",
   "message": "Before you apply it, I want to change some of it."
  },
  {
   "id": "agent-decline-proposal:prop_073b18d242f4feb1b6f70fc401296388",
   "label": "Not now",
   "message": "Not now."
  }
 ],
 "pending_actions": null,
 "guidance": null,
 "analysis_ready": {
  "options": [
   {
    "option_id": "keep_49_pro_price",
    "label": "Keep £49 Pro price",
    "status": "ready",
    "interventions": {},
    "is_baseline": true,
    "status_reason": "Baseline: every factor holds at its observed value, so no effect values are needed"
   },
   {
    "option_id": "59_pro_price_at_release",
    "label": "£59 Pro price at release",
    "status": "ready",
    "interventions": {
     "pro_plan_price": 0.295
    },
    "is_baseline": false,
    "intervention_details": {
     "pro_plan_price": {
      "display_value": "£59/subscriber/month",
      "normalised_value": 0.295,
      "raw_value": 59,
      "unit": "£/subscriber/month"
     }
    },
    "raw_interventions": {
     "pro_plan_price": 59
    },
    "status_reason": "1 intervention(s) ready for analysis"
   },
   {
    "option_id": "54_pro_price_at_release",
    "label": "£54 Pro price at release",
    "status": "ready",
    "interventions": {
     "pro_plan_price": 0.27
    },
    "is_baseline": false,
    "intervention_details": {
     "pro_plan_price": {
      "display_value": "£54/subscriber/month",
      "normalised_value": 0.27,
      "raw_value": 54,
      "unit": "£/subscriber/month"
     }
    },
    "raw_interventions": {
     "pro_plan_price": 54
    },
    "status_reason": "1 intervention(s) ready for analysis"
   }
  ],
  "goal_node_id": "mrr",
  "status": "ready",
  "goal_threshold": 0.8,
  "goal_threshold_raw": 20000,
  "goal_threshold_unit": "£/month",
  "goal_threshold_cap": 25000,
  "goal_threshold_cap_provenance": "target_derived_headroom",
  "bias_findings": [],
  "may_run": true,
  "analysis_admission": {
   "structurally_analysable": true,
   "missing_important_inputs": [],
   "semantic_quality_sufficient": true,
   "permitted_analysis_mode": "comparative_leader",
   "reasons": [
    {
     "field": "structurally_analysable",
     "code": "READY_TO_COMPARE",
     "message": "Analysis can run on this model as it stands."
    },
    {
     "field": "semantic_quality_sufficient",
     "code": "CONFIDENCE_PARAMETERS_PARTLY_USER_STATED",
     "message": "At least one of the estimates this comparison rests on is yours, so a leading option can be named."
    },
    {
     "field": "permitted_analysis_mode",
     "code": "CONFIDENCE_PARAMETERS_PARTLY_USER_STATED",
     "message": "At least one of the estimates this comparison rests on is yours, so a leading option can be named."
    }
   ],
   "graph_hash": "dab6db672ce65d33b906c47c44be37157c09b0551694e296f0195c38c92a7ad7",
   "semantic_signals": {
    "confidence_parameters_total": 12,
    "confidence_parameters_user_stated": 1,
    "confidence_parameters_machine_authored": 9,
    "confidence_parameters_unattributed": 2,
    "material_parameters_total": 8,
    "material_parameters_user_stated": 1,
    "intervened_factor_baselines_total": 1,
    "intervened_factor_baselines_user_stated": 1,
    "material_parameters_awaiting_user_node_ids": [
     "pro_paying_subscribers",
     "monthly_churn"
    ],
    "goal_target_stated": true
   }
  },
  "freshness": "fresh",
  "freshness_reason": "agent_readback_run_state_current",
  "graph_hash_at_run": "dab6db672ce65d33",
  "current_graph_hash": "dab6db672ce65d33",
  "computed_at": "2026-10-08T08:13:38.646Z"
 }
}

const HEADLINE = 'I’ve drafted the decision model, but it cannot yet answer the price question reliably.'
const BULLETS = [
  'The arithmetic still answers part of this.',
  'If MRR is Pro plan price × Pro paying subscribers (Olumi’s reading of your goal): at 49 £/subscriber/month and 300 Pro paying subscribers (Olumi’s estimate), MRR is 14,700 £/month today.',
]
const PREFIX = `${HEADLINE}\n\n${BULLETS.join(' ')} `
const SHAPE = { headline: HEADLINE, bullets: BULLETS, detail: CAPTURE.assistant_text.slice(PREFIX.length) }
const DETAIL_SENTENCES = [
  'At 59 £/subscriber/month, MRR stays at least that while 250 or more of the 300 stay (a loss of at most 50).',
  'At 54 £/subscriber/month (Olumi’s estimate), MRR stays at least that while 273 or more of the 300 stay (a loss of at most 27).',
  '20,000 £/month needs 339 at 59 £/subscriber/month, 371 at 54 £/subscriber/month or 409 at 49 £/subscriber/month.',
  'This is arithmetic on these figures, not the analysis ranking the options, and it says nothing about how many will stay.',
  'The £20k/month target and under-4% churn limit are included.',
  'A provisional first pass cannot put an option forward: the price–subscriber trade-off is unconfirmed.',
  'Current MRR is also needed to test the target.',
  '"Olumi reads ‘MRR’ as ‘Pro plan price’ × ‘Pro paying subscribers’. Is that how you work it out?"',
  'Please confirm on the button.',
  'This run doesn’t show how often each option reaches the goal’s target.',
  "Olumi reads 'MRR' as 'Pro plan price' × 'Pro paying subscribers', but that hasn't been confirmed, so this run gives no chance of reaching the target for 'MRR'.",
  "Olumi can't show each option's chance of reaching your MRR target yet: the model doesn't have MRR's current level to measure from.",
  "The rest of this Run's results still stand.",
  'What I proposed above is not made until you approve it.',
  'Does "MRR" get there within 12 months?',
  'The model holds the deadline; no result answers that yet.',
  'Olumi reads "MRR" as depending on "Pro plan price" times "Pro paying subscribers".',
  '8 more questions remain unresolved.',
]
const OPEN_QUESTION_SENTENCES = DETAIL_SENTENCES.slice(-4)
const BODY_DETAIL_SENTENCES = DETAIL_SENTENCES.slice(0, -4)
const CONFIRMATION_SENTENCES = [
  '"Olumi reads ‘MRR’ as ‘Pro plan price’ × ‘Pro paying subscribers’.',
  'Is that how you work it out?"',
]
const ASSISTANT_SENTENCES = [
  HEADLINE, ...BULLETS, ...DETAIL_SENTENCES.slice(0, 7),
  ...CONFIRMATION_SENTENCES, ...DETAIL_SENTENCES.slice(8),
]
// Reconstruct the complete source detail, including its markdown and heading,
// so the sentence ledger cannot silently omit any captured prose.
const COMPLETE_DETAIL = [
  DETAIL_SENTENCES.slice(0, 4).join(' '),
  DETAIL_SENTENCES.slice(4, 7).map(sentence => `- ${sentence}`).join('\n'),
  DETAIL_SENTENCES.slice(7, 9).join(' '),
  DETAIL_SENTENCES.slice(9, 11).join(' '),
  [...DETAIL_SENTENCES.slice(11, 14), SERVER_OPEN_QUESTIONS_MARKER, ...OPEN_QUESTION_SENTENCES].join(' '),
].join('\n\n')
const SCENARIO = 'a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e4'
const BRIEF = 'Model raising our Pro plan price from £49 to £59, with £54 as an alternative, aiming for £20k MRR within 12 months and under 4% churn.'
const noop = async () => {}
let conversation: ReturnType<typeof useConversation>

function ConversationWitness() {
  conversation = useConversation()
  return <>{conversation.messages.map(message => (
    <MessageBubble key={message.id} message={message} onChipClick={noop} />
  ))}</>
}

const frame = (payload: Record<string, unknown>) => `event: stage\ndata: ${JSON.stringify(payload)}\n\n`
const prose = (text: string | null) => (text ?? '').replace(/\s+/g, ' ').trim()
// Mirror ONLY safeRichText.ts:229-230's dash rule; do not apply its other transforms.
const rendererDashes = (text: string) => text.replace(/[\u2012\u2013\u2014\u2015]/g, ' - ')

async function runFirstStreamedDraft(withShape: boolean) {
  const withoutShape: Record<string, unknown> = { ...CAPTURE }
  delete withoutShape._answer_shape
  const payload = {
    response_version: 2,
    blocks: [],
    insights: [],
    stage_indicator: 'analyse',
    ...withoutShape,
    ...(withShape ? { _answer_shape: SHAPE } : {}),
  }
  expect(payload.assistant_text).toBe(CAPTURE.assistant_text)
  expect(CAPTURE.assistant_text.startsWith(PREFIX)).toBe(true)
  expect(PREFIX + SHAPE.detail).toBe(CAPTURE.assistant_text)
  expect(SHAPE.detail).toBe(COMPLETE_DETAIL)
  expect(CONFIRMATION_SENTENCES.join(' ')).toBe(DETAIL_SENTENCES[7])
  for (const sentence of DETAIL_SENTENCES) expect(SHAPE.detail).toContain(sentence)

  let controller!: ReadableStreamDefaultController<Uint8Array>
  const body = new ReadableStream<Uint8Array>({ start(c) { controller = c } })
  seams.openStream.mockResolvedValue(new Response(body, {
    status: 200, headers: { 'content-type': 'text/event-stream' },
  }))
  render(<ConversationWitness />)
  expect(conversation.messages).toHaveLength(0)
  expect(useCanvasStore.getState().nodes).toHaveLength(0)
  let sent!: Promise<void>
  await act(async () => {
    sent = conversation.sendMessage(BRIEF, { turnType: 'explicit_generate' }) as Promise<void>
  })
  expect(seams.openStream).toHaveBeenCalledTimes(1)
  expect(seams.openStream.mock.calls[0][0]).toMatchObject({
    kind: 'message', scenario_id: SCENARIO, turn_class: 'frame', message: BRIEF,
  })
  expect(screen.getByTestId('message-user')).toHaveTextContent(BRIEF)
  const encoder = new TextEncoder()
  await act(async () => {
    controller.enqueue(encoder.encode(frame({ stage: 'DRAFTING', seq: 0, status: 'in_progress' })))
    await new Promise(resolve => setTimeout(resolve, 0))
  })
  expect(screen.queryByTestId('message-answer-structured')).toBeNull()
  await act(async () => {
    controller.enqueue(encoder.encode(frame({
      stage: 'COMPLETE', seq: 1, status: 'complete', status_code: 200, payload,
    })))
    controller.close()
    await sent
  })
  expect(seams.bufferedTurn).not.toHaveBeenCalled()
  expect(seams.extract).toHaveBeenCalledTimes(1)
  const parsed = seams.extract.mock.calls[0][0]
  expect(parsed.assistant_text).toBe(CAPTURE.assistant_text)
  expect(parsed[ADDITIVE_EXTENSIONS_KEY]?._answer_shape).toEqual(withShape ? SHAPE : undefined)
  const assistants = conversation.messages.filter(message => message.role === 'assistant')
  expect(assistants).toHaveLength(1)
  expect(assistants[0].content).toBe(CAPTURE.assistant_text)
  expect(assistants[0].isStreaming).toBeFalsy()
  return assistants[0]
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
  localStorage.clear()
  sessionStorage.clear()
  useDraftStore.getState().resetDraft()
  useCanvasStore.setState({
    currentScenarioId: SCENARIO,
    nodes: [], edges: [], history: { past: [], future: [] },
    _internal: {
      ...(useCanvasStore.getState() as unknown as { _internal: object })._internal,
      lastHistoryHash: null,
    },
    ceeAnalysisReady: null, lastAuthoritativeGraph: null,
    results: { status: 'idle' } as never,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
  } as never)
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('DL — streamed draft answer shape preserves the exact captured reply', () => {
  it('CONTROL: the same COMPLETE payload without _answer_shape uses the plain body', async () => {
    const message = await runFirstStreamedDraft(false)
    expect(message.answerShape).toBeUndefined()
    expect(screen.queryByTestId('message-answer-structured')).toBeNull()
    expect(screen.queryByTestId('answer-body')).toBeNull()
    expect(within(screen.getByTestId('message-assistant')).getByTestId('message-body-text')).toHaveTextContent(HEADLINE)
    expect(screen.queryByTestId('answer-show-more')).toBeNull()
    console.info('[DGAI_ROW] CONTROL PASS: real streamed draft, plain body, unchanged assistant_text')
  })

  it('ROW: every assistant_text sentence is visible after More detail and open-questions each expand once', async () => {
    const message = await runFirstStreamedDraft(true)
    const bubble = screen.getByTestId('message-assistant')
    const structured = within(bubble).getByTestId('message-answer-structured')
    expect(message.answerShape).toEqual(SHAPE)
    expect(within(bubble).queryByTestId('message-body-text')).toBeNull()
    const headline = within(structured).getByTestId('answer-headline')
    const bullets = within(structured).getByTestId('answer-bullets')
    expect(headline).toBeVisible()
    expect(headline.textContent).toBe(HEADLINE)
    expect(bullets).toBeVisible()
    const bulletItems = [...bullets.querySelectorAll('li')]
    expect(bulletItems.map(item => item.textContent)).toEqual(BULLETS)
    for (const item of bulletItems) expect(item).toBeVisible()
    const more = within(structured).getByTestId('answer-show-more')
    const questionsToggle = within(bubble).getByTestId('message-show-open-questions')
    expect(within(structured).getByRole('button', { name: 'More detail of this answer' })).toBe(more)
    expect(more).toHaveAttribute('aria-label', 'More detail of this answer')
    expect(more).toHaveAttribute('aria-expanded', 'false')
    expect(more).toHaveTextContent('More detail')
    expect(within(structured).queryByTestId('answer-detail')).toBeNull()
    expect(questionsToggle).toHaveAttribute('aria-expanded', 'false')
    expect(questionsToggle).toHaveTextContent(OPEN_QUESTIONS_LABEL)
    expect(within(bubble).queryByTestId('message-open-questions')).toBeNull()
    for (const sentence of DETAIL_SENTENCES) {
      expect(rendererDashes(prose(bubble.textContent))).not.toContain(rendererDashes(sentence))
    }
    fireEvent.click(more)
    const detail = within(structured).getByTestId('answer-detail')
    expect(detail).toBeVisible()
    expect(more).toHaveAttribute('aria-expanded', 'true')
    expect(questionsToggle).toHaveAttribute('aria-expanded', 'false')
    expect(within(bubble).queryByTestId('message-open-questions')).toBeNull()
    for (const sentence of OPEN_QUESTION_SENTENCES) {
      expect(rendererDashes(prose(bubble.textContent))).not.toContain(rendererDashes(sentence))
    }
    for (const sentence of BODY_DETAIL_SENTENCES) {
      expect(rendererDashes(prose(detail.textContent))).toContain(rendererDashes(sentence))
    }
    fireEvent.click(questionsToggle)
    const questions = within(bubble).getByTestId('message-open-questions')
    expect(questions).toBeVisible()
    expect(questionsToggle).toHaveAttribute('aria-expanded', 'true')
    expect(more).toHaveAttribute('aria-expanded', 'true')
    expect(detail).toBeVisible()
    expect(headline).toBeVisible()
    for (const item of bulletItems) expect(item).toBeVisible()
    for (const sentence of OPEN_QUESTION_SENTENCES) {
      expect(rendererDashes(prose(questions.textContent))).toContain(rendererDashes(sentence))
    }
    // Read only surfaces just proved visible, rather than arbitrary hidden DOM.
    const visible = rendererDashes(prose([
      headline.textContent, ...bulletItems.map(item => item.textContent),
      detail.textContent, questions.textContent,
    ].join(' ')))
    const missing = ASSISTANT_SENTENCES.filter(sentence => !visible.includes(rendererDashes(sentence)))
    console.info('[DGAI_ROW] ' + JSON.stringify({
      structured: true,
      extractorReceivedExactShape: true,
      assistantTextUnchanged: message.content === CAPTURE.assistant_text,
      moreDetailExpanded: more.getAttribute('aria-expanded'),
      openQuestionsExpanded: questionsToggle.getAttribute('aria-expanded'),
      disclosureClicks: { 'answer-show-more': 1, 'message-show-open-questions': 1 },
      assistantSentenceChunkCount: ASSISTANT_SENTENCES.length,
      detailSentenceCount: DETAIL_SENTENCES.length,
      missingAssistantSentences: missing,
      renderedDetail: prose(detail.textContent),
      renderedOpenQuestions: prose(questions.textContent),
    }))
    for (const sentence of ASSISTANT_SENTENCES) {
      expect.soft(visible, `exact assistant_text sentence must be visible after both disclosures: ${sentence}`)
        .toContain(rendererDashes(sentence))
    }
  })
})
