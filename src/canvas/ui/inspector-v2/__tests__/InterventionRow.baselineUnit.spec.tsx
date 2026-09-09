/**
 * A unit belongs to the value it decorates — witnessed defect, staging d913bd1f.
 *
 * WHAT WAS ON SCREEN. The option inspector showed `Currently: £0.59` for a
 * factor whose real value is £59, and `Currently: £0.2` for "Pro Feature Value
 * Perception", which is not money at all. Both come from one call site.
 *
 * THE MECHANISM. `InterventionRowProps.baseline` was documented "Baseline value
 * in raw units". `OptionPanel` passes `observedState.value` — the NORMALISED
 * 0-1 model value — together with `unit: observedState.unit` ('£'), and
 * `formatValue` prefixes the currency symbol. So a 0-1 number was rendered as
 * currency, wrong by a factor of 100 on the witnessed model.
 *
 * `OptionPanel` already computed the correct field, `rawBaseline` from
 * `observedState.raw_value`, two lines below — and it was DEAD, passed nowhere.
 *
 * WHY NOT MULTIPLY BY 100. The wire value is correctly normalised and the
 * normalisation factor is not on the wire; inferring it would invent a unit,
 * which is exactly what the option-node spec forbids ("do not invent units,
 * baseline values or before/after quantities"). So: display the raw value with
 * its unit when the producer supplied one, and otherwise display the normalised
 * number with NO unit. Never pair the two.
 *
 * THE DELTA IS UNTOUCHED and must stay that way: it is computed from `baseline`
 * against `currentValue`, both normalised, so it is a correct proportional
 * change. Swapping `baseline` to raw would compute (0.49 - 59) / 59.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { InterventionRow } from '../shared/InterventionRow'

const base = {
  factorId: 'fac_price',
  factorLabel: 'Pro Plan Monthly Price',
  currentValue: 0.49,
  onChange: vi.fn(),
}

/**
 * ⚠⚠ THESE NOW RENDER IN `techMode`, AND THAT IS A CHANGE OF SURFACE, NOT OF
 * SUBJECT. The `£0.59` defect was a FORMATTER defect — a unit attached to a
 * normalised value — and the formatter is unchanged and still guarded here.
 * What moved is where its output appears: the ordinary row no longer shows the
 * recorded figure at all, because this surface cannot establish its role or its
 * scale, so it is an operator diagnostic. The formatter must still never invent
 * a magnitude on the one surface that does print it.
 */
describe('InterventionRow — a unit decorates only the value it belongs to', () => {
  it('renders the RAW value with its unit when the producer supplied one', () => {
    render(<InterventionRow {...base} baseline={0.59} rawBaseline={59} unit="£" techMode />)
    expect(screen.getByText(/Recorded:/).textContent).toContain('£59')
  })

  it('NEVER renders a currency symbol against a normalised 0-1 value', () => {
    render(<InterventionRow {...base} baseline={0.59} rawBaseline={59} unit="£" techMode />)
    // The witnessed defect, pinned by its exact rendered string.
    expect(screen.getByText(/Recorded:/).textContent).not.toContain('£0.59')
  })

  it('drops the unit rather than inventing one when no raw value exists', () => {
    render(<InterventionRow {...base} baseline={0.59} unit="£" techMode />)
    const txt = screen.getByText(/Recorded:/).textContent ?? ''
    expect(txt).toContain('0.59')
    expect(txt, 'a unit on a normalised value is an invented figure').not.toContain('£')
  })

  it('a non-currency unit is not smuggled in either', () => {
    render(<InterventionRow {...base} baseline={0.2} unit="scale" techMode />)
    expect(screen.getByText(/Recorded:/).textContent).not.toContain('scale')
  })

  it('CONTROL — no percentage is offered at all, on either surface', () => {
    // ⚠⚠ THIS ASSERTED THE OPPOSITE UNTIL REVIEW: "the delta still measures the
    // normalised pair, unchanged", expecting `17% change vs the recorded value`.
    // The arithmetic was right and the CLAIM was not — a ratio needs a reference
    // whose role and scale are established, and `observedState.value` has
    // neither declared at the contract. It is inverted rather than deleted so
    // the suite records that the percentage went deliberately.
    for (const techMode of [false, true]) {
      const { container, unmount } = render(
        <InterventionRow {...base} baseline={0.59} rawBaseline={59} unit="£" techMode={techMode} />,
      )
      expect(container.textContent, `techMode=${techMode}`).not.toMatch(/\d\s*%/)
      unmount()
    }
  })
})
