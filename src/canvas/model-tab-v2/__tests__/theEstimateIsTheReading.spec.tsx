/**
 * ⭐ CUT-BACK (Paul, 30 Sep 2026) + AIQ's two conditions (#75 5917333759):
 *  (1) "Olumi: <band>" only when the value IS Olumi's own estimate; any other source keeps "Not set"
 *      and says "Olumi is using a placeholder".
 *  (2) the bracketed number is dropped only when it is the model's own -1..1 scale.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { ModelRowView, estimateWords, PLACEHOLDER_ESTIMATE_COPY } from '../ModelRowView'
import type { ModelRow } from '../types'

afterEach(cleanup)

function factor(over: Partial<ModelRow>): ModelRow {
  return {
    id: 'f1',
    kind: 'factor',
    group: 'factors',
    label: 'Bottom-Up Adoption Friction',
    primaryValue: null,
    attention: [],
    editable: true,
    ...over,
  } as ModelRow
}

describe('estimateWords (condition 2)', () => {
  it.each([
    ['Very high (0.8)', 'Very high'],
    ['Low (0)', 'Low'],
    ['Moderate (-0.25)', 'Moderate'],
  ])('%s → %s', (text, words) => expect(estimateWords(text)).toBe(words))

  it.each(['Moderate (12)', 'High (1.5)', 'No usage pricing', '£49/month', '(0.8)'])('%s stays whole', (text) =>
    expect(estimateWords(text)).toBe(text),
  )
})

describe("the row says whose number it is (condition 1)", () => {
  it("Olumi's own estimate → the reading is \"Olumi: Very high\", no \"Not set\", no 0.8", () => {
    render(<ModelRowView row={factor({ estimateText: 'Very high (0.8)', provenanceSource: 'cee_inference' })} tier="plain" onBeginEdit={() => {}} />)
    const cell = screen.getByTestId('model-row-v2-f1-value')
    expect(cell.textContent).toBe('Olumi: Very high')
  })

  it.each([undefined, 'system_default', 'a_stamp_from_the_future'])(
    'source %s → "Not set" and the placeholder sentence, never "Olumi: <band>"',
    (source) => {
      render(<ModelRowView row={factor({ estimateText: 'Very high (0.8)', provenanceSource: source })} tier="plain" onBeginEdit={() => {}} />)
      const cell = screen.getByTestId('model-row-v2-f1-value')
      expect(cell.textContent).toBe(`Not set${PLACEHOLDER_ESTIMATE_COPY}`)
      expect(cell.textContent).not.toContain('Very high')
    },
  )
})
