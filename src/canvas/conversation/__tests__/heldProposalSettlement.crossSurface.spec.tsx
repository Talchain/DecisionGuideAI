/**
 * SENDABLE failure 5 — a resolved held proposal must retire on EVERY surface.
 *
 * ── THE WITNESSED DEFECT ────────────────────────────────────────────────────
 * After two deletions had been applied and persisted, FOUR "Waiting for your
 * go-ahead / Confirm these changes / Not now" cards were still on screen with
 * `disabled:false`, `pointerEvents:auto` and no resolved marking. Pressing one
 * produced a refusal. Root cause, established at the bytes: `V5HeldProposalBlock`
 * owned settlement in a component-local `useState`, while the canvas mounts TWO
 * conversation surfaces at once (the dock's `OlumiTabBody` and
 * `FloatingOlumiPanel`) reading ONE singleton message list. Local state cannot
 * cross a React instance, so settling one copy left every other copy live.
 *
 * ── WHAT THESE TESTS BIND TO ────────────────────────────────────────────────
 * Two `MessageBubble`s over the SAME message, sharing ONE `patchBlockStates`
 * registry — the deployed shape: two surfaces, one conversation, one proposal.
 * Every assertion binds by PROPOSAL IDENTITY (`data-block-id`, the handle
 * passed to `onHeldProposalSettle`), never by position, text or ordinal — a
 * prior lane bound this family by a text predicate and FIVE elements satisfied
 * it (platform trap 19).
 *
 * Both directions are pinned:
 *   · settled  → every copy retires, controls gone, heading no longer claims
 *                the change is waiting;
 *   · PENDING  → every copy still renders, still has live controls, and confirm
 *                still dispatches the producer's message end to end.
 *
 * ⚠ THE TIME AXIS IS A DIFFERENT FILE. Settlement is keyed on the MOUNT key
 * (turn + handle), not the bare handle, because a CEE hold handle names a
 * target SLOT and is re-minted for later offers against the same target. Both
 * surfaces here share one `message.id`, so they share a key and this file's
 * assertions are untouched by that scoping. What the scoping changes — a later
 * turn re-issuing the same handle — is pinned in
 * `heldProposalSettlement.acrossTurns.spec.tsx`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { useState, type ReactElement } from 'react'

import { MessageBubble } from '../MessageBubble'
import {
  heldProposalMountKey,
  heldProposalRetirementKeys,
  resolveHeldProposalState,
} from '../selectors'
import type { PatchBlockState } from '../useConversation'
import type { ConversationMessage, ConversationBlock } from '../types'
import { useGuidanceStore } from '../../stores/guidanceStore'
import {
  HELD_PROPOSAL_HEADING,
  HELD_PROPOSAL_SETTLED_HEADING,
  HELD_PROPOSAL_CONFIRMED_ACK,
  HELD_PROPOSAL_DISMISSED_ACK,
} from '../../../v5/blocks/heldProposalReasonCopy'

const noop = async () => {}

const HANDLE_A = 'gmh_aaaa1111'
const HANDLE_B = 'gmh_bbbb2222'

function heldBlock(handle: string, summary: string): ConversationBlock {
  return {
    type: 'v5_held_proposal',
    proposal_id: handle,
    summary,
    mutation_class: 'structural',
    reason_code: 'REMOVE_UNCONFIRMED',
    confirm: { label: 'Confirm these changes', message: `confirm ${handle}` },
  } as unknown as ConversationBlock
}

function makeMsg(blocks: ConversationBlock[]): ConversationMessage {
  return {
    id: 'msg-held-settlement',
    role: 'assistant',
    content: 'placeholder prose that repeats nothing',
    timestamp: new Date(),
    blocks,
  }
}

/**
 * The deployed shape in miniature: ONE registry, TWO surfaces.
 *
 * `patchBlockStates` is the conversation's single settlement authority; both
 * `MessageBubble`s read it and both write it through the same setter, exactly
 * as `ConversationPanel` wires the dock and the floating panel.
 */
function TwoSurfaces({ blocks }: { blocks: ConversationBlock[] }): ReactElement {
  const [states, setStates] = useState<Map<string, PatchBlockState>>(new Map())
  const message = makeMsg(blocks)
  // The retirement derivation is PRODUCT code (`ConversationPanel` calls the
  // same function with the same arguments). A fixture that composed the keys
  // itself would be testing this file's idea of the wiring, not the wiring.
  const settle = (proposalId: string, settlement: 'accepted' | 'dismissed', turnId?: string) => {
    setStates((prev) => {
      const next = new Map(prev)
      for (const key of heldProposalRetirementKeys([message], proposalId, turnId)) {
        next.set(key, settlement)
      }
      return next
    })
  }
  return (
    <>
      <div data-testid="surface-dock">
        <MessageBubble
          message={message}
          onChipClick={noop}
          patchBlockStates={states}
          onHeldProposalSettle={settle}
        />
      </div>
      <div data-testid="surface-floating">
        <MessageBubble
          message={message}
          onChipClick={noop}
          patchBlockStates={states}
          onHeldProposalSettle={settle}
        />
      </div>
    </>
  )
}

/** The one card for `handle` inside the named surface, found by IDENTITY. */
function cardIn(surface: 'surface-dock' | 'surface-floating', handle: string): HTMLElement {
  const scope = screen.getByTestId(surface)
  const matches = within(scope)
    .getAllByTestId('v5-held-proposal')
    .filter((el) => el.getAttribute('data-block-id') === handle)
  expect(matches).toHaveLength(1)
  return matches[0]
}

beforeEach(() => {
  useGuidanceStore.setState({ _sendChip: null })
})

describe('held proposal settlement propagates across surfaces', () => {
  it('PRECONDITION — the same proposal really does render on both surfaces', () => {
    render(<TwoSurfaces blocks={[heldBlock(HANDLE_A, 'Remove the pricing risk')]} />)
    // Pins the premise this whole file rests on, in-test: if the fixture ever
    // stopped producing two copies, the cross-surface assertions below would
    // pass vacuously (platform trap 13b — a discriminator must pin its own
    // precondition).
    expect(screen.getAllByTestId('v5-held-proposal')).toHaveLength(2)
    expect(cardIn('surface-dock', HANDLE_A)).toBeTruthy()
    expect(cardIn('surface-floating', HANDLE_A)).toBeTruthy()
  })

  it('confirming on ONE surface retires the SAME proposal on the other', () => {
    const sendChip = vi.fn()
    useGuidanceStore.setState({ _sendChip: sendChip })
    render(<TwoSurfaces blocks={[heldBlock(HANDLE_A, 'Remove the pricing risk')]} />)

    const dock = cardIn('surface-dock', HANDLE_A)
    fireEvent.click(within(dock).getByTestId('v5-held-proposal-confirm'))

    expect(sendChip).toHaveBeenCalledTimes(1)
    expect(sendChip).toHaveBeenCalledWith('Confirm these changes', `confirm ${HANDLE_A}`, undefined)

    // THE DEFECT: this is the copy that kept live controls over a change that
    // had already happened.
    const floating = cardIn('surface-floating', HANDLE_A)
    expect(within(floating).queryByTestId('v5-held-proposal-actions')).toBeNull()
    expect(within(floating).queryByTestId('v5-held-proposal-confirm')).toBeNull()
    expect(within(floating).queryByTestId('v5-held-proposal-dismiss')).toBeNull()
    expect(floating).toHaveAttribute('data-settled', 'accepted')
    expect(within(floating).getByTestId('v5-held-proposal-settled')).toHaveTextContent(
      HELD_PROPOSAL_CONFIRMED_ACK,
    )
    // …and it no longer claims to be waiting for a go-ahead it already has.
    expect(within(floating).getByTestId('v5-held-proposal-heading')).toHaveTextContent(
      HELD_PROPOSAL_SETTLED_HEADING,
    )
    expect(
      within(floating).getByTestId('v5-held-proposal-heading').textContent,
    ).not.toBe(HELD_PROPOSAL_HEADING)
    // The pending "why it is held" sentence is a present-tense claim; it is
    // withheld once the claim is false.
    expect(within(floating).queryByTestId('v5-held-proposal-reason')).toBeNull()
  })

  it('dismissing on ONE surface retires the SAME proposal on the other', () => {
    render(<TwoSurfaces blocks={[heldBlock(HANDLE_A, 'Remove the pricing risk')]} />)

    fireEvent.click(
      within(cardIn('surface-floating', HANDLE_A)).getByTestId('v5-held-proposal-dismiss'),
    )

    const dock = cardIn('surface-dock', HANDLE_A)
    expect(dock).toHaveAttribute('data-settled', 'dismissed')
    expect(within(dock).queryByTestId('v5-held-proposal-actions')).toBeNull()
    expect(within(dock).getByTestId('v5-held-proposal-settled')).toHaveTextContent(
      HELD_PROPOSAL_DISMISSED_ACK,
    )
  })

  it('DISCRIMINATING TWIN — settling proposal A leaves proposal B fully live', () => {
    const sendChip = vi.fn()
    useGuidanceStore.setState({ _sendChip: sendChip })
    render(
      <TwoSurfaces
        blocks={[
          heldBlock(HANDLE_A, 'Remove the pricing risk'),
          heldBlock(HANDLE_B, 'Remove the hiring delay risk'),
        ]}
      />,
    )

    fireEvent.click(within(cardIn('surface-dock', HANDLE_A)).getByTestId('v5-held-proposal-confirm'))

    // A is settled on BOTH surfaces …
    expect(cardIn('surface-dock', HANDLE_A)).toHaveAttribute('data-settled', 'accepted')
    expect(cardIn('surface-floating', HANDLE_A)).toHaveAttribute('data-settled', 'accepted')
    // … and B is untouched on BOTH. Without this, a guard that retired every
    // card on the surface would pass the test above and destroy live consent.
    for (const surface of ['surface-dock', 'surface-floating'] as const) {
      const b = cardIn(surface, HANDLE_B)
      expect(b).not.toHaveAttribute('data-settled')
      expect(within(b).getByTestId('v5-held-proposal-actions')).toBeTruthy()
      expect(within(b).getByTestId('v5-held-proposal-heading')).toHaveTextContent(
        HELD_PROPOSAL_HEADING,
      )
    }
  })

  it('OPPOSITE DIRECTION — a genuinely pending proposal renders, stays live, and confirms end to end', () => {
    const sendChip = vi.fn()
    useGuidanceStore.setState({ _sendChip: sendChip })
    render(<TwoSurfaces blocks={[heldBlock(HANDLE_B, 'Remove the hiring delay risk')]} />)

    for (const surface of ['surface-dock', 'surface-floating'] as const) {
      const card = cardIn(surface, HANDLE_B)
      expect(card).not.toHaveAttribute('data-settled')
      expect(within(card).getByTestId('v5-held-proposal-heading')).toHaveTextContent(
        HELD_PROPOSAL_HEADING,
      )
      expect(within(card).getByTestId('v5-held-proposal-reason')).toBeTruthy()
      const confirm = within(card).getByTestId('v5-held-proposal-confirm')
      expect(confirm).not.toBeDisabled()
      expect(within(card).getByTestId('v5-held-proposal-dismiss')).not.toBeDisabled()
    }

    fireEvent.click(
      within(cardIn('surface-floating', HANDLE_B)).getByTestId('v5-held-proposal-confirm'),
    )

    // The apply path is unchanged: the producer's own message goes out through
    // the single-writer chip seam, and CEE applies it server-side.
    expect(sendChip).toHaveBeenCalledTimes(1)
    expect(sendChip).toHaveBeenCalledWith('Confirm these changes', `confirm ${HANDLE_B}`, undefined)
  })

  it('does not double-dispatch when a second surface re-presses an already-settled proposal', () => {
    const sendChip = vi.fn()
    useGuidanceStore.setState({ _sendChip: sendChip })
    render(<TwoSurfaces blocks={[heldBlock(HANDLE_A, 'Remove the pricing risk')]} />)

    fireEvent.click(within(cardIn('surface-dock', HANDLE_A)).getByTestId('v5-held-proposal-confirm'))
    // The other surface no longer offers a control to press — which IS the fix.
    expect(
      within(cardIn('surface-floating', HANDLE_A)).queryByTestId('v5-held-proposal-confirm'),
    ).toBeNull()
    expect(sendChip).toHaveBeenCalledTimes(1)
  })
})

describe('heldProposalMountKey / resolveHeldProposalState — the MOUNT question', () => {
  const TURN_A = 'turn-aaa'
  const TURN_B = 'turn-bbb'

  it('binds to the proposal HANDLE and namespaces it away from patch ids', () => {
    const states = new Map<string, PatchBlockState>([[HANDLE_A, 'accepted']])
    // A graph-patch entry under the BARE id must not settle a held proposal:
    // the two key spaces share one map and must not collide.
    expect(resolveHeldProposalState(TURN_A, HANDLE_A, states)).toBe('proposed')
    states.set(heldProposalMountKey(TURN_A, HANDLE_A), 'accepted')
    expect(resolveHeldProposalState(TURN_A, HANDLE_A, states)).toBe('accepted')
    // A different handle is a different proposal.
    expect(resolveHeldProposalState(TURN_A, HANDLE_B, states)).toBe('proposed')
  })

  it('is TURN-SCOPED — a settlement on one turn does not settle another turn', () => {
    // ⚠ THIS TEST REPLACES ONE THAT ASSERTED THE OPPOSITE, AND THE REVERSAL IS
    // THE POINT. The first cut of this fix pinned "turn-independent" as
    // desired, reasoning that a CEE hold handle is owned server-side per handle
    // across turns. That is true of the HOLD and false of the OFFER: the handle
    // is `sha256(scenarioId:targetKey)` with no nonce, and re-minting it for a
    // later offer against the same target IS the supersession mechanism
    // (CEE `d1da6706`, edit-graph-referee-gate.ts:696). Turn-independence
    // therefore carried a settlement forward onto a proposal the user had never
    // seen and left it with no affordance at all — see
    // `heldProposalSettlement.acrossTurns.spec.tsx`.
    const states = new Map<string, PatchBlockState>([
      [heldProposalMountKey(TURN_A, HANDLE_A), 'accepted'],
    ])
    expect(resolveHeldProposalState(TURN_A, HANDLE_A, states)).toBe('accepted')
    expect(resolveHeldProposalState(TURN_B, HANDLE_A, states)).toBe('proposed')
    expect(resolveHeldProposalState(TURN_A, HANDLE_A, undefined)).toBe('proposed')
  })

  it('falls back to the bare handle for a message with no id, on BOTH sides', () => {
    // `GraphPatchBlockRenderer` has the same fallback. What matters is that the
    // read and the write agree, so both go through the one helper.
    const states = new Map<string, PatchBlockState>([
      [heldProposalMountKey(undefined, HANDLE_A), 'dismissed'],
    ])
    expect(resolveHeldProposalState(undefined, HANDLE_A, states)).toBe('dismissed')
    expect(heldProposalMountKey(undefined, HANDLE_A)).toBe(`held:${HANDLE_A}`)
    expect(heldProposalMountKey(TURN_A, HANDLE_A)).toBe(`held:${TURN_A}:${HANDLE_A}`)
  })
})

describe('heldProposalRetirementKeys — the RETIREMENT question', () => {
  const TURN_A = 'turn-aaa'
  const TURN_B = 'turn-bbb'

  function turn(id: string, handles: string[]): ConversationMessage {
    return {
      id,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      blocks: handles.map((h) => heldBlock(h, `summary for ${h} on ${id}`)),
    }
  }

  it('returns the mount key of EVERY turn on screen carrying that handle', () => {
    const messages = [turn(TURN_A, [HANDLE_A]), turn(TURN_B, [HANDLE_A, HANDLE_B])]
    expect(heldProposalRetirementKeys(messages, HANDLE_A)).toEqual([
      heldProposalMountKey(TURN_A, HANDLE_A),
      heldProposalMountKey(TURN_B, HANDLE_A),
    ])
  })

  it('OPPOSITE DIRECTION — it returns nothing for a turn that does not carry the handle', () => {
    // The half that keeps a freshly-issued proposal offerable: a turn absent
    // from the snapshot gets no entry, so it mounts live. A version of this
    // function that returned a bare-handle key would settle every future turn
    // too — that is the defect being fixed, in one assertion.
    const messages = [turn(TURN_A, [HANDLE_B])]
    expect(heldProposalRetirementKeys(messages, HANDLE_A)).toEqual([])
    expect(heldProposalRetirementKeys([], HANDLE_A)).toEqual([])
  })

  it('always includes the acting turn, even when the transcript does not show it', () => {
    // Fail towards "the card the user pressed is settled", never towards
    // leaving a live control over a hold the user has already resolved.
    expect(heldProposalRetirementKeys([], HANDLE_A, TURN_A)).toEqual([
      heldProposalMountKey(TURN_A, HANDLE_A),
    ])
    // …and it is not duplicated when the transcript does show it.
    expect(heldProposalRetirementKeys([turn(TURN_A, [HANDLE_A])], HANDLE_A, TURN_A)).toEqual([
      heldProposalMountKey(TURN_A, HANDLE_A),
    ])
  })

  it('binds by proposal identity, not by summary or position', () => {
    // The same handle deliberately carries DIFFERENT summaries on different
    // turns, so any content predicate binds to the wrong card (trap 19).
    const messages = [turn(TURN_A, [HANDLE_A]), turn(TURN_B, [HANDLE_B])]
    expect(heldProposalRetirementKeys(messages, HANDLE_B)).toEqual([
      heldProposalMountKey(TURN_B, HANDLE_B),
    ])
  })
})
