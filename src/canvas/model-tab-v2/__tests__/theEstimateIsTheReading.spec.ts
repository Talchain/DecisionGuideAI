/**
 * ⭐ CUT-BACK (Paul, 30 Sep 2026): a factor Olumi estimated reads "Olumi: Very high", not
 * "Not set  Olumi: Very high (0.8)". The number in brackets is the model's 0–1 scale.
 */
import { describe, expect, it } from 'vitest'
import { estimateWords } from '../ModelRowView'

describe('estimateWords', () => {
  it.each([
    ['Very high (0.8)', 'Very high'],
    ['Low (0)', 'Low'],
    ['Moderate (-0.25)', 'Moderate'],
  ])('%s → %s', (text, words) => {
    expect(estimateWords(text)).toBe(words)
  })

  it.each(['No usage pricing', '£49/month', '(0.8)', 'Two AEs added (0.5 of plan)'])(
    'leaves %s alone (no word-then-bare-number shape)',
    (text) => {
      expect(estimateWords(text)).toBe(text)
    },
  )
})
