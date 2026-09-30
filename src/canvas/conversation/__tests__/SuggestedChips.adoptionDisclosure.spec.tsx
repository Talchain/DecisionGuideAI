/**
 * ⛔ P0 #75 5906888764 (adoption, post-share): the £54 adoption card must show its stored reading — the exact option
 * label and every level with its source — VISIBLY before the click, never only in the accessible name. CEE's
 * `approvalChipsFor` puts that reading in the chip's `detail`; the mapper carries it (`suggestedActionChips.ts:90`).
 * On a consent-prefixed chip (`agent-approve-proposal:`) it renders as the disclosure panel above the buttons.
 * The detail text here is SHAPED like P0's description, not a producer capture (the id prefix is to be confirmed by P0).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { SuggestedChips } from '../zones/SuggestedChips'
import { buildSuggestedActionChips } from '../../../v5/blocks/suggestedActionChips'
import { CONSENT_CHIP_PREFIX } from '../messageComposition'

const ADOPT_ID = `${CONSENT_CHIP_PREFIX}adopt-raise_to_54`
const ADOPT_DETAIL = 'Include ‘Raise to £54’ in your comparison.\nPro plan price: £54 per subscriber / month — Olumi’s estimate, which you would be confirming.'

describe('the adoption card shows what the click approves, before the click', () => {
  it('RED-guard: the wire `detail` survives the mapper and renders as visible text above the Yes button', () => {
    const chips = buildSuggestedActionChips([], [
      { id: ADOPT_ID, label: 'Yes, include it', message: 'Yes, include Raise to £54.', detail: ADOPT_DETAIL } as never,
    ])
    expect(chips[0].detail).toBe(ADOPT_DETAIL)
    render(<SuggestedChips chips={chips} onChipClick={vi.fn().mockResolvedValue(undefined)} />)
    const panel = screen.getByTestId(`suggested-chip-disclosure-${ADOPT_ID}`)
    expect(panel.textContent).toBe(ADOPT_DETAIL)
    expect(panel.textContent).toContain('‘Raise to £54’')
    expect(panel.textContent).toContain('£54 per subscriber / month')
    // The panel precedes the button row in document order: read before the click.
    const row = screen.getByTestId('suggested-chips')
    expect(panel.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(within(row).getByRole('button', { name: /Yes, include it/ })).toBeTruthy()
  })

  it('CONTRAST: the same detail on a NON-consent id is not a visible panel (so the card MUST use the consent prefix)', () => {
    render(<SuggestedChips chips={[{ id: 'adopt-raise_to_54', label: 'Yes, include it', intent: 'primary', message: 'Yes', detail: ADOPT_DETAIL }]} onChipClick={vi.fn().mockResolvedValue(undefined)} />)
    expect(screen.queryByTestId('suggested-chip-disclosure-adopt-raise_to_54')).toBeNull()
  })
})
