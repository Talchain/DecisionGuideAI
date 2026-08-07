/**
 * V7HeldProposalCard — V7 Lane L6 pins for the held-proposal surface (spec
 * row 10) and the HARD one-confirm invariant (UI PR #424, the doubled-confirm
 * defect Paul hit).
 *
 * Pins: the card shows ≤3 change lines with an overflow count; it offers a
 * single "Review in chat" POINTER (only when the scroll seam is registered) and
 * NEVER a confirm/apply control of its own; and — rendered alongside the
 * conversation's single owner (V5HeldProposalBlock) plus the same-turn
 * suggested-action chip row — exactly ONE confirm affordance exists across the
 * whole DOM. Positive control: the owner's confirm IS counted (the query can
 * see a confirm at all).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { V7HeldProposalCard } from '../V7HeldProposalCard'
import { V5HeldProposalBlock } from '../../../../v5/blocks/V5HeldProposalBlock'
import { buildSuggestedActionChips } from '../../../../v5/blocks/suggestedActionChips'
import { useGuidanceStore, type GuidanceItem } from '../../../../canvas/stores/guidanceStore'
import type { V5HeldProposalBlock as V5HeldProposalBlockType } from '../../../../canvas/conversation/types'

function patchItem(ops: Array<Record<string, unknown>>): GuidanceItem {
  return {
    item_id: 'patch-1',
    source: 'analysis',
    title: 'Add the missing competitor edge',
    detail: 'Your model omits the competitor-price relationship.',
    primary_action: { type: 'approve_patch', operations: ops },
    priority: 50,
  } as GuidanceItem
}

/** Count confirm affordances in the DOM by accessible name (apply / confirm). */
function confirmAffordanceCount(): number {
  return screen
    .queryAllByRole('button')
    .filter((b) => /\b(apply|confirm)\b/i.test(b.getAttribute('aria-label') ?? b.textContent ?? ''))
    .length
}

beforeEach(() => {
  useGuidanceStore.setState({ _scrollToPatch: null, _sendChip: null })
})

describe('V7HeldProposalCard (V7 L6 row 10)', () => {
  it('shows at most three change lines with an overflow count', () => {
    render(
      <V7HeldProposalCard
        item={patchItem([
          { op: 'add_edge' },
          { op: 'update_node' },
          { op: 'set_value' },
          { op: 'remove_edge' },
          { op: 'add_node' },
        ])}
      />,
    )
    const items = screen.getByTestId('v7-held-proposal-items')
    expect(items).toHaveTextContent('Add edge')
    expect(items).toHaveTextContent('Update node')
    expect(items).toHaveTextContent('Set value')
    // Fourth/fifth collapse into a "+2 more" count, never rendered as raw ops.
    expect(items).toHaveTextContent('+2 more')
    expect(items).not.toHaveTextContent('Remove edge')
  })

  it('renders the review POINTER only when the scroll seam is registered, and never a confirm', () => {
    const { rerender } = render(<V7HeldProposalCard item={patchItem([{ op: 'add_edge' }])} />)
    // No seam → no dead button, but the pointer note still routes the user.
    expect(screen.queryByTestId('v7-held-proposal-review')).toBeNull()
    expect(screen.getByText(/confirm or dismiss this in the chat/i)).toBeInTheDocument()

    const scrollToPatch = vi.fn()
    useGuidanceStore.setState({ _scrollToPatch: scrollToPatch })
    rerender(<V7HeldProposalCard item={patchItem([{ op: 'add_edge', patch_id: 'p-42' }])} />)
    const review = screen.getByTestId('v7-held-proposal-review')
    review.click()
    expect(scrollToPatch).toHaveBeenCalledWith('p-42')

    // The card itself carries NO confirm affordance.
    expect(confirmAffordanceCount()).toBe(0)
  })
})

describe('one-confirm invariant (UI PR #424, spec row 10 hazard)', () => {
  const owner: V5HeldProposalBlockType = {
    type: 'v5_held_proposal',
    proposal_id: 'gmh_1',
    summary: 'Olumi wants to add the competitor-price edge.',
    mutation_class: 'structural',
    reason_code: 'needs_confirmation',
    confirm: { label: 'Apply', message: 'apply the held change' },
    decline: { label: 'Not what I meant', message: 'decline' },
  }

  it('renders exactly one confirm across the owner card + the V7 pointer card', () => {
    render(
      <div>
        <V5HeldProposalBlock block={owner} />
        <V7HeldProposalCard item={patchItem([{ op: 'add_edge', patch_id: 'gmh_1' }])} />
      </div>,
    )
    // Positive control: the single owner's confirm IS visible (the query works).
    expect(screen.getByTestId('v5-held-proposal-confirm')).toBeInTheDocument()
    // Invariant: exactly ONE confirm affordance in the whole DOM.
    expect(confirmAffordanceCount()).toBe(1)
    // The V7 card contributes a display-only card, not a second confirm.
    expect(screen.getByTestId('v7-held-proposal-card')).toBeInTheDocument()
  })

  it('the same-turn suggested-action chip row drops the id the owner consumes', () => {
    // The third potential surface — the generic chip row — stands down for the
    // exact confirm id the held_proposal block references (single-owner drop).
    const blocks = [
      { type: 'held_proposal', confirm_action_id: 'act_confirm', proposal_id: 'gmh_1' },
    ] as unknown as Parameters<typeof buildSuggestedActionChips>[0]
    const actions = [
      { id: 'act_confirm', label: 'Apply', message: 'apply' },
      { id: 'act_other', label: 'Explain', message: 'explain' },
    ] as unknown as Parameters<typeof buildSuggestedActionChips>[1]
    const chips = buildSuggestedActionChips(blocks, actions)
    expect(chips.map((c) => c.id)).toEqual(['act_other'])
  })
})
