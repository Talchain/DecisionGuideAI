/**
 * ⭐ D-4 (build train #70 5855068711, slice D row R7): THE CHAT CONSUMES THE PRODUCER'S TYPED BLOCKS WHOLE.
 *
 * Every piece of producer prose on a served turn either reaches the chat thread (at rest, or one press away) or is
 * named below as belonging to another surface, with the reason. A field that is in neither list fails, so a new
 * producer field forces a decision instead of being dropped without anyone noticing.
 *
 * Why this exists: Paul's test (27 Sep, B3) approved a consent chip whose full sentence lived only in a tooltip.
 * That was a whole class (producer text the UI never shows), and until now nothing caught it.
 *
 * Corpus: five served `/proxy/v5/turn` bodies from DL's acceptance runs (fixtures/chat-served-turns.bf-20260927.json,
 * verbatim; the `source` of each names its run and turn). They cover a brief with open questions, analysis runs with
 * coaching and a review card, and replies with suggested actions and an answer shape. They are producer bytes, not
 * fixtures this lane wrote. They go through the SHIPPED chain, the same one `useConversation` runs: parse → route →
 * map → phase-3 bridge → chips → sidecars → `ChatThread`.
 *
 * Measured at authoring (49 served turns, 6 runs, 26 Sep 22:58Z → 27 Sep 10:14Z): 0 user-facing leaves unreached.
 * The open questions are 55/55 one press away.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'

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
import { extractOpenQuestionListSidecar, SERVER_OPEN_QUESTIONS_MARKER } from '../serverOpenQuestions'
import { ChatThread } from '../zones/ChatThread'
import type { ConversationMessage } from '../types'

import served from './fixtures/chat-served-turns.bf-20260927.json'

type Wire = Record<string, unknown>

/** Producer prose the chat must show: at rest, or one press away. */
const IN_CHAT = new Set([
  'blocks[].summary',
  'blocks[].title',
  'blocks[].body',
  'blocks[].action_label',
  'blocks[].target_refs[].label',
  '_answer_shape.headline',
  '_answer_shape.bullets[]',
  '_answer_shape.detail',
  '_agent.open_questions[]',
  'suggested_actions[].label',
  'suggested_actions[].detail',
])

/** Producer prose that is deliberately NOT the chat's to show, and why. */
const ELSEWHERE: ReadonlyArray<{ prefix: string; why: string }> = [
  { prefix: 'blocks[].enrichment.', why: 'the analysis detail; the Analysis panel / Reasoning tab (Panel, slice D-4) shows it' },
  { prefix: 'blocks[].action_prompt', why: 'the message a coaching action SENDS as the user\'s words; its label is shown' },
  { prefix: 'suggested_actions[].message', why: 'the message a chip SENDS as the user\'s words; it enters the thread when pressed' },
]

/** Fold typography the renderer is allowed to change (house dash style, markdown marks, smart quotes). */
const norm = (s: string) =>
  s
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s*[-–—]\s*/g, '-')
    .replace(/[#*_`>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

/** Every prose leaf (a paragraph of ≥ 12 chars with a space), by field path. */
function proseLeaves(x: unknown, path: string, out: Array<{ path: string; text: string }>): void {
  if (typeof x === 'string') {
    for (const para of x.split(/\n\s*\n|\n(?=[-*] )/)) {
      const t = para.trim()
      if (t.length >= 12 && /\s/.test(t)) out.push({ path, text: t })
    }
    return
  }
  if (Array.isArray(x)) return x.forEach((v) => proseLeaves(v, `${path}[]`, out))
  if (x && typeof x === 'object') for (const [k, v] of Object.entries(x)) proseLeaves(v, `${path}.${k}`, out)
}

async function messageFrom(body: Wire): Promise<ConversationMessage> {
  const res = new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
  const target = routeV5Response(await parseV5Response(res))
  if (target.kind !== 'blocks' && target.kind !== 'text_only') throw new Error(`routed to ${target.kind}`)
  const response = target.response
  const mapped = target.kind === 'blocks' ? mapV5Blocks(response.blocks, response.suggested_actions) : []
  const phase3 = extractPhase3FromV5Response(response)
  const fact = deriveV5AnalysisFactUpdate(response, phase3)
  const blocks = composePhase3BridgedBlocks(fact.action === 'set', phase3.rawBlocks, mapped)
  const actionChips = buildSuggestedActionChips(response.blocks, response.suggested_actions)
  const answerShape = extractAnswerShapeSidecar(response)
  const openQuestionList = extractOpenQuestionListSidecar(response)
  return {
    id: 'a1',
    role: 'assistant',
    content: response.assistant_text,
    blocks,
    ...(actionChips.length > 0 ? { actionChips } : {}),
    ...(answerShape ? { answerShape } : {}),
    ...(openQuestionList ? { openQuestionList } : {}),
    timestamp: new Date('2026-09-27T10:14:47Z'),
  } as ConversationMessage
}

function renderThread(assistant: ConversationMessage): HTMLElement {
  const messages = [
    { id: 'u1', role: 'user', content: 'x', timestamp: new Date('2026-09-27T10:14:40Z') },
    assistant,
  ] as ConversationMessage[]
  const { container } = render(
    <ChatThread
      {...({
        messages,
        isThinking: false,
        longRunningHint: null,
        nodeCount: 12,
        patchBlockStates: new Map(),
        patchRejections: new Map(),
        onChipClick: vi.fn(async () => {}),
        onPatchAccept: () => {},
        onPatchDismiss: () => {},
        onFeedback: () => {},
        onRetry: () => {},
        compact: true,
      } as unknown as React.ComponentProps<typeof ChatThread>)}
    />,
  )
  return container
}

/** What a reader can reach: visible text, plus the names and descriptions assistive tech reads. */
function reachable(root: HTMLElement): string {
  const parts = [root.textContent ?? '']
  root.querySelectorAll('*').forEach((el) => {
    for (const a of ['title', 'aria-label', 'aria-description']) {
      const v = el.getAttribute(a)
      if (v) parts.push(v)
    }
  })
  return norm(parts.join(' \n '))
}

/** Open every disclosure on the message (each press can reveal another). */
function openEverything(root: HTMLElement): void {
  for (let i = 0; i < 6; i++) {
    const closed = Array.from(root.querySelectorAll<HTMLElement>('[aria-expanded="false"]'))
    if (closed.length === 0) return
    closed.forEach((b) => fireEvent.click(b))
  }
}

afterEach(() => cleanup())

describe('D-4: the chat shows every piece of producer prose on a served turn, or names the surface that does', () => {
  const turns = served as Array<{ source: string; body: Wire }>

  it('the corpus is the five served turns, all OpenAI where a model was called', () => {
    expect(turns).toHaveLength(5)
    for (const t of turns) {
      for (const p of (t.body._provider_calls as Array<{ provider?: string }> | undefined) ?? []) expect(p.provider, t.source).toBe('openai')
    }
  })

  it('every prose field is classified: shown in the chat, or named as another surface\'s', () => {
    const unclassified = new Set<string>()
    for (const { body } of turns) {
      const leaves: Array<{ path: string; text: string }> = []
      proseLeaves(body.blocks, 'blocks', leaves)
      proseLeaves(body.suggested_actions, 'suggested_actions', leaves)
      proseLeaves(body._answer_shape, '_answer_shape', leaves)
      proseLeaves((body._agent as Wire | undefined)?.open_questions, '_agent.open_questions', leaves)
      for (const { path } of leaves) {
        if (!IN_CHAT.has(path) && !ELSEWHERE.some((e) => path.startsWith(e.prefix))) unclassified.add(path)
      }
    }
    expect([...unclassified], 'a producer prose field no list names: decide whether the chat shows it').toEqual([])
  })

  it.each(turns.map((t, i) => [i, t.source, t.body] as const))('turn %i reaches the screen whole (%s)', async (_i, source, body) => {
    Element.prototype.scrollIntoView = vi.fn()
    const leaves: Array<{ path: string; text: string }> = []
    proseLeaves(body.blocks, 'blocks', leaves)
    proseLeaves(body.suggested_actions, 'suggested_actions', leaves)
    proseLeaves(body._answer_shape, '_answer_shape', leaves)
    proseLeaves((body._agent as Wire | undefined)?.open_questions, '_agent.open_questions', leaves)
    const owed = leaves.filter(
      (l) =>
        IN_CHAT.has(l.path) &&
        // The in-prose question list is replaced by the typed `_agent.open_questions` list, checked on its own path.
        !(l.path === '_answer_shape.detail' && l.text.includes(SERVER_OPEN_QUESTIONS_MARKER)),
    )
    expect(owed.length, `${source}: nothing to check`).toBeGreaterThan(0)

    const root = renderThread(await messageFrom(body))
    openEverything(root)
    const screen = reachable(root)
    const missing = owed.filter((l) => !screen.includes(norm(l.text).slice(0, 80))).map((l) => `${l.path}: ${l.text.slice(0, 120)}`)
    expect(missing, source).toEqual([])
  })
})
