/**
 * ⭐ CONSENT SHOWS WHAT THE CLICK WRITES (build train slice C2 + D-4, #70 5855068711; Paul's test 27 Sep, B3).
 *
 * Paul approved "Add option '£59 for new Pro customers; grandfather existi..." — CEE clamps the chip LABEL, and the
 * product's full sentence (the whole option name, and the factor the click also adds) travels in the chip's
 * `detail` (schemas 0.55 `suggested_actions[].detail`). The apply-chip rule put `detail` in the tooltip and the
 * accessible name only, so what the click writes was readable only on hover. The consent chip now shows its
 * `detail` as visible text under the row, exactly as the research control does (CEE #2042): the click IS the
 * decision, so its content is readable before it.
 *
 * Bound by chip IDENTITY (the `agent-approve-proposal:` id prefix), never by label text or `detail` shape.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import { SuggestedChips } from '../zones/SuggestedChips'
import type { ActionChip } from '../types'

const CONSENT_ID = 'agent-approve-proposal:prop_146aa89d'
// Paul's served label, clamped by the producer (export 90b8f080, user_actions[14].detail.label).
const CLAMPED = "Add option '£59 for new Pro customers; grandfather existi..."
const FULL =
  "Adds the option “£59 for new Pro customers; grandfather existing customers”, linked to Decision: MRR. It also adds the factor “Existing customers grandfathered”."

const consentChip: ActionChip = { id: CONSENT_ID, label: CLAMPED, intent: 'primary', message: 'Yes, add it.', detail: FULL }
const changeFirst: ActionChip = { id: 'agent-change-first:prop_146aa89d', label: 'Change something first', intent: 'secondary', message: 'Change something first' }
const applyChip: ActionChip = {
  id: 'rrp_7576c3fbaf58',
  label: 'Apply 3 safe model fixes',
  intent: 'primary',
  message: 'Yes, apply all 3 safe model fixes.',
  detail: 'Canonicalise the existing effect values for "Do nothing" without changing them.',
}

function renderChips(chips: ActionChip[]) {
  return render(<SuggestedChips chips={chips} onChipClick={vi.fn().mockResolvedValue(undefined)} />)
}

describe('SuggestedChips — the consent chip shows what the click writes', () => {
  it('RED: the full sentence is visible under the row, whole: the option name and the factor the click adds', () => {
    renderChips([consentChip, changeFirst])
    const disclosure = screen.getByTestId(`suggested-chip-disclosure-${CONSENT_ID}`)
    expect(disclosure.textContent).toBe(FULL)
    expect(disclosure.textContent).toContain('grandfather existing customers')
    expect(disclosure.textContent).toContain('Existing customers grandfathered')
    expect(disclosure.textContent).not.toMatch(/\.\.\.|…/)
  })

  it('RED: the chip is described by it; the chip\'s own visible text stays the producer\'s label, byte for byte', () => {
    renderChips([consentChip, changeFirst])
    const button = screen.getByTestId(`suggested-chip-${CONSENT_ID}`)
    const disclosure = screen.getByTestId(`suggested-chip-disclosure-${CONSENT_ID}`)
    expect(button.getAttribute('aria-describedby')?.split(' ')).toContain(disclosure.id)
    expect(button.textContent).toBe(CLAMPED)
    expect(button.getAttribute('title'), 'no hover-only copy once it is visible').toBeNull()
  })

  it('CONTROL: its partner and a non-consent apply chip keep the tooltip rule — no visible disclosure', () => {
    renderChips([consentChip, changeFirst, applyChip])
    expect(screen.queryByTestId(`suggested-chip-disclosure-${changeFirst.id}`)).toBeNull()
    expect(screen.queryByTestId(`suggested-chip-disclosure-${applyChip.id}`)).toBeNull()
    expect(screen.getByTestId(`suggested-chip-${applyChip.id}`).getAttribute('title')).toBe(applyChip.detail)
    expect(screen.getAllByTestId(/^suggested-chip-disclosure-/)).toHaveLength(1)
  })

  it('a consent chip with no detail (today\'s wire) shows no empty disclosure', () => {
    renderChips([{ ...consentChip, detail: undefined }])
    expect(screen.queryByTestId(`suggested-chip-disclosure-${CONSENT_ID}`)).toBeNull()
  })
})
