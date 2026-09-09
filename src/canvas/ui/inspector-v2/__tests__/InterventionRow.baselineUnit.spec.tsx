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

describe('InterventionRow — a unit decorates only the value it belongs to', () => {
  it('renders the RAW value with its unit when the producer supplied one', () => {
    render(<InterventionRow {...base} baseline={0.59} rawBaseline={59} unit="£" />)
    expect(screen.getByText(/Currently:/).textContent).toContain('£59')
  })

  it('NEVER renders a currency symbol against a normalised 0-1 value', () => {
    render(<InterventionRow {...base} baseline={0.59} rawBaseline={59} unit="£" />)
    // The witnessed defect, pinned by its exact rendered string.
    expect(screen.getByText(/Currently:/).textContent).not.toContain('£0.59')
  })

  it('drops the unit rather than inventing one when no raw value exists', () => {
    render(<InterventionRow {...base} baseline={0.59} unit="£" />)
    const txt = screen.getByText(/Currently:/).textContent ?? ''
    expect(txt).toContain('0.59')
    expect(txt, 'a unit on a normalised value is an invented figure').not.toContain('£')
  })

  it('a non-currency unit is not smuggled in either', () => {
    render(<InterventionRow {...base} baseline={0.2} unit="scale" />)
    expect(screen.getByText(/Currently:/).textContent).not.toContain('scale')
  })

  it('CONTROL — the delta still measures the normalised pair, unchanged', () => {
    render(<InterventionRow {...base} baseline={0.59} rawBaseline={59} unit="£" />)
    // (0.49 - 0.59) / 0.59 = -16.9% -> 17%, and the sign is a fall.
    expect(screen.getByLabelText(/17% change vs baseline/)).toBeTruthy()
  })
})
