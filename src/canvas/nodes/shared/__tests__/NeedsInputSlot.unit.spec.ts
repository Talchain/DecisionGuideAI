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
  // Moved here from programUnitWords.cards.spec (DET-HARM D301: a program goal no longer draws the empty slot it was read on).
  it('the dimensionless unit "1" adds nothing beside the field', () => {
    expect(emptyValueUnit('1')).toEqual({})
  })
})
