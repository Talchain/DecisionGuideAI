/**
 * F4 — the held-proposal confirm affordance has a SINGLE owner (the card),
 * so the generic suggested-action chip row must NOT re-render the action(s) a
 * held_proposal block on the same turn consumes.
 *
 * These pins build fixtures from the REAL wire → parseV5Response path (NOT
 * hand-built ConversationBlock objects), so the suppression keys on the same
 * ids the mapper resolves. Fixture shape mirrors the probe / the schema's own
 * held-proposal capture (blocks.ts §HeldProposalBlock evidence): ONE
 * held_proposal block whose confirm_action_id (and optional decline_action_id)
 * reference top-level suggested_actions, plus the legacy diagnostic
 * `type:"error"` / `severity:"warn"` block that rides the same turn.
 *
 * The whole-render "confirm renders exactly once" pin (both surfaces mounted in
 * one tree) lives in
 *   src/canvas/conversation/__tests__/heldProposalSingleConfirmOwner.spec.tsx
 * — it was split out because importing the conversation render graph would
 * drag ~1000 pre-existing errors into the old narrow tsconfig.ci.json
 * typecheck. Those errors are now baselined repo-wide, so this is a
 * separation-of-concerns split rather than a CI constraint.
 */
import { describe, it, expect } from 'vitest'

import { parseV5Response } from '../../responseParser'
import type { OlumiResponseWithExtensions } from '../../responseParser'
import { mapV5Block } from '../mapV5Blocks'
import {
  heldProposalConsumedActionIds,
  buildSuggestedActionChips,
} from '../suggestedActionChips'

// ── Wire fixtures (real parse path) ────────────────────────────────────

const CONFIRM_ID = 'gmh_7576c3fbaf58'
const DECLINE_ID = 'gmh_decline_01'

/**
 * A held-proposal turn shaped like the probe (scenario a9b32212, graph hash
 * gmh_7576c3fbaf58): one held_proposal block referencing the ONE confirm
 * action, the legacy warn error block riding alongside (carries NO chip), and
 * an unrelated conversational action that MUST survive into the chip row.
 */
function heldTurnBody(opts: { withDecline?: boolean } = {}): Record<string, unknown> {
  return {
    response_version: 2,
    assistant_text: 'I can add that, but it reshapes your model.',
    blocks: [
      // Legacy diagnostic error block that rides the held turn — advisory
      // (severity 'warn'), carries NO chip. Present to prove it is not a
      // confirm-affordance source (mapV5Block returns null for it).
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
      // The ONE confirm chip the held block references (single-sourced).
      { id: CONFIRM_ID, label: 'Continue with this change', message: 'Yes' },
      ...(opts.withDecline
        ? [{ id: DECLINE_ID, label: 'Tell me what to adjust', message: 'Let me adjust it first' }]
        : []),
      // An UNRELATED conversational action — never consumed by the held block,
      // so it MUST survive into the chip row.
      { id: 'explain_it', label: 'Explain this', message: 'Explain why this is held' },
    ],
    insights: [],
    stage_indicator: 'analyse',
  }
}

/** A plain turn with the SAME suggested_actions but NO held_proposal block. */
function noHeldTurnBody(): Record<string, unknown> {
  return {
    response_version: 2,
    assistant_text: 'Here are some options.',
    blocks: [{ type: 'text', content: 'Some commentary.' }],
    suggested_actions: [
      { id: CONFIRM_ID, label: 'Continue with this change', message: 'Yes' },
      { id: 'explain_it', label: 'Explain this', message: 'Explain why this is held' },
    ],
    insights: [],
    stage_indicator: 'analyse',
  }
}

function makeResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function parse(body: unknown): Promise<OlumiResponseWithExtensions> {
  const result = await parseV5Response(makeResponse(body))
  if (result.kind !== 'response') {
    throw new Error(`expected a parsed response, got ${result.kind}`)
  }
  return result.response as OlumiResponseWithExtensions
}

// ── heldProposalConsumedActionIds ──────────────────────────────────────

describe('heldProposalConsumedActionIds (real parse path)', () => {
  it('collects the confirm id a held_proposal block references', async () => {
    const response = await parse(heldTurnBody())
    const consumed = heldProposalConsumedActionIds(response.blocks)
    expect([...consumed]).toEqual([CONFIRM_ID])
  })

  it('collects both confirm and decline ids when the block references a decline', async () => {
    const response = await parse(heldTurnBody({ withDecline: true }))
    const consumed = heldProposalConsumedActionIds(response.blocks)
    expect(consumed.has(CONFIRM_ID)).toBe(true)
    expect(consumed.has(DECLINE_ID)).toBe(true)
    expect(consumed.size).toBe(2)
  })

  it('is empty for a turn with no held_proposal block (fail-safe)', async () => {
    const response = await parse(noHeldTurnBody())
    expect(heldProposalConsumedActionIds(response.blocks).size).toBe(0)
  })

  it('tolerates undefined / null blocks without throwing', () => {
    expect(heldProposalConsumedActionIds(undefined).size).toBe(0)
    expect(heldProposalConsumedActionIds(null as never).size).toBe(0)
  })
})

// ── buildSuggestedActionChips ──────────────────────────────────────────

describe('buildSuggestedActionChips (real parse path) — F4 single confirm owner', () => {
  it('drops the confirm action the held card owns, keeping unrelated chips', async () => {
    const response = await parse(heldTurnBody())

    // The card genuinely resolves + owns the confirm (mapper renders it).
    const card = mapV5Block(response.blocks[1], response.suggested_actions)
    expect(card).toMatchObject({ type: 'v5_held_proposal', confirm: { label: 'Continue with this change' } })

    const chips = buildSuggestedActionChips(response.blocks, response.suggested_actions)
    const ids = chips.map((c) => c.id)
    expect(ids).not.toContain(CONFIRM_ID)
    expect(ids).toEqual(['explain_it'])
  })

  it('also drops the decline action when the card renders a decline (identical handling)', async () => {
    const response = await parse(heldTurnBody({ withDecline: true }))

    const card = mapV5Block(response.blocks[1], response.suggested_actions)
    expect(card).toMatchObject({
      type: 'v5_held_proposal',
      confirm: { label: 'Continue with this change' },
      decline: { label: 'Tell me what to adjust' },
    })

    const chips = buildSuggestedActionChips(response.blocks, response.suggested_actions)
    const ids = chips.map((c) => c.id)
    expect(ids).not.toContain(CONFIRM_ID)
    expect(ids).not.toContain(DECLINE_ID)
    expect(ids).toEqual(['explain_it'])
  })

  it('fail-safe: with NO held_proposal block the chip row is unchanged', async () => {
    const response = await parse(noHeldTurnBody())
    const chips = buildSuggestedActionChips(response.blocks, response.suggested_actions)
    expect(chips.map((c) => c.id)).toEqual([CONFIRM_ID, 'explain_it'])
  })

  it('maps wire fields verbatim (id/label/message) and omits absent action_type', async () => {
    const response = await parse(noHeldTurnBody())
    const chips = buildSuggestedActionChips(response.blocks, response.suggested_actions)
    expect(chips[0]).toEqual({
      id: CONFIRM_ID,
      label: 'Continue with this change',
      intent: 'primary',
      message: 'Yes',
    })
    expect(chips[0]).not.toHaveProperty('action_type')
  })
})
