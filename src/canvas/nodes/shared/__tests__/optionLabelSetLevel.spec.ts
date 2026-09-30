/**
 * AIQ rulings 5908802422 + 5908832064: an option label naming a figure its set level no longer matches says the level
 * beside it wherever it stands alone — "Raise to £59 (set to £60)" — never a silent rewrite. Corpus: the served MRR
 * label ("Raise Pro from £49 to £59 …", NodeQuickActions.tooltipCopy spec) and AIQ's ruled example.
 */
import { describe, it, expect } from 'vitest'
import { optionLabelWithSetLevel } from '../optionLabelSetLevel'

describe('an option label with a stale figure says its set level', () => {
  it('RED: the served MRR label after an edit to £60 → "(set to £60)"; the user\'s words are untouched', () => {
    const label = 'Raise Pro from £49 to £59 alongside the Q3 feature release'
    expect(optionLabelWithSetLevel(label, ['£60'])).toBe(`${label} (set to £60)`)
    expect(optionLabelWithSetLevel('Raise to £59', ['£60 / month'])).toBe('Raise to £59 (set to £60 / month)')
    // Every glyph the single source knows (unitClassifier.CURRENCY_SYMBOLS), not a hand-written £/$/€ class.
    expect(optionLabelWithSetLevel('Raise to ¥5,900', ['¥6,000'])).toBe('Raise to ¥5,900 (set to ¥6,000)')
  })

  it('CONTROL: the label already names the set level → unchanged (the never-edited £59 row)', () => {
    expect(optionLabelWithSetLevel('Raise to £59', ['£59'])).toBe('Raise to £59')
    expect(optionLabelWithSetLevel('Raise Pro from £49 to £59', ['£59'])).toBe('Raise Pro from £49 to £59')
    expect(optionLabelWithSetLevel('Hire at £60k', ['£60,000'])).toBe('Hire at £60k')
  })

  it('conservative: no figure in the label, a different currency, several targets, or a reading without one figure → unchanged', () => {
    expect(optionLabelWithSetLevel('Premium tier', ['£60'])).toBe('Premium tier')
    expect(optionLabelWithSetLevel('Raise to $59', ['£60'])).toBe('Raise to $59')
    expect(optionLabelWithSetLevel('Raise to £59', ['£60', '12 months'])).toBe('Raise to £59')
    expect(optionLabelWithSetLevel('Raise to £59', ['High'])).toBe('Raise to £59')
    expect(optionLabelWithSetLevel('Raise to £59', [])).toBe('Raise to £59')
  })
})
