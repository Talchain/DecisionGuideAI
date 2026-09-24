/**
 * AI CONVERSATION — served-browser witness probe (#1961 + #1966).
 *
 * A module under the Vite root, so the REAL components render with the REAL
 * stylesheet in a real Chromium (same technique as e2e/geometry/coachingLineProbe.ts).
 * Content is the dated live capture `w998-2026-08-16-a1-turn3.json`, fed to the
 * SHIPPED adapters; the capture is never written. No model calls: nothing here
 * touches a network endpoint (the run chip's dispatcher is a local recorder).
 */
import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { V5CoachingBlock } from '../../src/v5/blocks/V5CoachingBlock'
import { V5EvidenceBlock } from '../../src/v5/blocks/V5EvidenceBlock'
import { adaptTypedCoachingBlock, adaptTypedEvidenceBlock } from '../../src/v5/phase3TypedBlocks'
import { ConversationPanel } from '../../src/canvas/conversation/ConversationPanel'
import { ToastProvider } from '../../src/canvas/ToastContext'
import { useCanvasStore } from '../../src/canvas/store'
import { useGuidanceStore } from '../../src/canvas/stores/guidanceStore'
import capture from '../../src/lib/coherence/__tests__/fixtures/captures/w998-2026-08-16-a1-turn3.json'

const settle = () => new Promise((r) => setTimeout(r, 400))
const W = 416
let root: Root | null = null

function host(): HTMLElement {
  document.getElementById('aic-host')?.remove()
  const el = document.createElement('div')
  el.id = 'aic-host'
  el.style.cssText = `position:fixed;top:0;left:0;width:${W}px;max-height:900px;overflow:auto;z-index:99999;background:#fff;padding:12px;display:flex;flex-direction:column;gap:12px`
  document.body.appendChild(el)
  return el
}

function rawBlocks(): Array<Record<string, unknown>> {
  return ((capture as { blocks?: unknown[] }).blocks ?? []) as Array<Record<string, unknown>>
}

/** Cards: first action-bearing coaching card + first evidence card, CEE hash current or moved. */
export async function renderCards(modelMoved: boolean): Promise<{ disabled: boolean | null; notice: string | null; describedBy: string | null; evidenceTag: string | null; evidenceClass: string | null }> {
  const hash = String((capture as { graph_hash?: string }).graph_hash)
  useCanvasStore.setState({
    analysisFreshness: { freshness: 'fresh', currentGraphHash: modelMoved ? 'hash-after-edit' : hash },
    analysisFreshnessDirty: false,
  } as never)
  useGuidanceStore.setState({ _sendChip: () => undefined } as never)
  const coaching = rawBlocks().map(adaptTypedCoachingBlock).find((b) => b && b.action_prompt)
  const evidence = rawBlocks().map(adaptTypedEvidenceBlock).find(Boolean)
  const el = host()
  root?.unmount()
  root = createRoot(el)
  root.render(
    createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
      coaching ? createElement(V5CoachingBlock, { block: coaching }) : null,
      evidence ? createElement(V5EvidenceBlock, { block: evidence }) : null,
    ),
  )
  await settle()
  const chip = el.querySelector('[data-testid="v5-coaching-action"]') as HTMLButtonElement | null
  const notice = el.querySelector('[data-testid="v5-coaching-freshness"]')
  const ev = el.querySelector('[data-testid="v5-evidence-action"]') as HTMLElement | null
  return {
    disabled: chip ? chip.disabled : null,
    notice: notice?.textContent ?? null,
    describedBy: chip?.getAttribute('aria-describedby') ?? null,
    evidenceTag: ev?.tagName ?? null,
    evidenceClass: ev?.className ?? null,
  }
}

/** The real ConversationPanel, a Run chip offered, and a closed gate (empty canvas). */
export async function renderRunChipRefusal(): Promise<{ dispatched: number; refusalShown: boolean }> {
  let dispatched = 0
  useCanvasStore.setState({
    nodes: [], edges: [],
    results: { status: 'idle' },
    ceeAnalysisReady: { goal_node_id: 'g', status: 'ready', options: [] },
  } as never)
  const conversation = {
    messages: [
      { id: 'u1', role: 'user', content: 'Help me decide', timestamp: new Date() },
      { id: 'a1', role: 'assistant', content: 'Your model is ready to analyse.', timestamp: new Date(),
        actionChips: [{ id: 'chip_run', label: 'Run analysis', message: 'Run analysis', action_type: 'run_analysis', intent: 'primary' }] },
    ],
    isThinking: false, longRunningHint: null, lastSendFailure: null,
    dispatchAction: async () => { dispatched++ },
    cancelTurn: () => {}, startNewDraft: async () => {},
    sendMessage: async () => {}, sendSystemEvent: async () => {},
    sendChip: async () => { dispatched++ },
    clearHistory: () => {}, retryLast: async () => {},
    patchBlockStates: new Map(), setPatchBlockState: () => {},
    patchRejections: new Map(), setPatchRejection: () => {},
  }
  const el = host()
  el.style.height = '700px'
  root?.unmount()
  root = createRoot(el)
  root.render(createElement(ToastProvider, null,
    createElement(ConversationPanel as never, { conversation, onCollapse: () => {}, onAttach: () => {} })))
  await settle(); await settle()
  const chip = el.ownerDocument.querySelector('[data-testid="suggested-chip-chip_run"]') as HTMLButtonElement | null
  chip?.click()
  await settle()
  const refusalShown = /Add some nodes to get started/i.test(document.body.textContent ?? '')
  return { dispatched, refusalShown }
}

// ── OpenAI-path Run replies (AI Quality route captures, served CEE 57f903c) ──
import { ChatThread } from '../../src/canvas/conversation/zones/ChatThread'
import { parseV5Response } from '../../src/v5/responseParser'
import { routeV5Response } from '../../src/v5/responseRouter'
import { mapV5Blocks } from '../../src/v5/blocks/mapV5Blocks'
import { extractPhase3FromV5Response, deriveV5AnalysisFactUpdate } from '../../src/v5/extractPhase3FromV5Response'
import { composePhase3BridgedBlocks } from '../../src/canvas/conversation/useConversation'
import { buildSuggestedActionChips } from '../../src/v5/blocks/suggestedActionChips'
import pricingRun from './fixtures/openai-57f903c-pricing-explicit-run.json'
import hiringRun from './fixtures/openai-57f903c-hiring-explicit-run-blocked.json'

export interface OpenAiRunReading {
  words: number
  turnHeight: number
  bodyHeight: number
  blocks: string[]
  chips: string[]
  foldPx: number
  caveatAboveFold: boolean
}

/** The SHIPPED ingestion chain + the real ChatThread, at the real dock width. */
export async function renderOpenAiRun(which: 'pricing' | 'hiring'): Promise<OpenAiRunReading> {
  const raw = (which === 'pricing' ? pricingRun : hiringRun) as Record<string, unknown>
  const res = new Response(JSON.stringify(raw), { status: 200, headers: { 'Content-Type': 'application/json' } })
  const target = routeV5Response(await parseV5Response(res)) as { kind: string; response: never }
  const response = target.response as { blocks: never; suggested_actions: never; assistant_text: string }
  const mapped = target.kind === 'blocks' ? mapV5Blocks(response.blocks, response.suggested_actions) : []
  const phase3 = extractPhase3FromV5Response(response as never)
  const fact = deriveV5AnalysisFactUpdate(response as never, phase3)
  const blocks = composePhase3BridgedBlocks(fact.action === 'set', phase3.rawBlocks, mapped)
  const actionChips = buildSuggestedActionChips(response.blocks as never, response.suggested_actions as never)

  const el = host()
  el.style.cssText = `position:fixed;top:0;left:0;width:${W}px;height:772px;display:flex;flex-direction:column;z-index:99999;background:#fff;overflow:auto`
  root?.unmount()
  root = createRoot(el)
  const messages = [
    { id: 'u1', role: 'user', content: 'Run analysis', timestamp: new Date() },
    { id: 'a1', role: 'assistant', content: response.assistant_text, isStreaming: false, blocks, actionChips, timestamp: new Date() },
  ]
  root.render(createElement(ChatThread as never, {
    messages, isThinking: false, longRunningHint: null, nodeCount: 12,
    patchBlockStates: new Map(), patchRejections: new Map(),
    onChipClick: async () => {}, onPatchAccept: () => {}, onPatchDismiss: () => {},
    onFeedback: () => {}, onRetry: () => {}, compact: true,
  }))
  await settle(); await settle()
  const thread = el.querySelector('[data-testid="chat-thread"]') as HTMLElement | null
  const bubbles = [...el.querySelectorAll('[data-testid^="message-bubble"], [data-role="assistant"]')] as HTMLElement[]
  const assistant = bubbles[bubbles.length - 1] ?? thread
  const caveat = [...el.querySelectorAll('li, p, span')].find((n) => /unscored|has no stated effect/i.test(n.textContent ?? '')) as HTMLElement | undefined
  const top = (thread ?? el).getBoundingClientRect().top
  return {
    words: response.assistant_text.split(/\s+/).filter(Boolean).length,
    turnHeight: Math.round(thread?.scrollHeight ?? el.scrollHeight),
    bodyHeight: Math.round(assistant?.getBoundingClientRect().height ?? 0),
    blocks: [...el.querySelectorAll('[data-block-id], [data-testid^="v5-"]')].map((n) => n.getAttribute('data-testid') ?? 'block').slice(0, 12),
    chips: [...el.querySelectorAll('[data-testid^="suggested-chip-"]')].map((n) => n.textContent ?? ''),
    foldPx: 772,
    caveatAboveFold: caveat ? caveat.getBoundingClientRect().top - top < 772 : false,
  }
}

/** Scroll the thread to the top of the turn, so the photo shows what the reply OPENS with. */
export function scrollThreadTop(): void {
  const el = document.getElementById('aic-host')
  const thread = el?.querySelector('[data-testid="chat-thread"]') as HTMLElement | null
  if (thread) thread.scrollTop = 0
  if (el) el.scrollTop = 0
}
