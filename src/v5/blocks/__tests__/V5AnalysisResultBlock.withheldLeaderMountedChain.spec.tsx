/**
 * ⭐⭐ UI-SEM-097 THROUGH THE SHIPPED CHAIN — what a guest sees and hears in
 * the chat's Analysis result card when the producer withholds the leader.
 *
 * Pre-review 5829070993 (#69) asked for the fix to be proved on the REAL V5
 * response composition/store path, not on a hand-mounted block: the served
 * body, with `analysis_state.leader_claim.permitted: false` and
 * `win_probabilities` present, goes through the real `useConversation` →
 * `applyV5State` → `ConversationPanel` → `MessageBubble` → `InlineBlocks` →
 * `V5AnalysisResultBlock`, and the assertions read the mounted card.
 *
 * THE BYTES (both route-captured on the OpenAI agent route, `_provider_calls`
 * all `openai`; not authored here):
 *   · `openai-agent-run-complete.aiq-57f903c.json`: AI Quality's served
 *     explicit Run, withheld with `separation: "separated"`, win shares
 *     83% / 15% / 1%. This is the "clear leader, claim withheld" case;
 *   · `openai-route-coaching-journey.e39f6e0.json` C1 → C2: the served
 *     journey's explicit Run, withheld with `separation: "near_tie"`,
 *     53% / 47% / <1%.
 *
 * THE WITNESSED 82% / 16% / 2% CASE (#69 5827478637, UI b017e3c2 · CEE
 * 9417228) is DERIVED: its bytes are on the witnessing laptop, so the review's
 * quoted `win_probabilities` ride the 57f903c body, which has the same refusal
 * (`constraint_verdict_withheld`, `separated`) and the same rank-1 option.
 *
 * THE PERMITTED CONTROL is DERIVED, not captured: the same 57f903c body with
 * `leader_claim.permitted: true` and `leading_option_id` set to the rank-1
 * option's id from the capture's own `analysis_ready.options`. No served
 * permitted capture exists in this repo; AI Quality measured 11 of 11 served
 * permitted blocks carrying a non-null `leading_option_id` (#69 5827943157).
 *
 * THE OBSERVED INVARIANT the gate relies on (asked for by the pre-review):
 * on every served withheld Run the producer nulls `leading_option_id`
 * (AI Quality: 105 of 105), and applyV5State stamps the held report's
 * `producer_leader_permission` from the typed `leader_claim`. Each half
 * withholds on its own; both are asserted here on the real path.
 *
 * CLAIM TYPE: jsdom through the shipped chain. `fetch` answers from the
 * captures; no model calls.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act, waitFor, within, cleanup } from '@testing-library/react'

import runComplete57f903c from '../../../canvas/conversation/__tests__/fixtures/openai-agent-run-complete.aiq-57f903c.json'
import servedJourneyE39f6e0 from '../../../canvas/conversation/__tests__/fixtures/openai-route-coaching-journey.e39f6e0.json'
import { useConversation, type UseConversationReturn } from '../../../canvas/conversation/useConversation'
import { ConversationPanel } from '../../../canvas/conversation/ConversationPanel'
import { ToastProvider } from '../../../canvas/ToastContext'
import { useCanvasStore } from '../../../canvas/store'
import { useGuidanceStore } from '../../../canvas/stores/guidanceStore'
import { readProducerLeaderPermission } from '../../../lib/decisionVerdict'
import { formatProbabilityWithResolution } from '../../../utils/formatPercent'

vi.mock('../../../canvas/conversation/turnService', () => ({
  callOrchestratorTurn: vi.fn(),
  streamOrchestratorTurn: vi.fn(),
  OrchestratorError: class OrchestratorError extends Error {},
}))
// The streamed sibling is unreachable, so each turn is ONE buffered request.
vi.mock('../../streamedTurnTransport', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../streamedTurnTransport')>()
  return { ...actual, openV5TurnStream: async () => { throw new TypeError('Failed to fetch') } }
})
vi.mock('../../../lib/supabase', () => ({
  getUserId: async () => null,
  getSessionIdentity: async () => ({ userId: null, accessToken: null }),
}))
vi.mock('../../../services/scenarioService', () => ({ loadScenario: async () => null, storeAnalysis: async () => undefined }))
vi.mock('../../../lib/posthog', () => ({ initPostHog: vi.fn(), identifyUser: vi.fn(), resetPostHog: vi.fn(), trackEvent: vi.fn() }))
vi.mock('../../../canvas/conversation/hooks/useThreadPersistence', () => ({ useThreadPersistence: () => ({ onBlockAction: vi.fn(), onChipTaken: vi.fn() }) }))
vi.mock('../../../flags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../flags')>()
  return { ...actual, isOrchestratorV2Enabled: () => true }
})
vi.mock('../../eligibility', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../eligibility')>()
  return { ...actual, isV5Eligible: () => ({ eligible: true }), isV5CanonicalRunPath: () => false }
})

/** The card's own share formatter (`V5AnalysisResultBlock.formatProbability`). */
const formatProbability = (p: number): string => formatProbabilityWithResolution(p, undefined)

// ── The captures ────────────────────────────────────────────────────────────

type Wire = Record<string, unknown> & {
  blocks?: Array<Record<string, unknown>>
  analysis_state?: { leader_claim?: Record<string, unknown> }
  analysis_ready?: { options?: Array<{ option_id: string; label: string }> }
}
const RUN_57F: Wire = runComplete57f903c as unknown as Wire
const E39 = (servedJourneyE39f6e0 as unknown as { turns: Array<{ turn: string; json: Wire }> }).turns
const e39Turn = (label: string): Wire => E39.find((t) => t.turn === label)!.json

const resultBlockOf = (w: Wire) => (w.blocks ?? []).find((b) => b.type === 'analysis_result') as {
  leading_option_id: unknown
  win_probabilities: Record<string, number>
  summary: string
}

/** The 57f903c body with the claim PERMITTED and the rank-1 option named (derived control). */
function permittedTwinOf57f(): Wire {
  const twin = JSON.parse(JSON.stringify(RUN_57F)) as Wire
  const block = resultBlockOf(twin)
  const [rank1Label] = Object.entries(block.win_probabilities).sort(([, a], [, b]) => b - a)[0]
  const rank1 = twin.analysis_ready!.options!.find((o) => o.label === rank1Label)
  if (!rank1) throw new Error(`capture has no option labelled "${rank1Label}"`)
  block.leading_option_id = rank1.option_id
  // The producer's separated verdict names its top option, as a permitted run
  // does, so the verdict LICENSES the leader (not only "no refusal held").
  const robustness = (block as unknown as { enrichment: { robustness: { near_tie: Record<string, unknown> } } }).enrichment.robustness
  robustness.near_tie = { ...robustness.near_tie, top_option_id: rank1.option_id }
  twin.analysis_state!.leader_claim = { permitted: true, separation: 'separated' }
  return twin
}

// ── Harness: the real hook and panel, fetch answered from the captures ──────

const SID = '00000000-0000-4000-8000-000000000001'
const queue: Wire[] = []
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

async function mount(): Promise<void> {
  render(<Harness />)
  await waitFor(() => expect(useGuidanceStore.getState()._sendChip).toBeTypeOf('function'))
}

async function say(body: Wire, text: string): Promise<void> {
  queue.push(body)
  await act(async () => { await conv.current!.sendMessage(text) })
  expect(queue, 'the served body was consumed').toHaveLength(0)
}

/** The Analysis result card of the LATEST reply. */
function latestCard(): HTMLElement {
  const cards = [...document.querySelectorAll('[data-testid="v5-analysis-result"]')] as HTMLElement[]
  expect(cards.length, 'the reply renders an Analysis result card').toBeGreaterThan(0)
  return cards[cards.length - 1]
}

/** Every accessible name inside the card: aria-label values and their text. */
function spokenNames(card: HTMLElement): string[] {
  return [...card.querySelectorAll('[aria-label]')].map((el) => el.getAttribute('aria-label') ?? '')
}

/** What a guest SEES and HEARS in the card: no share, no ranked list. */
function expectNoWinShares(card: HTMLElement, shares: Record<string, number>, when: string): void {
  expect(within(card).queryByTestId('v5-analysis-result-probabilities'), `${when}: no win-share row`).toBeNull()
  expect(within(card).queryAllByRole('list').filter((l) => l.querySelector('[role="listitem"]')), `${when}: no ranked list`).toEqual([])
  const seen = card.textContent ?? ''
  for (const [label, share] of Object.entries(shares)) {
    const shown = formatProbability(share)
    expect(seen.includes(`${label}·${shown}`) || seen.includes(`${label} · ${shown}`), `${when}: "${label} · ${shown}" is not shown`).toBe(false)
  }
  for (const name of spokenNames(card)) expect(name, `${when}: no accessible name announces shares`).not.toMatch(/\d\s*%/)
}

beforeEach(() => {
  queue.length = 0
  localStorage.clear()
  Element.prototype.scrollIntoView = vi.fn()
  window.history.replaceState(null, '', '/?ai=openai#/canvas')
  useCanvasStore.setState({
    currentScenarioId: SID,
    nodes: [],
    edges: [],
    analysisFreshness: null,
    analysisFreshnessDirty: false,
    analysisStateV1: null,
    results: { status: 'idle' } as never,
    currentScenarioLastResultHash: null,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
  } as never)
  vi.stubGlobal('fetch', vi.fn(async (url: unknown) => {
    if (!/\/v5\/turn(\?|$)/.test(String(url))) return new Response('{}', { status: 404 })
    const body = queue.shift()
    if (!body) throw new Error('the UI sent a request no captured turn answers')
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
  }))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

// ── Anti-vacuity: the captures really are the withheld shape ────────────────

describe('the captures are withheld Runs that still carry win shares', () => {
  it.each([
    ['57f903c (separated)', RUN_57F],
    ['e39f6e0 C2 (near tie)', e39Turn('C2 run')],
  ])('%s: leader_claim withheld, leading_option_id null, 3 shares on the wire', (_n, wire) => {
    expect(wire.analysis_state?.leader_claim?.permitted).toBe(false)
    expect(wire.analysis_state?.leader_claim?.withheld_reason).toBe('constraint_verdict_withheld')
    expect(resultBlockOf(wire).leading_option_id).toBeNull()
    expect(Object.keys(resultBlockOf(wire).win_probabilities)).toHaveLength(3)
  })
})

// ── The negatives, through the shipped chain ────────────────────────────────

describe('WITHHELD: the mounted card ranks nothing by win share', () => {
  it('57f903c, a clear 83% / 15% / 1% split: no share and no ranked list, seen or heard; the summary is intact', async () => {
    await mount()
    await say(RUN_57F, 'Run the analysis.')

    // The real path landed the producer's refusal in BOTH places the gate reads.
    expect(useCanvasStore.getState().analysisStateV1?.leader_claim?.permitted).toBe(false)
    expect(
      readProducerLeaderPermission(useCanvasStore.getState().results?.report?.producer_leader_permission),
      'applyV5State stamped the held report from the typed leader_claim',
    ).toBe(false)

    const card = latestCard()
    const block = resultBlockOf(RUN_57F)
    expectNoWinShares(card, block.win_probabilities, '57f903c')
    expect(within(card).getByTestId('v5-analysis-result-summary')).toHaveTextContent(block.summary)
  })

  it('the witnessed 82% / 16% / 2% values (#69 5827478637) on the 57f903c body: no share, seen or heard', async () => {
    // DERIVED. The witness's own bytes (`turns.jsonl`, UI b017e3c2 · CEE
    // 9417228) sit on the laptop that ran it, out of this container's reach.
    // Its `win_probabilities` are quoted in the review; they replace the
    // capture's, and everything else, the refusal included, stays served.
    const body = JSON.parse(JSON.stringify(RUN_57F)) as Wire
    resultBlockOf(body).win_probabilities = {
      'Raise to £59 at Release': 0.8216,
      'Keep £49 Price': 0.155,
      'Raise to £55 at Release': 0.0233,
    }
    await mount()
    await say(body, 'Run the analysis.')
    expectNoWinShares(latestCard(), resultBlockOf(body).win_probabilities, 'witnessed 82/16/2')
  })

  it('e39f6e0 C1 → C2, a near tie withheld: the Run card ranks nothing', async () => {
    await mount()
    await say(e39Turn('C1 brief'), 'We sell a Pro plan at £49/month. Should we raise it to £59 with the next feature release?')
    await say(e39Turn('C2 run'), 'Go ahead.')

    const card = latestCard()
    const block = resultBlockOf(e39Turn('C2 run'))
    expectNoWinShares(card, block.win_probabilities, 'e39f6e0 C2')
    expect(within(card).getByTestId('v5-analysis-result-summary')).toHaveTextContent(block.summary)
  })
})

describe('WITHHELD by the typed claim alone: the percentages have their own permission check', () => {
  it('a withheld claim whose block DOES name a leader (never observed on the wire) still ranks nothing', async () => {
    // Derived: the served 57f903c refusal kept, but the block names the rank-1
    // option, so `thisRunNamedNoLeader` is false and only the held report's
    // stamp (from `analysis_state.leader_claim`) can withhold.
    const body = permittedTwinOf57f()
    body.analysis_state!.leader_claim = { ...RUN_57F.analysis_state!.leader_claim }
    expect(body.analysis_state!.leader_claim!.permitted).toBe(false)
    expect(typeof resultBlockOf(body).leading_option_id).toBe('string')

    await mount()
    await say(body, 'Run the analysis.')
    expectNoWinShares(latestCard(), resultBlockOf(body).win_probabilities, 'claim withheld, leader named')
  })
})

// ── The permitted control ───────────────────────────────────────────────────

describe('PERMITTED (derived control): the row renders, seen and heard', () => {
  it('the same 57f903c bytes with the claim permitted: every share, largest first, under its accessible name', async () => {
    await mount()
    const twin = permittedTwinOf57f()
    await say(twin, 'Run the analysis.')
    expect(
      readProducerLeaderPermission(useCanvasStore.getState().results?.report?.producer_leader_permission),
      'no refusal is held',
    ).not.toBe(false)

    const card = latestCard()
    const row = within(card).getByRole('list', { name: 'Share of simulated scenarios supporting each option' })
    expect(row).toHaveAttribute('data-testid', 'v5-analysis-result-probabilities')
    const ranked = Object.entries(resultBlockOf(twin).win_probabilities).sort(([, a], [, b]) => b - a)
    const items = within(row).getAllByRole('listitem')
    expect(items).toHaveLength(ranked.length)
    ranked.forEach(([label, share], i) => {
      expect(items[i]).toHaveTextContent(label)
      expect(items[i]).toHaveTextContent(formatProbability(share))
    })
    // A LICENSED leader: the verdict names it, so it is crowned and first.
    expect(items[0]).toHaveAttribute('data-leader', 'true')
  })

  it('a withheld Run, then a permitted one: the EARLIER card stays withheld (per card, not the latest verdict)', async () => {
    await mount()
    await say(RUN_57F, 'Run the analysis.')
    await say(permittedTwinOf57f(), 'Run it again.')

    const cards = [...document.querySelectorAll('[data-testid="v5-analysis-result"]')] as HTMLElement[]
    expect(cards, 'one card per Run').toHaveLength(2)
    expectNoWinShares(cards[0], resultBlockOf(RUN_57F).win_probabilities, 'the earlier, withheld card')
    expect(within(cards[1]).getByTestId('v5-analysis-result-probabilities'), 'the later, permitted card').toBeInTheDocument()
  })
})
