// @vitest-environment jsdom
/**
 * ROADMAP 2.474 residual (a) — THE CONSENT RECORD MUST BE COMPLETE.
 *
 * WHAT THE LIVE WITNESS MEASURED (build e82738b, 5 Aug 2026,
 * `PHASE0-EVIDENCE-2026-07-28/witness-2474-live-2026-08-05.md` + probes D/L):
 * on every structural hold, the confirm control's VISIBLE LABEL, its
 * `aria-label`, AND the user bubble echoed into the permanent transcript were
 * all the SAME string, truncated mid-word with a literal "..." —
 *   "Add factor 'AWS-Specific Cost Risk', add factor 'Azure-Sp..."
 * So the record of what the user consented to stops mid-word, and a
 * screen-reader user's ENTIRE accessible name for the control is that fragment.
 *
 * WHY THE PRODUCER IS NOT AT FAULT. CEE clamps the chip label DELIBERATELY
 * (`edit-graph-referee-gate.ts :: buildGmHeldPublicCopy` — a multi-op subject
 * ran ~300 chars and rendered as one enormous chip) and emits the COMPLETE
 * sentence alongside it in `detail` (0.19.0 `Action.detail`, present in the
 * pinned 0.34.0 `ActionSchema`) precisely so a consumer never has to render
 * the clamped form as the whole truth. The UI's mapper DROPPED `detail`.
 * These pins make the UI consume it.
 *
 * THE CONTRACT PINNED HERE:
 *   1. mapper — `detail` reaches the rendered block (positive control: an
 *      action WITHOUT detail still maps, unchanged).
 *   2. accessible name — COMPLETE, never the clamped fragment.
 *   3. stored consent record — the string handed to the `_sendChip` seam as
 *      display text (which `dispatchAction` passes as `displayText`, i.e. the
 *      permanent user bubble) is COMPLETE.
 *   4. WCAG 2.5.3 Label in Name still holds in BOTH the clamped and the
 *      unclamped case — the accessible name contains the visible label. This
 *      is why the visible label cannot simply be swapped for `detail`'s text
 *      while leaving a clamped string on screen, and why it cannot stay
 *      clamped while the name goes complete: the two must agree.
 *   5. MOUNT PATH — the surface asserted here is the one the deployed build
 *      actually renders: `InlineBlocks` case 'v5_held_proposal', reached from
 *      the real wire → `parseV5Response` → `mapV5Blocks` path, with the
 *      held-proposal card as the SINGLE confirm owner (the chip row stands
 *      down). Verified against the witness DOM captures, in which
 *      `v5-held-proposal-confirm` sits inside `message-assistant`.
 *
 * Fixtures are the LIVE WIRE BYTES from probe D-rung0, copied verbatim from
 * `witness-2474-raw/D/probeD-verdicts.json` — not hand-invented shapes.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'

import { InlineBlocks } from '../../../canvas/conversation/InlineBlocks'
import { SuggestedChips } from '../../../canvas/conversation/zones/SuggestedChips'
import { useGuidanceStore } from '../../../canvas/stores/guidanceStore'
import { parseV5Response } from '../../responseParser'
import { mapV5Blocks } from '../mapV5Blocks'
import { buildSuggestedActionChips } from '../suggestedActionChips'
import { HELD_PROPOSAL_CONFIRM_CLAMPED_LABEL } from '../heldProposalReasonCopy'

// ── LIVE WIRE BYTES (probe D-rung0, CEE build e82738b) ─────────────────────

/** The producer's CLAMPED chip label, exactly as it arrived on the wire. */
const CLAMPED_LABEL = "Add factor 'AWS Pricing Model Flexibility', add factor 'A..."

/** The producer's COMPLETE sentence, exactly as it arrived in `detail`. */
const FULL_DETAIL =
  "Add factor 'AWS Pricing Model Flexibility', add factor 'Azure Microsoft Licensing Synergies', " +
  "add factor 'Hybrid Multi-Cloud Operational Complexity', link 'AWS Pricing Model Flexibility' " +
  "to 'AWS Platform Selection', link 'Azure Microsoft Licensing Synergies' to 'Azure Platform " +
  "Selection' and link 'Hybrid Multi-Cloud Operational Complexity' to 'Hidden and Egress Cost " +
  "Overruns'"

const CONFIRM_MESSAGE = `Yes, ${FULL_DETAIL.charAt(0).toLowerCase()}${FULL_DETAIL.slice(1)}.`

const PROPOSAL_ID = 'gmh_a45b9a7f5255'

/** A producer label that was NOT clamped — the control for every pin below. */
const UNCLAMPED_LABEL = 'Continue with this change'

function heldTurnBody(opts: { clamped: boolean }): Record<string, unknown> {
  return {
    response_version: 2,
    assistant_text: "I'm holding these changes rather than applying them straight away.",
    blocks: [
      {
        type: 'error',
        error_code: 'INTERNAL_ERROR',
        severity: 'warn',
        details: { source: 'graph_management', verdict: 'held', candidate_id: 'cand_1' },
      },
      {
        type: 'held_proposal',
        proposal_id: PROPOSAL_ID,
        summary: `Held for your confirmation: ${FULL_DETAIL}.`,
        mutation_class: 'structural',
        reason_code: 'STRUCTURAL_APPLY_HELD',
        confirm_action_id: PROPOSAL_ID,
      },
    ],
    suggested_actions: [
      opts.clamped
        ? { id: PROPOSAL_ID, label: CLAMPED_LABEL, message: CONFIRM_MESSAGE, detail: FULL_DETAIL }
        : { id: PROPOSAL_ID, label: UNCLAMPED_LABEL, message: CONFIRM_MESSAGE },
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
 * Render the turn exactly as production composes it — the mapped blocks
 * through `InlineBlocks` (the mount path) PLUS the derived chip row, so a
 * second confirm surface would be visible to these pins.
 */
async function renderTurn(opts: { clamped: boolean }) {
  const response = await parseTurn(heldTurnBody(opts))
  const mapped = mapV5Blocks(response.blocks, response.suggested_actions)
  const chips = buildSuggestedActionChips(response.blocks, response.suggested_actions)
  const view = render(
    <>
      <InlineBlocks blocks={mapped} />
      <SuggestedChips chips={chips} onChipClick={vi.fn().mockResolvedValue(undefined)} />
    </>,
  )
  return { view, mapped, chips }
}

/** The accessible name of the confirm control, bound BY TESTID (identity). */
function confirmAccessibleName(): string {
  const btn = screen.getByTestId('v5-held-proposal-confirm')
  return btn.getAttribute('aria-label') ?? btn.textContent ?? ''
}

beforeEach(() => {
  useGuidanceStore.setState({ _sendChip: null })
})

// ───────────────────────────────────────────────────────────────────────────
// 1. MOUNT PATH — assert the surface these pins bind to is the deployed one.
// ───────────────────────────────────────────────────────────────────────────

describe('2.474(a) mount path', () => {
  it('the confirm control is rendered by InlineBlocks case v5_held_proposal, and is the SINGLE confirm owner', async () => {
    const { view } = await renderTurn({ clamped: true })
    const card = screen.getByTestId('v5-held-proposal')
    // The confirm control lives INSIDE the held-proposal card rendered by the
    // conversation block stream — the host the witness DOM captures show.
    expect(within(card).getByTestId('v5-held-proposal-confirm')).toBeInTheDocument()
    // The generic chip row stands down for the consumed id (single owner), so
    // there is exactly ONE control carrying this consent anywhere in the tree.
    expect(
      view.container.querySelectorAll(`[data-testid="suggested-chip-${PROPOSAL_ID}"]`),
    ).toHaveLength(0)
    // Positive control: the row itself rendered (the query can see a chip).
    expect(view.container.querySelector('[data-testid="suggested-chip-explain_it"]')).not.toBeNull()
  })
})

// ───────────────────────────────────────────────────────────────────────────
// 2. MAPPER — the producer's complete sentence reaches the rendered block.
// ───────────────────────────────────────────────────────────────────────────

describe('2.474(a) mapper carries Action.detail', () => {
  it('maps the producer detail onto the confirm action', async () => {
    const response = await parseTurn(heldTurnBody({ clamped: true }))
    const mapped = mapV5Blocks(response.blocks, response.suggested_actions)
    const held = mapped.find((b) => b.type === 'v5_held_proposal')
    expect(held).toBeDefined()
    if (held?.type !== 'v5_held_proposal') throw new Error('not a held proposal block')
    expect(held.confirm.label).toBe(CLAMPED_LABEL)
    expect(held.confirm.detail).toBe(FULL_DETAIL)
  })

  it('POSITIVE CONTROL: an action with no detail maps unchanged (detail absent, label intact)', async () => {
    const response = await parseTurn(heldTurnBody({ clamped: false }))
    const mapped = mapV5Blocks(response.blocks, response.suggested_actions)
    const held = mapped.find((b) => b.type === 'v5_held_proposal')
    if (held?.type !== 'v5_held_proposal') throw new Error('not a held proposal block')
    expect(held.confirm.label).toBe(UNCLAMPED_LABEL)
    expect(held.confirm.detail).toBeUndefined()
  })
})

// ───────────────────────────────────────────────────────────────────────────
// 3. THE ACCESSIBLE NAME — complete, never the clamped fragment.
// ───────────────────────────────────────────────────────────────────────────

describe('2.474(a) accessible name of the confirm control', () => {
  it('names EVERY operation in full — a screen-reader user hears the whole consent', async () => {
    await renderTurn({ clamped: true })
    const name = confirmAccessibleName()
    // Complete by IDENTITY of content: the last operation of the batch, which
    // the clamped label cut off ~320 characters earlier, is present.
    expect(name).toContain("link 'Hybrid Multi-Cloud Operational Complexity' to 'Hidden and Egress Cost Overruns'")
    expect(name).toContain(FULL_DETAIL)
  })

  it('carries no mid-word truncation marker', async () => {
    await renderTurn({ clamped: true })
    expect(confirmAccessibleName()).not.toContain('...')
    expect(confirmAccessibleName()).not.toContain('…')
  })

  it('POSITIVE CONTROL: the absence assertion above CAN see a truncation marker', () => {
    // The producer's clamped label — the exact string the deployed build put in
    // the accessible name — DOES contain the marker the pin looks for. Without
    // this, "not.toContain('...')" could pass by testing nothing.
    expect(CLAMPED_LABEL).toContain('...')
    expect(CLAMPED_LABEL).not.toContain(
      "link 'Hybrid Multi-Cloud Operational Complexity' to 'Hidden and Egress Cost Overruns'",
    )
  })

  it('POSITIVE CONTROL: an unclamped producer label is still announced verbatim', async () => {
    await renderTurn({ clamped: false })
    expect(confirmAccessibleName()).toContain(UNCLAMPED_LABEL)
  })
})

// ───────────────────────────────────────────────────────────────────────────
// 4. THE STORED CONSENT RECORD — what the transcript keeps.
// ───────────────────────────────────────────────────────────────────────────

describe('2.474(a) stored consent record', () => {
  it('hands the COMPLETE sentence to the _sendChip seam as display text', async () => {
    const sendChip = vi.fn()
    useGuidanceStore.setState({ _sendChip: sendChip })
    await renderTurn({ clamped: true })

    fireEvent.click(screen.getByTestId('v5-held-proposal-confirm'))

    expect(sendChip).toHaveBeenCalledTimes(1)
    // arg 0 is the DISPLAY text — `dispatchAction` passes it as `displayText`,
    // which becomes the permanent user bubble. It is the consent record.
    const [displayText, message] = sendChip.mock.calls[0] as [string, string]
    expect(displayText).toBe(FULL_DETAIL)
    expect(displayText).not.toContain('...')
    // The routed message is untouched — CEE's exact-match pre-route depends on
    // it, so this fix must not alter what is sent.
    expect(message).toBe(CONFIRM_MESSAGE)
  })

  it('POSITIVE CONTROL: an unclamped label is recorded verbatim (no behaviour change)', async () => {
    const sendChip = vi.fn()
    useGuidanceStore.setState({ _sendChip: sendChip })
    await renderTurn({ clamped: false })

    fireEvent.click(screen.getByTestId('v5-held-proposal-confirm'))

    expect(sendChip).toHaveBeenCalledWith(UNCLAMPED_LABEL, CONFIRM_MESSAGE)
  })
})

// ───────────────────────────────────────────────────────────────────────────
// 5. WCAG 2.5.3 Label in Name — must hold in BOTH cases.
// ───────────────────────────────────────────────────────────────────────────

describe('2.474(a) WCAG 2.5.3 Label in Name holds in both cases', () => {
  it('clamped: the accessible name contains the visible label', async () => {
    await renderTurn({ clamped: true })
    const btn = screen.getByTestId('v5-held-proposal-confirm')
    const visible = btn.textContent ?? ''
    expect(visible.length).toBeGreaterThan(0)
    // The visible label must itself be COMPLETE — a control may not show a
    // sentence that stops mid-word.
    expect(visible).not.toContain('...')
    expect(confirmAccessibleName()).toContain(visible)
  })

  it('unclamped: the accessible name contains the visible label', async () => {
    await renderTurn({ clamped: false })
    const btn = screen.getByTestId('v5-held-proposal-confirm')
    const visible = btn.textContent ?? ''
    expect(visible).toBe(UNCLAMPED_LABEL)
    expect(confirmAccessibleName()).toContain(visible)
  })

  it('clamped: the control carries the SHORT UI-owned label, not the full sentence', async () => {
    // A deliberate design choice, pinned so a later tidy-up cannot silently
    // put a ~380-character sentence on a rounded chip: the complete text is
    // the NAME and the RECORD, the control itself stays short. Without this
    // pin, swapping the visible label for `detail` passes every other pin here.
    await renderTurn({ clamped: true })
    expect(screen.getByTestId('v5-held-proposal-confirm').textContent).toBe(
      HELD_PROPOSAL_CONFIRM_CLAMPED_LABEL,
    )
    // …and the full naming is still on screen, one element above.
    expect(screen.getByTestId('v5-held-proposal-summary').textContent ?? '').toContain(FULL_DETAIL)
  })
})
