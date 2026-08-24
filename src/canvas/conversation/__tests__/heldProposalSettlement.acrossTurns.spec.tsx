/**
 * A HELD PROPOSAL OFFERS AN AFFORDANCE IFF IT IS UNRESOLVED ON THE TURN IT IS
 * MOUNTED — the time axis of SENDABLE failure 5.
 *
 * ── WHY THIS FILE EXISTS BESIDE `heldProposalSettlement.crossSurface.spec.tsx` ─
 * That file pins the SURFACE axis: one proposal, one turn, two mounted
 * surfaces, settle either and both retire. This file pins the TIME axis: the
 * same CEE hold HANDLE arriving on more than one turn.
 *
 * The handle is not unique per offer, and that is deliberate, not a defect.
 * Derived at the CEE bytes (`olumi-assistants-service` @ `d1da6706`,
 * `src/orchestrator-v5/handlers/edit-graph-referee-gate.ts:696-702`):
 *
 *     gmHeldProposalRef(scenarioId, targetKey)
 *       = `gmh_` + sha256(`${scenarioId}:${targetKey}`).slice(0,12)
 *
 * — no nonce, no turn, no timestamp — and its own comment states the intent:
 * "A NEWER held offer for the SAME target gets the SAME handle, so the commit
 * carry-forward's same-key supersession rule retires the older one." The target
 * key collapses harder still: `mutationTargetKey`
 * (`graph-management/pending-projection.ts:98-121`) returns `node:<id>` for
 * `add_node`, `rename_node`, `update_node_field` AND `remove_node` alike.
 *
 * So the handle names a SLOT — "the current hold against this target" — not an
 * OFFER INSTANCE. Two proposals a user experiences as entirely different
 * changes ("remove the Pricing node", then "rename the Pricing node") share one
 * handle by design.
 *
 * ── THE TWO OPPOSITE HARMS, WHICH MUST NOT SHARE A PREDICATE ────────────────
 * · STALE-LIVE — a proposal the user has already resolved still offering an
 *   action. This is the original SENDABLE-5 defect. Pressing it returns a
 *   refusal. It must stay closed, INCLUDING across turns: when the same handle
 *   is on screen in more than one turn, settling one must retire them all.
 * · FRESH-DEAD — a proposal CEE has just issued offering NO action at all. A
 *   settlement keyed on the bare handle leaks across time onto a later,
 *   genuinely-new offer: the card mounts already settled, its buttons are gone,
 *   and the chip row cannot supply them either (`buildSuggestedActionChips`
 *   suppresses the confirm/decline ids on any turn carrying a held_proposal
 *   block, settled or not). Zero affordance anywhere. It must close.
 *
 * These are the two doors of CLAUDE.md trap 22b. Every case below has its
 * opposite-direction twin in the same describe block.
 *
 * ── WHAT THIS FILE BINDS TO, AND WHY IT MOUNTS THE REAL PANEL ───────────────
 * TWO real `ConversationPanel`s over ONE `UseConversationReturn` — the deployed
 * shape (`OlumiTabBody` + `FloatingOlumiPanel`, one singleton conversation).
 * The mapping from "the user settled proposal P" to "which registry keys get
 * written" is PRODUCT code inside the panel; a spec that re-implemented it
 * would be testing its own idea of the wiring (trap 16 — a fixture you wrote
 * yourself is not evidence). So the panel's own `handleHeldProposalSettle` is
 * the code under test, reached through the real card's real button.
 *
 * Every assertion binds by PROPOSAL IDENTITY and TURN IDENTITY together
 * (`data-block-id` inside a turn-scoped container, asserted to length 1), never
 * by position, text or ordinal (trap 19).
 *
 * SCOPE (trap 3): presence/absence of controls and heading text in jsdom. Not
 * layout, not visibility, not z-order.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent, within, act } from '@testing-library/react'
import { useMemo, useState, type ReactElement } from 'react'

import { ConversationPanel } from '../ConversationPanel'
import { ToastProvider } from '../../ToastContext'
import { useCanvasStore } from '../../store'
import { useGuidanceStore } from '../../stores/guidanceStore'
import { useReadinessStore } from '../../stores/readinessStore'
import type { ConversationMessage, ConversationBlock } from '../types'
import type { UseConversationReturn, PatchBlockState, PatchRejectionInfo } from '../useConversation'
import {
  HELD_PROPOSAL_HEADING,
  HELD_PROPOSAL_SETTLED_HEADING,
} from '../../../v5/blocks/heldProposalReasonCopy'

// ---------------------------------------------------------------------------
// Fixtures — one handle, two offers, exactly as CEE's target-key collapse mints
// ---------------------------------------------------------------------------

/**
 * `gmh_` + the first 12 hex of sha256('scn:node:pricing') — the shape
 * `gmHeldProposalRef` emits. The VALUE is arbitrary; what matters is that the
 * two offers below share it, which is the whole premise of this file.
 */
const HANDLE = 'gmh_1a2b3c4d5e6f'
/** A second, genuinely different target — the discriminating control. */
const OTHER_HANDLE = 'gmh_9f8e7d6c5b4a'

const TURN_ONE = 'turn-1-remove'
const TURN_TWO = 'turn-2-rename'

function heldBlock(handle: string, summary: string): ConversationBlock {
  return {
    type: 'v5_held_proposal',
    proposal_id: handle,
    summary,
    mutation_class: 'structural',
    reason_code: 'STRUCTURAL_APPLY_HELD',
    confirm: { label: 'Confirm these changes', message: `confirm ${handle} ${summary}` },
  } as unknown as ConversationBlock
}

function assistantTurn(id: string, blocks: ConversationBlock[]): ConversationMessage {
  return {
    id,
    role: 'assistant',
    content: 'Here is what I propose.',
    timestamp: new Date(),
    blocks,
  }
}

/** Turn 1: CEE holds "remove the Pricing node". */
const REMOVE_TURN = assistantTurn(TURN_ONE, [
  heldBlock(HANDLE, 'Remove the Pricing node'),
])

/**
 * Turn 2: CEE holds "rename the Pricing node". A DIFFERENT change the user
 * has never seen — and, because `mutationTargetKey` maps both to
 * `node:pricing`, the SAME handle.
 */
const RENAME_TURN = assistantTurn(TURN_TWO, [
  heldBlock(HANDLE, 'Rename the Pricing node to "List price"'),
])

/** Turn 2 variant carrying an unrelated handle — the identity control. */
const OTHER_TURN = assistantTurn(TURN_TWO, [
  heldBlock(OTHER_HANDLE, 'Remove the Hiring-delay node'),
])

// ---------------------------------------------------------------------------
// Harness — two real panels, one conversation
// ---------------------------------------------------------------------------

interface Harness {
  /** Append a later assistant turn, as CEE re-issuing the hold would. */
  appendTurn: (message: ConversationMessage) => void
}

let harness: Harness

function TwoPanels({ initial }: { initial: ConversationMessage[] }): ReactElement {
  const [messages, setMessages] = useState<ConversationMessage[]>(initial)
  const [states, setStates] = useState<Map<string, PatchBlockState>>(new Map())

  harness = {
    appendTurn: (message) => setMessages((prev) => [...prev, message]),
  }

  const conversation = useMemo<UseConversationReturn>(
    () =>
      ({
        messages,
        isThinking: false,
        longRunningHint: null,
        lastSendFailure: null,
        dispatchAction: vi.fn().mockResolvedValue(undefined),
        cancelTurn: vi.fn(),
        startNewDraft: vi.fn(async () => {}),
        sendMessage: vi.fn().mockResolvedValue(undefined),
        sendSystemEvent: vi.fn().mockResolvedValue(undefined),
        sendChip: vi.fn().mockResolvedValue(undefined),
        clearHistory: vi.fn(),
        retryLast: vi.fn().mockResolvedValue(undefined),
        patchBlockStates: states,
        // The one settlement authority, behaving as `useConversation`'s own
        // setter does: functional update, new Map, re-render.
        setPatchBlockState: (key: string, state: PatchBlockState) =>
          setStates((prev) => new Map(prev).set(key, state)),
        patchRejections: new Map<string, PatchRejectionInfo>(),
        setPatchRejection: vi.fn(),
      }) as unknown as UseConversationReturn,
    [messages, states],
  )

  return (
    <ToastProvider>
      <div data-testid="surface-dock">
        <ConversationPanel conversation={conversation} onCollapse={vi.fn()} onAttach={vi.fn()} />
      </div>
      <div data-testid="surface-floating">
        <ConversationPanel
          conversation={conversation}
          onCollapse={vi.fn()}
          onAttach={vi.fn()}
          threadTestId="chat-thread-floating"
        />
      </div>
    </ToastProvider>
  )
}

/**
 * Turn order in the rendered transcript, per surface. The thread renders one
 * `chat-message-assistant` container per assistant message, in `messages`
 * order, so container i IS turn i. That mapping is pinned in-test by
 * `TURN_ORDER` below rather than assumed (trap 13b) — an ordinal that nothing
 * pins is exactly the loose binding trap 19 warns about.
 */
const TURN_ORDER: readonly string[] = [TURN_ONE, TURN_TWO]

/**
 * The one card for `handle` inside `turnId` on `surface`, found by IDENTITY
 * within an explicitly-pinned turn scope.
 *
 * Two conjuncts, deliberately: the TURN the card is mounted in, and the
 * PROPOSAL it is about. Either alone is ambiguous here — the same handle is on
 * two turns, and the same turn can carry several proposals — and it is exactly
 * that ambiguity this file exists to pin. `toHaveLength(1)` pins the
 * precondition, so a fixture that stopped producing this card would throw
 * rather than let the assertions pass vacuously.
 */
function cardIn(
  surface: 'surface-dock' | 'surface-floating',
  turnId: string,
  handle: string,
): HTMLElement {
  const scope = screen.getByTestId(surface)
  const containers = within(scope).getAllByTestId('chat-message-assistant')
  const index = TURN_ORDER.indexOf(turnId)
  expect(index).toBeGreaterThanOrEqual(0)
  expect(containers.length).toBeGreaterThan(index)
  const matches = within(containers[index])
    .getAllByTestId('v5-held-proposal')
    .filter((el) => el.getAttribute('data-block-id') === handle)
  expect(matches).toHaveLength(1)
  return matches[0]
}

function isLive(card: HTMLElement): boolean {
  return within(card).queryByTestId('v5-held-proposal-confirm') !== null
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
  // A never-settling fetch: `readinessStore.startListening` fires on the first
  // consumer mount and this panel is one. Left alone it races every assertion.
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
  useReadinessStore.setState({
    readiness: null,
    loading: false,
    error: null,
    stale: false,
    verdictAtMs: null,
  })
  useCanvasStore.setState({
    nodes: [],
    edges: [],
    currentScenarioId: 'a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e4',
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
    results: { status: 'idle' },
    graphHealth: null,
    analysisStateV1: null,
    _externalMutationActive: 0,
  } as never)
  useGuidanceStore.setState({ _sendChip: vi.fn() } as never)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

// ═══════════════════════════════════════════════════════════════════════════

describe('a held proposal is settled per TURN, not for all time', () => {
  it('PRECONDITION — one handle really does render on two turns and two surfaces', () => {
    render(<TwoPanels initial={[REMOVE_TURN, RENAME_TURN]} />)
    // Four cards, one handle: the deployed shape this file reasons about. If
    // this ever stops holding, every assertion below is about something else.
    expect(screen.getAllByTestId('v5-held-proposal')).toHaveLength(4)
    for (const surface of ['surface-dock', 'surface-floating'] as const) {
      // Pin the ordinal→turn mapping `cardIn` relies on: container i really is
      // turn i, evidenced by the offer each one carries. Without this the turn
      // scoping would be an unchecked assumption about render order.
      expect(within(screen.getByTestId(surface)).getAllByTestId('chat-message-assistant'))
        .toHaveLength(TURN_ORDER.length)
      expect(cardIn(surface, TURN_ONE, HANDLE)).toHaveTextContent('Remove the Pricing node')
      expect(cardIn(surface, TURN_TWO, HANDLE)).toHaveTextContent('Rename the Pricing node')
      // …and the two offers really are different changes under one handle,
      // which is the CEE target-key collapse this file is about.
      expect(cardIn(surface, TURN_ONE, HANDLE)).not.toBe(cardIn(surface, TURN_TWO, HANDLE))
    }
  })

  it('FRESH-DEAD — a proposal CEE issues AFTER a settlement is offerable, on every surface', () => {
    render(<TwoPanels initial={[REMOVE_TURN]} />)

    // The user declines "remove the Pricing node". `decline_action_id` is never
    // set by CEE's builder, so this dismiss is LOCAL-ONLY — CEE is never told,
    // and the hold stays open server-side.
    fireEvent.click(
      within(cardIn('surface-dock', TURN_ONE, HANDLE)).getByTestId('v5-held-proposal-dismiss'),
    )
    expect(isLive(cardIn('surface-dock', TURN_ONE, HANDLE))).toBe(false)

    // Two turns later CEE issues a DIFFERENT change against the same target —
    // and therefore the same handle.
    act(() => { harness.appendTurn(RENAME_TURN) })

    for (const surface of ['surface-dock', 'surface-floating'] as const) {
      const fresh = cardIn(surface, TURN_TWO, HANDLE)
      // THE DEFECT: this card mounted already settled — no confirm, no dismiss,
      // heading "No longer waiting for your go-ahead" — for a change the user
      // has never been shown. And the chip row cannot rescue it: it suppresses
      // this turn's confirm/decline ids because a held_proposal block is
      // present. Zero affordance anywhere.
      expect(fresh).not.toHaveAttribute('data-settled')
      expect(within(fresh).getByTestId('v5-held-proposal-heading')).toHaveTextContent(
        HELD_PROPOSAL_HEADING,
      )
      expect(within(fresh).getByTestId('v5-held-proposal-actions')).toBeTruthy()
      expect(within(fresh).getByTestId('v5-held-proposal-confirm')).not.toBeDisabled()
      expect(within(fresh).getByTestId('v5-held-proposal-dismiss')).not.toBeDisabled()
    }
  })

  it('OPPOSITE DIRECTION (stale-live, across turns) — settling retires EVERY copy already on screen', () => {
    render(<TwoPanels initial={[REMOVE_TURN, RENAME_TURN]} />)

    // Both turns are on screen carrying the same handle. The user confirms the
    // newer one.
    fireEvent.click(
      within(cardIn('surface-floating', TURN_TWO, HANDLE)).getByTestId('v5-held-proposal-confirm'),
    )

    // The older copy must NOT keep live controls over a hold that is now
    // resolved — that is the original SENDABLE-5 harm, in its cross-turn form.
    // A fix that merely scoped the key by turn would reopen exactly this.
    for (const surface of ['surface-dock', 'surface-floating'] as const) {
      for (const turn of [TURN_ONE, TURN_TWO]) {
        const card = cardIn(surface, turn, HANDLE)
        expect(card).toHaveAttribute('data-settled', 'accepted')
        expect(within(card).queryByTestId('v5-held-proposal-actions')).toBeNull()
        expect(within(card).getByTestId('v5-held-proposal-heading')).toHaveTextContent(
          HELD_PROPOSAL_SETTLED_HEADING,
        )
      }
    }
  })

  it('OPPOSITE DIRECTION (stale-live, same turn) — settling still retires the other SURFACE', () => {
    render(<TwoPanels initial={[REMOVE_TURN]} />)

    fireEvent.click(
      within(cardIn('surface-dock', TURN_ONE, HANDLE)).getByTestId('v5-held-proposal-confirm'),
    )

    const floating = cardIn('surface-floating', TURN_ONE, HANDLE)
    expect(floating).toHaveAttribute('data-settled', 'accepted')
    expect(within(floating).queryByTestId('v5-held-proposal-confirm')).toBeNull()
  })

  it('AND THE SETTLED COPY STAYS SETTLED once a later turn re-issues the handle', () => {
    // The twin of FRESH-DEAD, and the case that rules out "clear the key when a
    // block bearing that handle arrives on a later turn": clearing would
    // RESURRECT this card, re-opening the stale-live harm in the other
    // direction. Freeing the later turn must not free the earlier one.
    render(<TwoPanels initial={[REMOVE_TURN]} />)

    fireEvent.click(
      within(cardIn('surface-dock', TURN_ONE, HANDLE)).getByTestId('v5-held-proposal-confirm'),
    )
    act(() => { harness.appendTurn(RENAME_TURN) })

    for (const surface of ['surface-dock', 'surface-floating'] as const) {
      const settled = cardIn(surface, TURN_ONE, HANDLE)
      expect(settled).toHaveAttribute('data-settled', 'accepted')
      expect(isLive(settled)).toBe(false)
      // …while the newly-issued offer is live. Both facts in one render: the
      // two turns disagree, which is only possible if settlement is per-turn.
      expect(isLive(cardIn(surface, TURN_TWO, HANDLE))).toBe(true)
    }
  })

  it('DISCRIMINATING CONTROL — settling one handle never touches a different handle', () => {
    render(<TwoPanels initial={[REMOVE_TURN, OTHER_TURN]} />)

    fireEvent.click(
      within(cardIn('surface-dock', TURN_ONE, HANDLE)).getByTestId('v5-held-proposal-confirm'),
    )

    for (const surface of ['surface-dock', 'surface-floating'] as const) {
      expect(cardIn(surface, TURN_ONE, HANDLE)).toHaveAttribute('data-settled', 'accepted')
      const other = cardIn(surface, TURN_TWO, OTHER_HANDLE)
      expect(other).not.toHaveAttribute('data-settled')
      expect(isLive(other)).toBe(true)
    }
  })

  // ── THE ORDERING THAT WAS STILL OPEN AFTER ROUND 2 ────────────────────────
  // `FRESH-DEAD` above settles turn 1 while turn 2 DOES NOT YET EXIST, then
  // appends it. That ordering was already closed: a turn absent from the
  // snapshot gets no key. The ordering below is the one that was not — BOTH
  // turns already in the transcript, and the user settles the EARLIER card.
  //
  // It is the ordinary thing to do. The user asks to remove the Pricing node,
  // changes their mind and asks to rename it instead, CEE re-mints the same
  // handle (a target SLOT, deliberately), and then they scroll up and tidy the
  // stale card away. Unbounded, that settlement swept forward onto the offer
  // they actually want, and `heldProposalConsumedActionIds` had already
  // suppressed the chip row for that turn — so there was no affordance left
  // anywhere on it.
  //
  // Both settlements are exercised because they take DIFFERENT code paths in
  // the card (`v5-held-proposal-dismiss` is local-only; `v5-held-proposal-
  // confirm` also dispatches a chip), and only the shared retirement sweep is
  // fixed here. The confirm case is the worse of the two: the later card reads
  // `accepted` while the confirm the user never pressed targets a hold CEE has
  // already superseded.

  for (const [action, settledValue] of [
    ['v5-held-proposal-dismiss', 'dismissed'],
    ['v5-held-proposal-confirm', 'accepted'],
  ] as const) {
    it(`FRESH-DEAD, the ordering that was open — ${settledValue} on the EARLIER card leaves the LATER one live`, () => {
      render(<TwoPanels initial={[REMOVE_TURN, RENAME_TURN]} />)

      // PRECONDITION, pinned in-test (trap 13b): before the click, BOTH turns
      // are live. Without this the post-click assertions could pass on a card
      // that was never offerable in the first place.
      for (const surface of ['surface-dock', 'surface-floating'] as const) {
        expect(isLive(cardIn(surface, TURN_ONE, HANDLE))).toBe(true)
        expect(isLive(cardIn(surface, TURN_TWO, HANDLE))).toBe(true)
      }

      fireEvent.click(
        within(cardIn('surface-dock', TURN_ONE, HANDLE)).getByTestId(action),
      )

      for (const surface of ['surface-dock', 'surface-floating'] as const) {
        // The card the user pressed retires — on BOTH surfaces. The stale-live
        // harm stays closed.
        const acted = cardIn(surface, TURN_ONE, HANDLE)
        expect(acted).toHaveAttribute('data-settled', settledValue)
        expect(isLive(acted)).toBe(false)

        // …and the LATER offer, the change the user actually asked for, is
        // untouched. This is the assertion that was RED.
        const later = cardIn(surface, TURN_TWO, HANDLE)
        expect(later).not.toHaveAttribute('data-settled')
        expect(within(later).getByTestId('v5-held-proposal-heading')).toHaveTextContent(
          HELD_PROPOSAL_HEADING,
        )
        expect(within(later).getByTestId('v5-held-proposal-actions')).toBeTruthy()
        expect(within(later).getByTestId('v5-held-proposal-confirm')).not.toBeDisabled()
        expect(within(later).getByTestId('v5-held-proposal-dismiss')).not.toBeDisabled()
      }
    })
  }
})
