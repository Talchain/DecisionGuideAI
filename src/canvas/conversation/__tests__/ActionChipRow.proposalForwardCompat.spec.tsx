/**
 * ActionChipRow — proposal-chip forward-compatibility tests.
 *
 * Workstream 1 forward-compat gate: any future suggested action whose
 * id matches `^prop_[0-9a-f]{12}$` (the proposal-chip naming scheme)
 * MUST render through the standard ActionChipRow pipeline without
 * special-case UI, without crashing on long labels, and without
 * serialising any structured chip metadata (`parameters`,
 * `action_type`, `proposal_ref`) into the DOM.
 *
 * The UI deliberately does NOT re-enforce server-side label length or
 * sanitisation — that contract belongs to CEE's proposal safety filter.
 * The UI's job is to render gracefully and avoid metadata leakage.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { ActionChipRow } from '../ActionChipRow'
import type { ActionChip } from '../types'
import { expectNoChipMetadataLeaks } from '../../../test/helpers/expectNoChipMetadataLeaks'

const PROPOSAL_ID_PATTERN = /^prop_[0-9a-f]{12}$/

function proposalChip(overrides: Partial<ActionChip> = {}): ActionChip {
  return {
    id: 'prop_abcdef012345',
    label: 'Apply suggested change',
    intent: 'primary',
    message: 'apply the proposed change please',
    ...overrides,
  }
}

describe('ActionChipRow — proposal chip forward compatibility', () => {
  it('renders a chip whose id matches `prop_<12hex>` identically to a normal suggested action', () => {
    const chip = proposalChip()
    // Sanity: the id matches the proposal pattern.
    expect(chip.id).toMatch(PROPOSAL_ID_PATTERN)

    const onChipClick = vi.fn().mockResolvedValue(undefined)
    render(<ActionChipRow chips={[chip]} onChipClick={onChipClick} />)

    // Standard testid pattern (`chip-{id}`) — the proposal chip uses
    // the same path as any other suggested action.
    const button = screen.getByTestId(`chip-${chip.id}`)
    expect(button).toBeInTheDocument()
    expect(button.tagName).toBe('BUTTON')
    expect(button.textContent).toBe(chip.label)
    expect(button).not.toBeDisabled()

    // Click dispatches `onChipClick` once with the chip — same contract
    // as every other suggested action.
    fireEvent.click(button)
    expect(onChipClick).toHaveBeenCalledTimes(1)
    expect(onChipClick).toHaveBeenCalledWith(chip)

    expectNoChipMetadataLeaks(button)
  })

  it('renders a natural 80-character proposal label gracefully (UI does not re-enforce server-side length limits)', () => {
    // 80-char natural sentence-case label — the kind of decision-oriented
    // copy that would pass the CEE proposal safety filter. No padding
    // tricks: this is the realistic shape we want to prove renders.
    const longLabel = 'Apply the proposed restructure to your marketing budget allocation by next week.'
    expect(longLabel.length).toBe(80)

    const chip = proposalChip({ label: longLabel })
    render(
      <ActionChipRow chips={[chip]} onChipClick={vi.fn().mockResolvedValue(undefined)} />,
    )
    const button = screen.getByTestId(`chip-${chip.id}`)

    // The full label must remain available in textContent — this proves
    // the UI passes the label through without truncation or sanitisation.
    //
    // Visual wrap / truncate behaviour is purely a CSS concern and is
    // NOT observable in jsdom (no layout engine). If pixel-perfect wrap
    // is part of the acceptance contract for proposal chips, follow up
    // with a Storybook story or a Playwright pixel check — neither
    // belongs in this unit-test file.
    expect(button.textContent).toBe(longLabel)
    expectNoChipMetadataLeaks(button)
  })

  it('does not serialise chip parameters / action_type / proposal_ref into the DOM', () => {
    // Future-state chip carrying the structured metadata that internal
    // routing layers care about. The UI must consume `message` only and
    // leave the rest off the rendered surface.
    const chip = proposalChip({
      action_type: 'apply_proposed_change',
      parameters: {
        proposal_ref: 'pending_action_xyz',
        chip_metadata: { foo: 'bar', nested: { secret: 'value' } },
        handler_id: 'handler-001',
      },
    })
    render(
      <ActionChipRow chips={[chip]} onChipClick={vi.fn().mockResolvedValue(undefined)} />,
    )
    const button = screen.getByTestId(`chip-${chip.id}`)

    // Visible text is just the label.
    expect(button.textContent).toBe(chip.label)

    // No structured metadata leaks. Also assert specific values
    // inline as a belt-and-braces check on top of the helper, so a
    // failure log identifies the exact value that escaped.
    const html = button.outerHTML
    expect(html).not.toContain('pending_action_xyz')
    expect(html).not.toContain('handler-001')
    expect(html).not.toContain('foo')
    expect(html).not.toContain('bar')
    expect(html).not.toContain('secret')

    expectNoChipMetadataLeaks(button)
  })

  it('does not break and does not expose internal metadata when chip carries `public_label` / `public_message`', () => {
    // Forward-compat for the proposal payload contract: future suggested
    // actions may carry `public_label` / `public_message` on their
    // `parameters` object (or anywhere else inside the chip metadata).
    // The current UI must remain stable in their presence — it is free
    // to ignore them per the brief, but it must NOT crash, must not
    // surface them as visible text, and must not serialise them into
    // the rendered DOM.
    const PUBLIC_LABEL_VALUE = 'Friendly preview label that should not leak'
    const PUBLIC_MESSAGE_VALUE = 'Friendly preview message that should not leak'
    const chip = proposalChip({
      action_type: 'apply_proposed_change',
      parameters: {
        public_label: PUBLIC_LABEL_VALUE,
        public_message: PUBLIC_MESSAGE_VALUE,
        proposal_ref: 'pending_action_xyz',
      },
    })
    render(
      <ActionChipRow chips={[chip]} onChipClick={vi.fn().mockResolvedValue(undefined)} />,
    )
    const button = screen.getByTestId(`chip-${chip.id}`)

    // Visible text remains the chip's `label` — public_label/message
    // are NOT promoted onto the rendered surface in the current UI.
    expect(button.textContent).toBe(chip.label)

    // Neither the field names nor the values appear in the DOM.
    const html = button.outerHTML
    expect(html).not.toContain('public_label')
    expect(html).not.toContain('public_message')
    expect(html).not.toContain(PUBLIC_LABEL_VALUE)
    expect(html).not.toContain(PUBLIC_MESSAGE_VALUE)

    expectNoChipMetadataLeaks(button)
  })

  it('keeps the proposal chip clickable when rendered alongside non-proposal chips', () => {
    // Mixed-row guard: the proposal chip must not interfere with sibling
    // chips, and must remain clickable in its own right.
    const proposal = proposalChip({ id: 'prop_0123456789ab', label: 'Apply suggestion' })
    const sibling: ActionChip = {
      id: 'sibling-1',
      label: 'Try a different angle',
      intent: 'secondary',
      message: 'try a different angle please',
    }
    const onChipClick = vi.fn().mockResolvedValue(undefined)
    render(
      <ActionChipRow chips={[sibling, proposal]} onChipClick={onChipClick} />,
    )

    const proposalButton = screen.getByTestId(`chip-${proposal.id}`)
    const siblingButton = screen.getByTestId(`chip-${sibling.id}`)
    expect(proposalButton).toBeInTheDocument()
    expect(siblingButton).toBeInTheDocument()

    fireEvent.click(proposalButton)
    expect(onChipClick).toHaveBeenCalledWith(proposal)

    expectNoChipMetadataLeaks(proposalButton)
    expectNoChipMetadataLeaks(siblingButton)
  })
})
