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
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { useState, type ReactElement } from 'react'

import { MessageBubble } from '../MessageBubble'
import { heldProposalStateKey, resolveHeldProposalState } from '../selectors'
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
  const settle = (proposalId: string, settlement: 'accepted' | 'dismissed') => {
    setStates((prev) => new Map(prev).set(heldProposalStateKey(proposalId), settlement))
  }
  const message = makeMsg(blocks)
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

describe('heldProposalStateKey / resolveHeldProposalState', () => {
  it('binds to the proposal HANDLE and namespaces it away from patch ids', () => {
    const states = new Map<string, PatchBlockState>([[HANDLE_A, 'accepted']])
    // A graph-patch entry under the BARE id must not settle a held proposal:
    // the two key spaces share one map and must not collide.
    expect(resolveHeldProposalState(HANDLE_A, states)).toBe('proposed')
    states.set(heldProposalStateKey(HANDLE_A), 'accepted')
    expect(resolveHeldProposalState(HANDLE_A, states)).toBe('accepted')
    // A different handle is a different proposal.
    expect(resolveHeldProposalState(HANDLE_B, states)).toBe('proposed')
  })

  it('is turn-independent — the same handle resolves identically for every turn', () => {
    // Deliberate: a held proposal is a server-owned hold HANDLE, not a position
    // in one turn. Keying by turn would let one handle read `proposed` in one
    // turn and `accepted` in another, which is the split this closes.
    const states = new Map<string, PatchBlockState>([
      [heldProposalStateKey(HANDLE_A), 'accepted'],
    ])
    expect(heldProposalStateKey(HANDLE_A)).not.toContain(':turn')
    expect(resolveHeldProposalState(HANDLE_A, states)).toBe('accepted')
    expect(resolveHeldProposalState(HANDLE_A, undefined)).toBe('proposed')
  })
})
