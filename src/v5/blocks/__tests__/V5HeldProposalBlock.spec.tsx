/**
 * R8 (roadmap 2.27) — DOM + wiring contract for the held-proposal card.
 *
 * Contract:
 *   - WHAT: producer `summary` rendered verbatim.
 *   - WHY: UI copy for reason_code (raw literal pinned here per
 *     DESIGN_SYSTEM.md "Canonical State Copy" — a reworded constant must not
 *     silently drift from the sentence the test promises).
 *   - No internal vocabulary in visible text: the `held_proposal` token, raw
 *     reason_code, mutation_class, and proposal_id ride as data-* only.
 *   - Confirm routes through the guidance store `_sendChip` seam (single
 *     writer); dismiss dispatches the decline action when present, else is
 *     local-only. Fail-closed when `_sendChip` is unavailable.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

import { V5HeldProposalBlock } from '../V5HeldProposalBlock'
import { useGuidanceStore } from '../../../canvas/stores/guidanceStore'
import {
  heldProposalReasonText,
  HELD_PROPOSAL_REASON_COPY,
  REASON_HELD_GENERIC,
} from '../heldProposalReasonCopy'
import type { V5HeldProposalBlock as V5HeldProposalBlockType } from '../../../canvas/conversation/types'

const BLOCK: V5HeldProposalBlockType = {
  type: 'v5_held_proposal',
  proposal_id: 'gmh_ab12cd34ef56',
  summary: 'Add a "regulatory delay" risk feeding into Launch on time',
  mutation_class: 'structural',
  reason_code: 'STRUCTURAL_APPLY_HELD',
  confirm: { label: 'Continue with this change', message: 'Yes' },
}

const STRUCTURAL_HELD_SENTENCE =
  'This reshapes your model, so it needs your go-ahead before it is applied.'

beforeEach(() => {
  useGuidanceStore.setState({ _sendChip: null })
})

describe('V5HeldProposalBlock', () => {
  it('renders the producer summary verbatim and the humanised held reason', () => {
    render(<V5HeldProposalBlock block={BLOCK} />)
    expect(screen.getByTestId('v5-held-proposal-summary')).toHaveTextContent(BLOCK.summary)
    expect(screen.getByTestId('v5-held-proposal-reason')).toHaveTextContent(
      STRUCTURAL_HELD_SENTENCE,
    )
    expect(screen.getByTestId('v5-held-proposal-heading')).toHaveTextContent(
      'Waiting for your go-ahead',
    )
  })

  it('renders the producer confirm label verbatim and a UI-owned dismiss label', () => {
    render(<V5HeldProposalBlock block={BLOCK} />)
    expect(screen.getByTestId('v5-held-proposal-confirm')).toHaveTextContent(
      'Continue with this change',
    )
    expect(screen.getByTestId('v5-held-proposal-dismiss')).toHaveTextContent('Not now')
  })

  it('never renders internal vocabulary as visible text', () => {
    const { container } = render(<V5HeldProposalBlock block={BLOCK} />)
    const visible = container.textContent ?? ''
    expect(visible).not.toContain('held_proposal')
    expect(visible).not.toContain('STRUCTURAL_APPLY_HELD')
    expect(visible).not.toContain('mutation_class')
    expect(visible).not.toContain('structural')
    expect(visible).not.toContain('gmh_ab12cd34ef56')
  })

  it('carries internal identifiers as data-* attributes only', () => {
    render(<V5HeldProposalBlock block={BLOCK} />)
    const card = screen.getByTestId('v5-held-proposal')
    expect(card).toHaveAttribute('data-block-id', 'gmh_ab12cd34ef56')
    expect(card).toHaveAttribute('data-mutation-class', 'structural')
    expect(card).toHaveAttribute('data-reason-code', 'STRUCTURAL_APPLY_HELD')
  })

  it('confirm dispatches the producer message through the _sendChip seam (single writer)', () => {
    const sendChip = vi.fn()
    useGuidanceStore.setState({ _sendChip: sendChip })
    render(<V5HeldProposalBlock block={BLOCK} />)

    fireEvent.click(screen.getByTestId('v5-held-proposal-confirm'))

    expect(sendChip).toHaveBeenCalledTimes(1)
    expect(sendChip).toHaveBeenCalledWith('Continue with this change', 'Yes')
    // Settled: actions replaced by an honest acknowledgement (no "applied" claim).
    expect(screen.queryByTestId('v5-held-proposal-actions')).toBeNull()
    expect(screen.getByTestId('v5-held-proposal-settled')).toHaveTextContent('Sent for you to apply.')
  })

  it('does not double-dispatch on a second confirm click', () => {
    const sendChip = vi.fn()
    useGuidanceStore.setState({ _sendChip: sendChip })
    render(<V5HeldProposalBlock block={BLOCK} />)
    const btn = screen.getByTestId('v5-held-proposal-confirm')
    fireEvent.click(btn)
    fireEvent.click(btn)
    expect(sendChip).toHaveBeenCalledTimes(1)
  })

  it('dismiss with no decline action is local-only (no turn sent)', () => {
    const sendChip = vi.fn()
    useGuidanceStore.setState({ _sendChip: sendChip })
    render(<V5HeldProposalBlock block={BLOCK} />)

    fireEvent.click(screen.getByTestId('v5-held-proposal-dismiss'))

    expect(sendChip).not.toHaveBeenCalled()
    expect(screen.getByTestId('v5-held-proposal-settled')).toHaveTextContent('Dismissed.')
  })

  it('dismiss dispatches the decline action when CEE emits one', () => {
    const sendChip = vi.fn()
    useGuidanceStore.setState({ _sendChip: sendChip })
    render(
      <V5HeldProposalBlock
        block={{ ...BLOCK, decline: { label: 'Adjust it first', message: 'Let me adjust' } }}
      />,
    )
    expect(screen.getByTestId('v5-held-proposal-dismiss')).toHaveTextContent('Adjust it first')

    fireEvent.click(screen.getByTestId('v5-held-proposal-dismiss'))

    expect(sendChip).toHaveBeenCalledWith('Adjust it first', 'Let me adjust')
  })

  // NOTE: this replaces an earlier pin that asserted the card STILL settled when
  // `_sendChip` was null, rationale "so the affordance cannot be re-fired
  // endlessly". That rationale is already served by the `settled` guard on the
  // success path (see the double-dispatch pin above), and settling on a null
  // seam produced a FALSE acknowledgement: "Sent for you to apply." when nothing
  // was sent, with the affordance burned and no retry. `_sendChip` is null by
  // default (guidanceStore initial state) and again on host teardown, so the
  // window is reachable. We adopt the EvidenceBlock precedent instead
  // (InlineBlocks `handleApplyToModel`: `if (!sendChip) return`).
  it('confirm with no _sendChip seam sends nothing and does NOT acknowledge', () => {
    useGuidanceStore.setState({ _sendChip: null })
    render(<V5HeldProposalBlock block={BLOCK} />)

    expect(() => fireEvent.click(screen.getByTestId('v5-held-proposal-confirm'))).not.toThrow()

    // Nothing was sent, so the card must not claim it was.
    expect(screen.queryByTestId('v5-held-proposal-settled')).toBeNull()
    // …and the affordance stays live rather than being burned.
    expect(screen.getByTestId('v5-held-proposal-actions')).toBeTruthy()
    expect(screen.getByTestId('v5-held-proposal-confirm')).toBeTruthy()
  })

  it('confirm still works after a host registers late (the affordance was not burned)', () => {
    useGuidanceStore.setState({ _sendChip: null })
    render(<V5HeldProposalBlock block={BLOCK} />)
    fireEvent.click(screen.getByTestId('v5-held-proposal-confirm'))

    // A conversation host registers after the first (no-op) click. act() so the
    // subscribed component re-renders with the live seam before the next click.
    const sendChip = vi.fn()
    act(() => {
      useGuidanceStore.setState({ _sendChip: sendChip })
    })
    fireEvent.click(screen.getByTestId('v5-held-proposal-confirm'))

    expect(sendChip).toHaveBeenCalledTimes(1)
    expect(sendChip).toHaveBeenCalledWith('Continue with this change', 'Yes')
    expect(screen.getByTestId('v5-held-proposal-settled')).toHaveTextContent(
      'Sent for you to apply.',
    )
  })

  // -------------------------------------------------------------------------
  // WCAG 2.5.3 "Label in Name" (Level A): the accessible name must CONTAIN the
  // visible label, so a speech-input user saying the visible words activates the
  // control. Construction matches the ratified SuggestedChips idiom
  // (`${prefix}: ${label}`), which always contains the visible label.
  // -------------------------------------------------------------------------
  it('confirm accessible name contains its visible label (WCAG 2.5.3)', () => {
    render(<V5HeldProposalBlock block={BLOCK} />)
    const confirm = screen.getByTestId('v5-held-proposal-confirm')
    const visible = confirm.textContent ?? ''
    expect(visible).toBe('Continue with this change')
    expect(confirm.getAttribute('aria-label') ?? '').toContain(visible)
  })

  it('dismiss accessible name contains its visible label (WCAG 2.5.3, UI-owned label)', () => {
    render(<V5HeldProposalBlock block={BLOCK} />)
    const dismiss = screen.getByTestId('v5-held-proposal-dismiss')
    const visible = dismiss.textContent ?? ''
    expect(visible).toBe('Not now')
    expect(dismiss.getAttribute('aria-label') ?? '').toContain(visible)
  })

  it('dismiss accessible name contains the PRODUCER decline label (WCAG 2.5.3)', () => {
    render(
      <V5HeldProposalBlock
        block={{ ...BLOCK, decline: { label: 'Adjust it first', message: 'Let me adjust' } }}
      />,
    )
    const dismiss = screen.getByTestId('v5-held-proposal-dismiss')
    const visible = dismiss.textContent ?? ''
    expect(visible).toBe('Adjust it first')
    expect(dismiss.getAttribute('aria-label') ?? '').toContain(visible)
  })
})

// ---------------------------------------------------------------------------
// Fail-closed reason copy. The block still renders honestly for a code the UI
// has never seen, and the raw code NEVER reaches user-facing copy — that is the
// whole point of the code-keyed enum (no internal-doctrine-prose leak, 1.43).
// ---------------------------------------------------------------------------
describe('heldProposalReasonText fail-closed fallback', () => {
  const UNKNOWN_CODE = 'SOME_FUTURE_HOLD_CODE_V9'

  it('resolves an unknown code to the generic held sentence, not the raw code', () => {
    const text = heldProposalReasonText(UNKNOWN_CODE)
    expect(text).toBe(REASON_HELD_GENERIC)
    expect(text).not.toContain(UNKNOWN_CODE)
  })

  it('resolves every pinned code to its own sentence, never echoing the code', () => {
    for (const [code, sentence] of Object.entries(HELD_PROPOSAL_REASON_COPY)) {
      expect(heldProposalReasonText(code)).toBe(sentence)
      expect(heldProposalReasonText(code)).not.toContain(code)
    }
  })

  it('renders the generic sentence for an unknown code and never leaks the raw code', () => {
    const { container } = render(
      <V5HeldProposalBlock block={{ ...BLOCK, reason_code: UNKNOWN_CODE }} />,
    )
    expect(screen.getByTestId('v5-held-proposal-reason')).toHaveTextContent(REASON_HELD_GENERIC)
    expect(container.textContent ?? '').not.toContain(UNKNOWN_CODE)
    // The code still rides as a data-* attribute (telemetry), just not as copy.
    expect(screen.getByTestId('v5-held-proposal')).toHaveAttribute('data-reason-code', UNKNOWN_CODE)
  })
})
