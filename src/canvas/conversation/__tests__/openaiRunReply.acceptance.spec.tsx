/**
 * SHARED ACCEPTANCE FIXTURE (AI Conversation × AI Quality): the OpenAI-path Run
 * reply, rendered by the SHIPPED chain.
 *
 * Fixtures: AI Quality's route captures at served CEE 57f903c
 * (olumi-assistants-service PR #1852), `/proxy/v5/turn` with
 * `x-olumi-ai-mode: openai`, all-OpenAI asserted per turn. They are records of
 * what the deployed producer emitted and are read-only here.
 *
 * WHAT THIS PINS (programme-docs #63 5821253411):
 *   §1 the complete Run's reply renders VERBATIM — conclusion and its caveat in
 *      the opening sentence, all three bullets, the next-step paragraph — with
 *      no UI truncation and no UI-invented bullets or headline;
 *   §2 no action is fabricated: the producer offered none on the complete Run,
 *      so none renders (the missing next move is a producer gap, routed);
 *   §3 the blocked Run's one producer chip renders and sends its own message;
 *   §4 when the producer adds `_answer_shape`, the SAME surface switches to the
 *      concise view (headline + ≤3 bullets, detail behind "Show more") — the UI
 *      half of the length fix is already live and waits only on the producer.
 *
 * No model calls: jsdom, fixture-only.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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
import {
  extractPhase3FromV5Response,
  deriveV5AnalysisFactUpdate,
} from '../../../v5/extractPhase3FromV5Response'
import { buildSuggestedActionChips } from '../../../v5/blocks/suggestedActionChips'
import { composePhase3BridgedBlocks } from '../useConversation'
import { extractAnswerShapeSidecar } from '../answerShape'
import { ChatThread } from '../zones/ChatThread'
import type { ConversationMessage } from '../types'

import runComplete from './fixtures/openai-agent-run-complete.aiq-57f903c.json'
import runBlocked from './fixtures/openai-agent-run-blocked.aiq-57f903c.json'

type Wire = Record<string, unknown>

function wireBody(capture: Wire): Wire {
  const copy = JSON.parse(JSON.stringify(capture)) as Wire
  for (const k of Object.keys(copy)) if (k.startsWith('__')) delete copy[k]
  return copy
}

/** The shipped chain, then the message exactly as `useConversation` builds it. */
async function messageFrom(body: Wire): Promise<ConversationMessage> {
  const res = new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
  const target = routeV5Response(await parseV5Response(res))
  if (target.kind !== 'blocks' && target.kind !== 'text_only') throw new Error(target.kind)
  const response = target.response
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
    timestamp: new Date('2026-09-24T19:20:51Z'),
  } as ConversationMessage
}

function renderThread(assistant: ConversationMessage, onChipClick = vi.fn(async (_chip: unknown) => {})) {
  const messages = [
    { id: 'u1', role: 'user', content: 'Run analysis', timestamp: new Date('2026-09-24T19:20:40Z') },
    assistant,
  ] as ConversationMessage[]
  render(
    <ChatThread
      {...({
        messages,
        isThinking: false,
        longRunningHint: null,
        nodeCount: 12,
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

const flat = (s: string) => s.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim()

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
})
afterEach(() => cleanup())

describe('§1 the complete OpenAI Run reply renders verbatim, conclusion + caveat first', () => {
  it('opening sentence carries the conclusion AND its caveat; every bullet and the next step render; nothing clamped', async () => {
    const body = wireBody(runComplete as Wire)
    const text = String(body.assistant_text)
    renderThread(await messageFrom(body))
    const thread = flat(screen.getByTestId('chat-thread').textContent ?? '')

    const opening = flat(text.split('\n')[0])
    expect(opening).toMatch(/^This run does not establish whether you should raise Pro to £59, because it could not test the stated churn limit/)
    expect(thread).toContain(opening.slice(0, 120))
    for (const bullet of text.split('\n').filter((l) => l.startsWith('- '))) {
      expect(thread).toContain(flat(bullet.slice(2)).slice(0, 60))
    }
    expect(thread).toContain('The next useful reasoning step is to define the churn constraint')
    expect(screen.queryByTestId('answer-body')).toBeNull()
  })
})

describe('§2 no fabricated action on the complete Run', () => {
  it('the producer offered no action, so no suggested chip and no coaching action renders', async () => {
    const msg = await messageFrom(wireBody(runComplete as Wire))
    expect(msg.actionChips).toBeUndefined()
    renderThread(msg)
    expect(screen.queryByTestId('suggested-chips')).toBeNull()
    expect(screen.queryByTestId('v5-coaching-action')).toBeNull()
  })
})

describe('§3 the blocked Run keeps its one producer action', () => {
  it('"Suggest what it still needs" renders and sends the producer message verbatim', async () => {
    const body = wireBody(runBlocked as Wire)
    const { onChipClick } = renderThread(await messageFrom(body))
    const row = screen.getByTestId('suggested-chips')
    const chip = within(row).getByRole('button', { name: 'Suggest what it still needs' })
    fireEvent.click(chip)
    expect(onChipClick).toHaveBeenCalledTimes(1)
    expect(onChipClick.mock.calls[0][0]).toMatchObject({
      id: 'agent-suggest-what-it-needs',
      message: 'Suggest what this model still needs before the analysis can run, so I can approve it.',
    })
    expect(within(row).queryByRole('button', { name: /run analysis/i })).toBeNull()
  })
})

describe('§4 the concise view lights up the moment the producer sends `_answer_shape`', () => {
  it('headline + ≤3 bullets on the face, detail behind "Show more" — the free text is replaced, not truncated', async () => {
    const body = wireBody(runComplete as Wire)
    body._answer_shape = {
      headline: 'This run does not establish whether you should raise Pro to £59, because it could not test the stated churn limit.',
      bullets: [
        '£59-at-release ranked highest in 83% of simulated runs on the MRR-only scale.',
        'The churn limit (< 4%) was unscored, so compliance is unknown.',
        'It rests on adopted assumptions: 3% churn, 250 Pro subscribers, £49 MRR each.',
        'A fourth bullet the UI must not show on the face.',
      ],
      detail: String(body.assistant_text),
    }
    renderThread(await messageFrom(body))
    expect(screen.getByTestId('answer-headline').textContent).toMatch(/^This run does not establish/)
    expect(screen.getByTestId('answer-bullets').querySelectorAll('li')).toHaveLength(3)
    expect(screen.queryByTestId('answer-detail')).toBeNull()
    fireEvent.click(screen.getByTestId('answer-show-more'))
    expect(screen.getByTestId('answer-detail').textContent).toContain('define the churn constraint')
  })
})
