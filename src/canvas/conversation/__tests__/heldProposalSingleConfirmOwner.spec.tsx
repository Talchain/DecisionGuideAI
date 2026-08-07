// @vitest-environment jsdom
/**
 * F4 — held-proposal confirm affordance renders ONCE (single owner).
 *
 * DIAGNOSIS pinned here: on a held-proposal turn the confirm affordance was
 * rendered by TWO surfaces at once —
 *   1. the held-proposal CARD's confirm button (V5HeldProposalBlock, resolved
 *      from the block's confirm_action_id), and
 *   2. the generic suggested-action chip row (SuggestedChips), because the
 *      SAME action was also emitted into the turn's actionChips.
 * (The legacy diagnostic `type:"error"` / `severity:"warn"` block that rides
 * the turn is a NON-contributor: mapV5Block returns null for it.)
 *
 * OWNERSHIP RULE (mirrors C1 "single Rerun owner"): the CARD owns the confirm /
 * decline affordance it consumes via confirm_action_id / decline_action_id;
 * buildSuggestedActionChips drops exactly those ids from the chip row.
 *
 * These pins mount BOTH surfaces in one tree — exactly as a real assistant turn
 * does — and count confirm/decline controls across the whole render (the
 * collectRerunControls "match by accessible name, whole-tree" style), so a
 * re-duplication on EITHER surface fails the pin. Fixtures come from the REAL
 * wire → parseV5Response → mapV5Blocks path, never hand-built blocks.
 *
 * RED→GREEN: with the ownership filter reverted the confirm count is 2 (the
 * documented pre-fix duplicate); with it in place the count is 1.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, within } from '@testing-library/react'
import type { ReactElement } from 'react'

import { InlineBlocks } from '../InlineBlocks'
import { SuggestedChips } from '../zones/SuggestedChips'
import { useGuidanceStore } from '../../stores/guidanceStore'
import { parseV5Response } from '../../../v5/responseParser'
import { mapV5Blocks } from '../../../v5/blocks/mapV5Blocks'
import { buildSuggestedActionChips } from '../../../v5/blocks/suggestedActionChips'

// ── Wire fixtures (real parse path) — probe scenario a9b32212 ───────────

const CONFIRM_ID = 'gmh_7576c3fbaf58'
const CONFIRM_LABEL = 'Continue with this change'
const DECLINE_ID = 'gmh_decline_01'
const DECLINE_LABEL = 'Tell me what to adjust'

function heldTurnBody(opts: { withDecline?: boolean } = {}): Record<string, unknown> {
  return {
    response_version: 2,
    assistant_text: 'I can add that, but it reshapes your model.',
    blocks: [
      {
        type: 'error',
        error_code: 'INTERNAL_ERROR',
        severity: 'warn',
        details: { source: 'graph_management', verdict: 'held', candidate_id: 'cand_99' },
      },
      {
        type: 'held_proposal',
        proposal_id: CONFIRM_ID,
        summary: 'Add a "regulatory delay" risk feeding into Launch on time',
        mutation_class: 'structural',
        reason_code: 'STRUCTURAL_APPLY_HELD',
        confirm_action_id: CONFIRM_ID,
        ...(opts.withDecline ? { decline_action_id: DECLINE_ID } : {}),
      },
    ],
    suggested_actions: [
      { id: CONFIRM_ID, label: CONFIRM_LABEL, message: 'Yes' },
      ...(opts.withDecline
        ? [{ id: DECLINE_ID, label: DECLINE_LABEL, message: 'Let me adjust it first' }]
        : []),
      { id: 'explain_it', label: 'Explain this', message: 'Explain why this is held' },
    ],
    insights: [],
    stage_indicator: 'analyse',
  }
}

function noHeldTurnBody(): Record<string, unknown> {
  return {
    response_version: 2,
    assistant_text: 'Here are some options.',
    blocks: [{ type: 'text', content: 'Some commentary.' }],
    suggested_actions: [
      { id: CONFIRM_ID, label: CONFIRM_LABEL, message: 'Yes' },
      { id: 'explain_it', label: 'Explain this', message: 'Explain why this is held' },
    ],
    insights: [],
    stage_indicator: 'analyse',
  }
}

async function parseTurn(body: unknown) {
  const result = await parseV5Response(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
  if (result.kind !== 'response') throw new Error(`expected response, got ${result.kind}`)
  return result.response
}

/**
 * Render a full assistant turn exactly as production composes it: the mapped
 * blocks (the held-proposal card, error dropped) AND the derived chip row,
 * mounted together in one tree.
 */
function renderTurn(response: Awaited<ReturnType<typeof parseTurn>>): ReactElement {
  const mappedBlocks = mapV5Blocks(response.blocks, response.suggested_actions)
  const actionChips = buildSuggestedActionChips(response.blocks, response.suggested_actions)
  return (
    <>
      <InlineBlocks blocks={mappedBlocks} />
      <SuggestedChips chips={actionChips} onChipClick={vi.fn().mockResolvedValue(undefined)} />
    </>
  )
}

/**
 * Every button in `scope` whose ACCESSIBLE NAME contains `label` — a confirm
 * affordance whichever surface renders it (the card's confirm button names the
 * label verbatim; a chip's accessible name is the label; the card's DECLINE
 * button names "Dismiss: <label>", which still contains it). Whole-tree, so a
 * re-duplication on either surface is caught. Mirrors collectRerunControls.
 */
function collectAffordances(scope: HTMLElement, label: string): HTMLElement[] {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return within(scope).queryAllByRole('button', { name: new RegExp(escaped) })
}

beforeEach(() => {
  useGuidanceStore.setState({ _sendChip: vi.fn() })
})

// ── RED→GREEN: exactly one confirm affordance across both surfaces ─────

describe('F4 — held-proposal confirm affordance renders once (single owner)', () => {
  it('renders the confirm affordance EXACTLY ONCE across the whole turn — owned by the card', async () => {
    const response = await parseTurn(heldTurnBody())
    const { container } = render(renderTurn(response))

    // Whole-tree: exactly one control carries the confirm label. Pre-fix this
    // was 2 (card button + chip); the ownership filter drops the chip.
    const confirmControls = collectAffordances(container, CONFIRM_LABEL)
    expect(confirmControls).toHaveLength(1)

    // The surviving owner is the CARD's confirm button, not a chip.
    const [owner] = confirmControls
    expect(owner).toHaveAttribute('data-testid', 'v5-held-proposal-confirm')

    // The generic chip row rendered no chip for the consumed confirm action…
    expect(container.querySelector(`[data-testid="suggested-chip-${CONFIRM_ID}"]`)).toBeNull()
    // …but the unrelated conversational chip still renders (fail-safe: only the
    // consumed id drops, the row is otherwise untouched).
    expect(container.querySelector('[data-testid="suggested-chip-explain_it"]')).not.toBeNull()
  })

  it('handles the decline affordance identically — the card owns it, the chip row does not repeat it', async () => {
    const response = await parseTurn(heldTurnBody({ withDecline: true }))
    const { container } = render(renderTurn(response))

    // Confirm still single-owned.
    expect(collectAffordances(container, CONFIRM_LABEL)).toHaveLength(1)

    // Decline label appears on exactly one control — the card's dismiss button.
    const declineControls = collectAffordances(container, DECLINE_LABEL)
    expect(declineControls).toHaveLength(1)
    expect(declineControls[0]).toHaveAttribute('data-testid', 'v5-held-proposal-dismiss')

    // Neither consumed action leaks into the chip row.
    expect(container.querySelector(`[data-testid="suggested-chip-${CONFIRM_ID}"]`)).toBeNull()
    expect(container.querySelector(`[data-testid="suggested-chip-${DECLINE_ID}"]`)).toBeNull()
    expect(container.querySelector('[data-testid="suggested-chip-explain_it"]')).not.toBeNull()
  })

  it('fail-safe: a turn with the same suggested_actions but NO held_proposal block renders the chip row unchanged', async () => {
    const response = await parseTurn(noHeldTurnBody())
    const { container } = render(renderTurn(response))

    // No card is present…
    expect(container.querySelector('[data-testid="v5-held-proposal"]')).toBeNull()
    // …so the confirm action renders as a normal chip (zero behaviour change).
    const confirmControls = collectAffordances(container, CONFIRM_LABEL)
    expect(confirmControls).toHaveLength(1)
    expect(confirmControls[0]).toHaveAttribute('data-testid', `suggested-chip-${CONFIRM_ID}`)
    expect(container.querySelector('[data-testid="suggested-chip-explain_it"]')).not.toBeNull()
  })
})
