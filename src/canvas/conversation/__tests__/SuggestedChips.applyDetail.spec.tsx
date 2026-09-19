/**
 * The apply control must say WHAT it would apply.
 *
 * Companion render pin to `src/v5/blocks/__tests__/suggestedActionChips.detail.test.ts`
 * (which pins the mapper). This one pins the SURFACE: carrying `detail` onto
 * the `ActionChip` is worth nothing if the button never exposes it.
 *
 * ─── Why the accessible name + `title`, and not a new visible row ───────────
 * `V5HeldProposalBlock.tsx:209-216` already ratified the rule for exactly this
 * field on the other path: trim; empty-or-equal-to-label → the label stands
 * alone; otherwise the accessible name is `${visible}: ${detail}`. This reuses
 * that rule rather than inventing a second one (trap 21 — one concept, one
 * spelling), and it adds no box to the layout, so it cannot move the chip
 * grammar a green suite is blind to.
 *
 * Every assertion binds by chip IDENTITY (`data-testid="suggested-chip-<id>"`),
 * never by a value predicate a sibling chip could satisfy (trap 19).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import { SuggestedChips } from '../zones/SuggestedChips'
import type { ActionChip } from '../types'

const APPLY_ID = 'rrp_7576c3fbaf58'
const APPLY_LABEL = 'Apply 3 safe model fixes'
const APPLY_DETAIL =
  'Canonicalise the existing effect values for "Hire two engineers" without changing them. ' +
  'Canonicalise the existing effect values for "Raise prices 8%" without changing them. ' +
  'Canonicalise the existing effect values for "Do nothing" without changing them.'

const applyChip: ActionChip = {
  id: APPLY_ID,
  label: APPLY_LABEL,
  intent: 'primary',
  message: 'Yes, apply all 3 safe model fixes.',
  detail: APPLY_DETAIL,
}

const plainChip: ActionChip = {
  id: 'plain_01',
  label: 'What would change this?',
  intent: 'primary',
  message: 'What would change this?',
}

function renderChips(chips: ActionChip[]) {
  return render(<SuggestedChips chips={chips} onChipClick={vi.fn().mockResolvedValue(undefined)} />)
}

describe('SuggestedChips — the apply control exposes its detail', () => {
  it('names every option the apply would touch in the accessible name', () => {
    renderChips([applyChip])
    const button = screen.getByTestId(`suggested-chip-${APPLY_ID}`)
    const name = button.getAttribute('aria-label') ?? ''
    for (const option of ['Hire two engineers', 'Raise prices 8%', 'Do nothing']) {
      expect(name).toContain(option)
    }
  })

  it('keeps the label as the accessible name PREFIX (the detail extends, never replaces)', () => {
    renderChips([applyChip])
    const button = screen.getByTestId(`suggested-chip-${APPLY_ID}`)
    expect(button.getAttribute('aria-label')).toBe(`${APPLY_LABEL}: ${APPLY_DETAIL}`)
  })

  it('exposes the detail on hover via `title`', () => {
    renderChips([applyChip])
    expect(screen.getByTestId(`suggested-chip-${APPLY_ID}`).getAttribute('title')).toBe(APPLY_DETAIL)
  })

  it('renders the LABEL as the visible text — the detail adds no visible box', () => {
    renderChips([applyChip])
    expect(screen.getByTestId(`suggested-chip-${APPLY_ID}`).textContent).toBe(APPLY_LABEL)
  })

  it('OPPOSITE-DIRECTION TWIN: a chip with no detail keeps label-only name and NO title', () => {
    renderChips([plainChip])
    const button = screen.getByTestId('suggested-chip-plain_01')
    expect(button.getAttribute('aria-label')).toBe('What would change this?')
    expect(button.getAttribute('title')).toBeNull()
  })

  it('OPPOSITE-DIRECTION TWIN: detail identical to the label adds nothing (no redundant echo)', () => {
    renderChips([{ ...applyChip, detail: APPLY_LABEL }])
    const button = screen.getByTestId(`suggested-chip-${APPLY_ID}`)
    expect(button.getAttribute('aria-label')).toBe(APPLY_LABEL)
    expect(button.getAttribute('title')).toBeNull()
  })

  it('OPPOSITE-DIRECTION TWIN: whitespace-only detail adds nothing', () => {
    renderChips([{ ...applyChip, detail: '   ' }])
    const button = screen.getByTestId(`suggested-chip-${APPLY_ID}`)
    expect(button.getAttribute('aria-label')).toBe(APPLY_LABEL)
    expect(button.getAttribute('title')).toBeNull()
  })

  it('DISCRIMINATION: with both chips mounted the detail lands only on the apply chip', () => {
    renderChips([applyChip, plainChip])
    expect(screen.getByTestId(`suggested-chip-${APPLY_ID}`).getAttribute('title')).toBe(APPLY_DETAIL)
    expect(screen.getByTestId('suggested-chip-plain_01').getAttribute('title')).toBeNull()
  })

  it('composes with the role prefix rather than displacing it', () => {
    renderChips([{ ...applyChip, role: 'scientist' }])
    expect(screen.getByTestId(`suggested-chip-${APPLY_ID}`).getAttribute('aria-label')).toBe(
      `Scientist: ${APPLY_LABEL}: ${APPLY_DETAIL}`,
    )
  })
})
