/**
 * RUN-TURN COACHING CARD (#1968) — served-browser witness probe.
 *
 * Same technique as `witnessProbe.ts`: a module under the Vite root, so the
 * REAL ChatThread → InlineBlocks → CoachingLine → V5CoachingBlock render with
 * the REAL stylesheet in a real Chromium.
 *
 * The turn is FETCHED from `/proxy/v5/turn`, which the spec route-fulfils from
 * the producer's v3 golden payload (`runTurnEnvelopes.ts` says what is the
 * producer's and what is the harness's). Vite has no `/proxy` route, so a
 * request the spec did NOT fulfil comes back as SPA HTML and `parseV5Response`
 * fails loudly — a successful ingest is itself proof the fixture served it.
 *
 * Each response then goes through the SHIPPED chain, as `useConversation`
 * does it: parseV5Response → routeV5Response → applyV5State (with the real
 * store spread, exactly as useConversation.ts passes it) → extractPhase3 →
 * mapV5Blocks → composePhase3BridgedBlocks. The store's `analysisStateV1` and
 * `analysisFreshness` are therefore written by the production applicator, not
 * by `setState`, and are read back and returned so the spec can assert them.
 *
 * No model calls: the only network the probe makes is the local fetch above,
 * and the action chip's dispatcher is a local recorder.
 */
import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { ChatThread } from '../../src/canvas/conversation/zones/ChatThread'
import { parseV5Response } from '../../src/v5/responseParser'
import { routeV5Response } from '../../src/v5/responseRouter'
import { mapV5Blocks } from '../../src/v5/blocks/mapV5Blocks'
import { applyV5State } from '../../src/v5/applyV5State'
import { extractPhase3FromV5Response, deriveV5AnalysisFactUpdate } from '../../src/v5/extractPhase3FromV5Response'
import { composePhase3BridgedBlocks } from '../../src/canvas/conversation/useConversation'
import { buildSuggestedActionChips } from '../../src/v5/blocks/suggestedActionChips'
import { RUN_TURN_COACHING_PROMOTION_ENABLED } from '../../src/canvas/conversation/messageComposition'
import { useCanvasStore } from '../../src/canvas/store'
import { useGuidanceStore } from '../../src/canvas/stores/guidanceStore'
import type { RunCardState } from './runTurnEnvelopes'

const settle = () => new Promise((r) => setTimeout(r, 400))
const W = 416
let root: Root | null = null
let dispatched: Array<{ label: string; message: string }> = []

function host(): HTMLElement {
  document.getElementById('aic-host')?.remove()
  const el = document.createElement('div')
  el.id = 'aic-host'
  el.style.cssText = `position:fixed;top:0;left:0;width:${W}px;height:772px;display:flex;flex-direction:column;z-index:99999;background:#fff;overflow:auto`
  document.body.appendChild(el)
  return el
}

interface Ingested {
  kind: string
  response: Record<string, unknown>
  applied: string[]
  deferred: unknown[]
}

/** Fetch one turn (route-fulfilled by the spec) and apply it through the shipped chain. */
async function ingest(query: string): Promise<Ingested> {
  const res = await fetch(`/proxy/v5/turn?${query}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ witness: query }),
  })
  const target = routeV5Response(await parseV5Response(res)) as { kind: string; response?: never }
  if (target.kind !== 'blocks' && target.kind !== 'text_only') {
    throw new Error(`[runcard] turn ${query} routed to "${target.kind}", not a renderable turn`)
  }
  const snapshot = useCanvasStore.getState()
  const r = applyV5State(target.response as never, {
    ...snapshot,
    currentResultsHash: (snapshot as { results?: { hash?: string | null } }).results?.hash ?? null,
  } as never)
  return { kind: target.kind, response: target.response as never, applied: r.applied, deferred: r.deferred }
}

export interface RunCardRender {
  promotionEnabled: boolean
  runTurnApplied: string[]
  laterTurnApplied: string[] | null
  store: { runState: unknown; currentGraphHash: string | null; freshness: string | null; dirty: boolean }
  blockTypes: string[]
  adapted: { source_handler: unknown; created_at: unknown; graph_hash_at_generation: unknown; freshness: unknown } | null
  cardId: string | null
  /** Before any disclosure is touched. */
  initially: { cardInDom: boolean; detailToggle: string | null; lineOpen: boolean | null }
}

/** Reset the currency inputs, ingest the run turn (+ the later turn for `state`), mount the real ChatThread. */
export async function renderRunTurn(state: RunCardState): Promise<RunCardRender> {
  useCanvasStore.setState({
    analysisFreshness: null,
    analysisFreshnessDirty: false,
    importPendingServerRegistration: false,
    analysisStateV1: null,
  } as never)
  dispatched = []
  useGuidanceStore.setState({
    _sendChip: (label: string, message: string) => { dispatched.push({ label, message }) },
  } as never)

  const run = await ingest('witness=run')
  const response = run.response as { blocks: never; suggested_actions: never; assistant_text: string }
  const mapped = run.kind === 'blocks' ? mapV5Blocks(response.blocks, response.suggested_actions) : []
  const phase3 = extractPhase3FromV5Response(response as never)
  const fact = deriveV5AnalysisFactUpdate(response as never, phase3)
  const blocks = composePhase3BridgedBlocks(fact.action === 'set', phase3.rawBlocks, mapped)
  const actionChips = buildSuggestedActionChips(response.blocks as never, response.suggested_actions as never)

  const later = state === 'current' ? null : await ingest(`witness=later&state=${state}`)

  const card = blocks.find((b) => b.type === 'v5_coaching') as Record<string, unknown> | undefined
  const s = useCanvasStore.getState() as unknown as {
    analysisStateV1: { run_state?: unknown } | null
    analysisFreshness: { currentGraphHash?: string; freshness?: string } | null
    analysisFreshnessDirty: boolean
  }

  const el = host()
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

  const cardId = (card?.block_id as string | undefined) ?? null
  const cardEl = cardId ? el.querySelector(`[data-block-id="${cardId}"]`) : null
  const line = cardId ? (el.querySelector(`[data-testid="coaching-line-${cardId}"]`) as HTMLDetailsElement | null) : null
  const toggle = el.querySelector('[data-testid="block-detail-toggle"]')
  return {
    promotionEnabled: RUN_TURN_COACHING_PROMOTION_ENABLED,
    runTurnApplied: run.applied,
    laterTurnApplied: later?.applied ?? null,
    store: {
      runState: s.analysisStateV1?.run_state ?? null,
      currentGraphHash: s.analysisFreshness?.currentGraphHash ?? null,
      freshness: s.analysisFreshness?.freshness ?? null,
      dirty: s.analysisFreshnessDirty,
    },
    blockTypes: blocks.map((b) => b.type),
    adapted: card
      ? { source_handler: card.source_handler, created_at: card.created_at, graph_hash_at_generation: card.graph_hash_at_generation, freshness: card.freshness }
      : null,
    cardId,
    initially: {
      cardInDom: Boolean(cardEl),
      detailToggle: toggle?.textContent ?? null,
      lineOpen: line ? line.open : null,
    },
  }
}

export interface RunCardReading {
  cardInDom: boolean
  lineOpen: boolean | null
  currency: string | null
  runTurnReason: string | null
  noticeText: string | null
  noticeId: string | null
  noticeVisible: boolean
  chipText: string | null
  chipTag: string | null
  chipDisabled: boolean | null
  chipInert: string | null
  chipDescribedBy: string | null
  describedByResolvesToNotice: boolean
  chipVisible: boolean
  cardRect: { top: number; height: number; width: number } | null
  hostScrollWidthOverflow: number
  dispatched: Array<{ label: string; message: string }>
}

function visible(n: Element | null): boolean {
  if (!n) return false
  const r = (n as HTMLElement).getBoundingClientRect()
  const cs = getComputedStyle(n as HTMLElement)
  return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'
}

/** Read the card as rendered (after the spec has clicked whatever disclosures it needed). */
export function readRunCard(cardId: string): RunCardReading {
  const el = document.getElementById('aic-host') as HTMLElement
  const card = el.querySelector(`[data-block-id="${cardId}"]`) as HTMLElement | null
  const prefix = card?.getAttribute('data-testid') ?? 'v5-coaching'
  const part = (suffix: string) => card?.querySelector(`[data-testid="${prefix}-${suffix}"]`) ?? null
  const notice = part('freshness') as HTMLElement | null
  const chip = part('action') as HTMLButtonElement | null
  const line = el.querySelector(`[data-testid="coaching-line-${cardId}"]`) as HTMLDetailsElement | null
  const describedBy = chip?.getAttribute('aria-describedby') ?? null
  const described = describedBy ? document.getElementById(describedBy) : null
  const rect = card?.getBoundingClientRect()
  return {
    cardInDom: Boolean(card),
    lineOpen: line ? line.open : null,
    currency: card?.getAttribute('data-currency') ?? null,
    runTurnReason: card?.getAttribute('data-run-turn-reason') ?? null,
    noticeText: notice?.textContent ?? null,
    noticeId: notice?.id ?? null,
    noticeVisible: visible(notice),
    chipText: chip?.textContent ?? null,
    chipTag: chip?.tagName ?? null,
    chipDisabled: chip && 'disabled' in chip ? chip.disabled : null,
    chipInert: chip?.getAttribute('data-inert') ?? null,
    chipDescribedBy: describedBy,
    describedByResolvesToNotice: Boolean(described && notice && described === notice),
    chipVisible: visible(chip),
    cardRect: rect ? { top: Math.round(rect.top), height: Math.round(rect.height), width: Math.round(rect.width) } : null,
    hostScrollWidthOverflow: el.scrollWidth - el.clientWidth,
    dispatched: [...dispatched],
  }
}

/** Bring the card into the dock's viewport so the photo shows it. */
export function scrollCardIntoView(cardId: string): void {
  const card = document.querySelector(`#aic-host [data-block-id="${cardId}"]`) as HTMLElement | null
  card?.scrollIntoView({ block: 'center' })
}
