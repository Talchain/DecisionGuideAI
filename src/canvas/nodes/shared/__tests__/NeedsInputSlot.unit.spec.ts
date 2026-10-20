/** Canvas option 3: where an empty value's unit sits, through the one money rule (`moneyFigureParts`). */
import { describe, it, expect } from 'vitest'
import { emptyValueUnit } from '../NeedsInputSlot'

describe('emptyValueUnit', () => {
  it('a currency code shows its glyph before the field', () => {
    expect(emptyValueUnit('GBP')).toEqual({ prefix: '£' })
  })
  it('CONTRAST: any other unit sits after the field, and no unit adds nothing', () => {
    expect(emptyValueUnit('tickets per week')).toEqual({ suffix: 'tickets per week' })
    expect(emptyValueUnit(undefined)).toEqual({})
  })
})
