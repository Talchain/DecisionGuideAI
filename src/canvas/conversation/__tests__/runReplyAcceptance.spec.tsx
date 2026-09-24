/**
 * AI CONVERSATION — INCREMENT 1 ACCEPTANCE: coaching actions in a Run reply are
 * never promoted, shown live, or reported "Sent" beyond what is proven.
 *
 * ## The finding this starts from (measured on four captured Run turns)
 * Fed through the SHIPPED ingestion chain — `parseV5Response` →
 * `routeV5Response` → `mapV5Blocks` → `extractPhase3FromV5Response` →
 * `composePhase3BridgedBlocks` → `composeMessage`, as `useConversation.ts`
 * runs it — every action-bearing coaching card lands in the collapsed
 * "Show N more" tier. That is NOT to be "fixed" by promoting them: on these
 * conventional-path captures every action fails the programme's bar (#63,
 * Delivery Lead): the `assumption_check` prompt names no target, and both its
 * `confirm_factor` intent and the calibration cards' `start_guided_chat`
 * intent are withheld from the wire (not in `CEE_ACCEPTED_INTENTS`). A
 * target-less or unrouted action must not be promoted as a working one.
 *
 * ## Controls pinned here, each separately
 *   §1 no promotion   — conventional Run captures expose NO coaching action
 *                       at top level (none has a proven target + route)
 *   §2 receipt        — "Sent" appears only when the send seam returns an
 *                       acknowledged delivery; no witness ⇒ no receipt; a
 *                       failed send re-arms the chip; copy never claims a
 *                       model change or a Run
 *   §3 ineligible     — no producer action fields ⇒ no action, composition
 *                       unchanged
 *   §4 blocked        — a needs-input turn invents no coaching action
 *   §5 stale          — after an edit the action is disabled and described
 *                       by the card's own notice
 *   §6 rerun          — the previous run's card goes inert, the new one is live
 *   §7 reload         — a restored card never carries a receipt, and is
 *                       disabled if the model moved
 *
 * NOT YET PINNED (lease-gated, see #63 5819412579): promotion of the
 * run-turn fragile-link card (needs `source_handler`/`created_at` carried by
 * `phase3TypedBlocks.ts`), the three-part currency rule, and the real
 * wire-payload + reply test for an acknowledged send (needs the `_sendChip`
 * delivery-outcome seam in `guidanceStore.ts`).
 *
 * CLAIM TYPE: producer capture → shipped adapters → rendered DOM (jsdom). Not
 * the deployed build, not the live OpenAI path.
 *
 * Captures are READ-ONLY records (captures/PROVENANCE.md). Variants are deep
 * copies made in memory; no capture file is ever written.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, cleanup, act } from '@testing-library/react'

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
import { composePhase3BridgedBlocks } from '../useConversation'
import { composeMessage, MAX_POINTS } from '../messageComposition'
import { InlineBlocks } from '../InlineBlocks'
import { useCanvasStore } from '../../store'
import { useGuidanceStore } from '../../stores/guidanceStore'
import { saveTranscript, loadTranscript, TRANSCRIPT_STORAGE_KEY } from '../utils/transcriptStore'
import type {
  ConversationBlock,
  ConversationMessage,
  V5CoachingBlock as V5CoachingBlockType,
} from '../types'
import { V5CoachingBlock } from '../../../v5/blocks/V5CoachingBlock'
import { ACTION_CHIP_RECEIPT } from '../../../v5/blocks/ActionChip'
import { CEE_ACCEPTED_INTENTS } from '../../../v5/buildPayload'

import walkA from '../../../v5/__tests__/fixtures/live-analysis-turn-walkA-2026-08-04.json'
import t3 from '../../../v5/__tests__/fixtures/live-analysis-turn-T3-20260808T155759Z.json'
import w998Turn3 from '../../../lib/coherence/__tests__/fixtures/captures/w998-2026-08-16-a1-turn3.json'
import seededW2d from '../../../lib/coherence/__tests__/fixtures/captures/seeded-2026-08-17-w2d-analysis-turn.json'
import j4t2 from '../../../lib/coherence/__tests__/fixtures/captures/acceptance-2026-08-17-j4-t2.json'

type Wire = Record<string, unknown> & { blocks?: Array<Record<string, unknown>> }

const RUN_CAPTURES: ReadonlyArray<readonly [string, Wire]> = [
  ['walkA (2026-08-04)', walkA as unknown as Wire],
  ['T3 (2026-08-08)', t3 as unknown as Wire],
  ['w998 a1-turn3 (2026-08-16)', w998Turn3 as unknown as Wire],
  ['seeded w2d (2026-08-17)', seededW2d as unknown as Wire],
]

/** Deep copy with the capture's own `__…__` provenance keys removed (they are not wire). */
function wireBody(capture: Wire): Wire {
  const copy = JSON.parse(JSON.stringify(capture)) as Wire
  for (const k of Object.keys(copy)) if (k.startsWith('__')) delete copy[k]
  return copy
}

/** The SHIPPED ingestion chain, in the order `useConversation.ts` runs it. */
async function ingest(body: Wire): Promise<ConversationBlock[]> {
  const res = new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
  const parsed = await parseV5Response(res)
  const target = routeV5Response(parsed)
  if (target.kind !== 'blocks' && target.kind !== 'text_only') {
    throw new Error(`capture did not route to a renderable turn: ${target.kind}`)
  }
  const mapped =
    target.kind === 'blocks'
      ? mapV5Blocks(target.response.blocks, target.response.suggested_actions)
      : []
  const phase3 = extractPhase3FromV5Response(target.response)
  const fact = deriveV5AnalysisFactUpdate(target.response, phase3)
  return composePhase3BridgedBlocks(fact.action === 'set', phase3.rawBlocks, mapped)
}

type CoachingWithAction = V5CoachingBlockType & { action_label: string; action_prompt: string }

/** The first coaching block carrying a producer action, in producer (ingested) order. */
function firstActionCard(blocks: readonly ConversationBlock[]): CoachingWithAction {
  const card = blocks.find(
    (b): b is CoachingWithAction =>
      b.type === 'v5_coaching' &&
      Boolean((b as V5CoachingBlockType).action_label?.trim()) &&
      Boolean((b as V5CoachingBlockType).action_prompt?.trim()),
  )
  if (!card) throw new Error('capture carries no action-bearing coaching card')
  return card
}

/** Render ONE producer card on its own — the card-level contract, independent of composition. */
function renderCard(block: V5CoachingBlockType) {
  const view = render(<V5CoachingBlock block={block} />)
  const chip = view.getByTestId('v5-coaching-action') as HTMLButtonElement
  return { ...view, chip }
}

/**
 * A coaching action a person can SEE and CLICK without opening anything:
 * not inside the collapsed "Show N more" body, and not inside a closed
 * compact-line `<details>` (other than in its own summary).
 */
function visibleActions(root: HTMLElement): HTMLButtonElement[] {
  return Array.from(
    root.querySelectorAll<HTMLButtonElement>('button[data-testid="v5-coaching-action"]'),
  ).filter((btn) => {
    if (btn.closest('[data-testid="block-detail-body"]')) return false
    for (let el: HTMLElement | null = btn.parentElement; el && el !== root; el = el.parentElement) {
      if (el.tagName === 'DETAILS' && !(el as HTMLDetailsElement).open) {
        const summary = el.querySelector(':scope > summary')
        if (!summary || !summary.contains(btn)) return false
      }
    }
    return true
  })
}

function setCurrentCeeHash(hash: string | undefined, dirty = false): void {
  useCanvasStore.setState({
    analysisFreshness: hash === undefined ? { freshness: 'fresh' } : { freshness: 'fresh', currentGraphHash: hash },
    analysisFreshnessDirty: dirty,
  } as never)
}

function hashOf(capture: Wire): string {
  return String(capture.graph_hash)
}

let sendChip: ReturnType<typeof vi.fn>

beforeEach(() => {
  localStorage.clear()
  sendChip = vi.fn()
  useGuidanceStore.setState({ _sendChip: sendChip } as never)
  useCanvasStore.setState({ analysisFreshness: null, analysisFreshnessDirty: false } as never)
})

afterEach(() => {
  cleanup()
  useGuidanceStore.setState({ _sendChip: null } as never)
})

describe('§1 no promotion — unproven actions stay out of the top level', () => {
  it.each(RUN_CAPTURES)('%s: no coaching action is visible without opening anything', async (_n, capture) => {
    setCurrentCeeHash(hashOf(capture))
    const { container } = render(<InlineBlocks blocks={await ingest(wireBody(capture))} />)
    expect(visibleActions(container)).toHaveLength(0)
  })

  it.each(RUN_CAPTURES)('%s: why — every action here is target-less or on an unrouted intent', async (_n, capture) => {
    const cards = (await ingest(wireBody(capture))).filter(
      (b): b is V5CoachingBlockType => b.type === 'v5_coaching' && Boolean((b as V5CoachingBlockType).action_prompt),
    )
    expect(cards.length).toBeGreaterThan(0)
    for (const card of cards) {
      const routed = card.action_intent ? CEE_ACCEPTED_INTENTS.has(card.action_intent as never) : false
      expect(routed, `${card.coaching_kind} intent ${card.action_intent} must not be treated as routed`).toBe(false)
    }
  })

  it.each(RUN_CAPTURES)('%s: the top-level set never grows past MAX_POINTS', async (_n, capture) => {
    expect(composeMessage(await ingest(wireBody(capture))).points.length).toBeLessThanOrEqual(MAX_POINTS)
  })
})

describe('§2 receipt — "Sent" only on an acknowledged delivery', () => {
  async function liveCard() {
    const capture = w998Turn3 as unknown as Wire
    setCurrentCeeHash(hashOf(capture))
    return firstActionCard(await ingest(wireBody(capture)))
  }

  it('dispatches the producer label, prompt and intent verbatim, once', async () => {
    const card = await liveCard()
    const { chip } = renderCard(card)
    fireEvent.click(chip)
    fireEvent.click(chip)
    expect(sendChip).toHaveBeenCalledTimes(1)
    expect(sendChip).toHaveBeenCalledWith(
      card.action_label,
      card.action_prompt,
      card.action_intent ? { intent: card.action_intent } : undefined,
    )
  })

  it('two clicks in one tick still send exactly once', async () => {
    const { chip } = renderCard(await liveCard())
    act(() => {
      chip.click()
      chip.click()
    })
    expect(sendChip).toHaveBeenCalledTimes(1)
  })

  it('a seam that returns no outcome yields NO receipt — the click alone proves nothing', async () => {
    const { chip, queryByTestId } = renderCard(await liveCard())
    fireEvent.click(chip)
    expect(chip.disabled).toBe(true)
    expect(queryByTestId('v5-coaching-action-receipt')).toBeNull()
  })

  it('pending → "Sending…", then "Sent" only once delivery resolves to sent', async () => {
    let resolve!: (v: string) => void
    sendChip.mockReturnValue(new Promise<string>((r) => { resolve = r }))
    const { chip, getByTestId } = renderCard(await liveCard())
    fireEvent.click(chip)
    expect(getByTestId('v5-coaching-action-receipt').textContent).toBe(ACTION_CHIP_RECEIPT.pending)
    await act(async () => { resolve('sent') })
    const receipt = getByTestId('v5-coaching-action-receipt')
    expect(receipt.textContent).toBe(ACTION_CHIP_RECEIPT.sent)
    expect(receipt.textContent ?? '').not.toMatch(/updated|applied|changed|\brun\b|analys/i)
    expect(chip.disabled).toBe(true)
  })

  it('a failed delivery says so and re-arms the chip for a genuine first delivery', async () => {
    sendChip.mockReturnValueOnce(Promise.resolve('failed')).mockReturnValueOnce(Promise.resolve('sent'))
    const { chip, getByTestId } = renderCard(await liveCard())
    await act(async () => { fireEvent.click(chip) })
    expect(getByTestId('v5-coaching-action-receipt').textContent).toBe(ACTION_CHIP_RECEIPT.failed)
    expect(chip.disabled).toBe(false)
    await act(async () => { fireEvent.click(chip) })
    expect(sendChip).toHaveBeenCalledTimes(2)
    expect(getByTestId('v5-coaching-action-receipt').textContent).toBe(ACTION_CHIP_RECEIPT.sent)
  })

  it('a rejected send is reported as not sent, never as sent', async () => {
    sendChip.mockReturnValue(Promise.reject(new Error('504')))
    const { chip, getByTestId } = renderCard(await liveCard())
    await act(async () => { fireEvent.click(chip) })
    expect(getByTestId('v5-coaching-action-receipt').textContent).toBe(ACTION_CHIP_RECEIPT.failed)
  })

  it('an unrecognised outcome is "couldn’t confirm", never "sent"', async () => {
    sendChip.mockReturnValue(Promise.resolve({ ok: true }))
    const { chip, getByTestId } = renderCard(await liveCard())
    await act(async () => { fireEvent.click(chip) })
    expect(getByTestId('v5-coaching-action-receipt').textContent).toBe(ACTION_CHIP_RECEIPT.unconfirmed)
    expect(chip.disabled).toBe(true)
  })

  it('with no conversation host, a click sends nothing and claims nothing', async () => {
    useGuidanceStore.setState({ _sendChip: null } as never)
    const { chip, queryByTestId } = renderCard(await liveCard())
    fireEvent.click(chip)
    expect(chip.disabled).toBe(false)
    expect(queryByTestId('v5-coaching-action-receipt')).toBeNull()
  })
})

describe('§3 ineligible — no producer action, no forced coaching', () => {
  function stripActions(capture: Wire): Wire {
    const body = wireBody(capture)
    for (const b of body.blocks ?? []) {
      delete b.action_label
      delete b.action_prompt
      delete b.action_intent
    }
    return body
  }

  it.each(RUN_CAPTURES)('%s: zero action buttons anywhere', async (_n, capture) => {
    setCurrentCeeHash(hashOf(capture))
    const { container } = render(<InlineBlocks blocks={await ingest(stripActions(capture))} />)
    expect(container.querySelectorAll('[data-testid="v5-coaching-action"]')).toHaveLength(0)
  })

  it('walkA: composition is exactly today’s (evidence r1-r3 top-level)', async () => {
    const points = composeMessage(await ingest(stripActions(walkA as unknown as Wire))).points
    expect(points.map((e) => e.blockType)).toEqual(['v5_evidence', 'v5_evidence', 'v5_evidence'])
  })
})

describe('§4 blocked — a needs-input turn invents no coaching action', () => {
  it('j4-t2 (analysis_ready needs_user_input, 10 blockers): no coaching action rendered', async () => {
    const { container } = render(<InlineBlocks blocks={await ingest(wireBody(j4t2 as unknown as Wire))} />)
    expect(container.querySelectorAll('[data-testid="v5-coaching-action"]')).toHaveLength(0)
  })
})

describe('§5 stale-after-edit — disabled, and described by the card’s own notice', () => {
  it('a local edit (dirty): disabled, click sends nothing, notice is the description', async () => {
    const capture = walkA as unknown as Wire
    setCurrentCeeHash(hashOf(capture), true)
    const { chip, getByTestId } = renderCard(firstActionCard(await ingest(wireBody(capture))))
    expect(chip.disabled).toBe(true)
    fireEvent.click(chip)
    expect(sendChip).not.toHaveBeenCalled()
    const notice = getByTestId('v5-coaching-freshness')
    expect(notice.id).not.toBe('')
    expect(chip.getAttribute('aria-describedby')).toBe(notice.id)
  })

  it('CEE reports a different current hash: disabled', async () => {
    setCurrentCeeHash('not-the-generation-hash')
    const { chip } = renderCard(firstActionCard(await ingest(wireBody(walkA as unknown as Wire))))
    expect(chip.disabled).toBe(true)
  })

  it('producer marks the card stale: disabled even while hashes agree', async () => {
    const capture = walkA as unknown as Wire
    const body = wireBody(capture)
    for (const b of body.blocks ?? []) if (b.type === 'coaching') b.freshness = 'stale'
    setCurrentCeeHash(hashOf(capture))
    const { chip } = renderCard(firstActionCard(await ingest(body)))
    expect(chip.disabled).toBe(true)
  })

  it('control: hashes agree and no edit — live, and no stray description', async () => {
    const capture = walkA as unknown as Wire
    setCurrentCeeHash(hashOf(capture))
    const { chip } = renderCard(firstActionCard(await ingest(wireBody(capture))))
    expect(chip.disabled).toBe(false)
    expect(chip.hasAttribute('aria-describedby')).toBe(false)
  })
})

describe('§6 rerun — the previous run’s card goes inert, the new one is live', () => {
  it('two runs on screen: only the current-hash card’s action is enabled', async () => {
    const capture = walkA as unknown as Wire
    const oldBody = wireBody(capture)
    for (const b of oldBody.blocks ?? []) {
      if ('graph_hash_at_generation' in b) b.graph_hash_at_generation = 'hash-before-rerun'
    }
    setCurrentCeeHash(hashOf(capture))
    const oldCard = renderCard(firstActionCard(await ingest(oldBody)))
    expect(oldCard.chip.disabled).toBe(true)
    cleanup()
    const newCard = renderCard(firstActionCard(await ingest(wireBody(capture))))
    expect(newCard.chip.disabled).toBe(false)
  })
})

describe('§7 reload — a restored card never carries a receipt', () => {
  async function restoredCard(capture: Wire): Promise<V5CoachingBlockType> {
    const blocks = await ingest(wireBody(capture))
    const message = {
      id: 'm-run-1',
      role: 'assistant',
      content: String(capture.assistant_text ?? ''),
      blocks,
      timestamp: new Date('2026-09-24T12:00:00Z'),
    } as ConversationMessage
    saveTranscript('scenario-run-reply', [message])
    expect(localStorage.getItem(TRANSCRIPT_STORAGE_KEY)).not.toBeNull()
    const restored = loadTranscript('scenario-run-reply')?.messages.find((m) => m.role === 'assistant')?.blocks
    expect(restored, 'the transcript store restores the turn blocks').toBeTruthy()
    return firstActionCard(restored as ConversationBlock[])
  }

  it('model changed while away: restored action is disabled', async () => {
    const capture = walkA as unknown as Wire
    setCurrentCeeHash('hash-after-return')
    const { chip, queryByTestId } = renderCard(await restoredCard(capture))
    expect(chip.disabled).toBe(true)
    expect(queryByTestId('v5-coaching-action-receipt')).toBeNull()
  })

  it('same model after reload: no receipt survives (a receipt is never persisted)', async () => {
    const capture = walkA as unknown as Wire
    setCurrentCeeHash(hashOf(capture))
    const { queryByTestId } = renderCard(await restoredCard(capture))
    expect(queryByTestId('v5-coaching-action-receipt')).toBeNull()
  })
})
