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
import { ModelOutline } from '../ModelOutline'
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
    'source %s → "Not set" beside "Placeholder: <value>", never "Olumi: <band>"',
    (source) => {
      render(<ModelRowView row={factor({ estimateText: 'Very high (0.8)', provenanceSource: source })} tier="plain" onBeginEdit={() => {}} />)
      const cell = screen.getByTestId('model-row-v2-f1-value')
      expect(cell.textContent).toBe(`Not set${PLACEHOLDER_ESTIMATE_COPY.row('Very high (0.8)')}`)
      expect(cell.textContent).toBe('Not setPlaceholder: Very high')
      expect(cell.textContent).not.toContain('Olumi:')
    },
  )
})

describe('marks that restate the row text are hidden from sight, not from a screen reader', () => {
  it('no-value and unconfirmed-estimate: in the document with their names, sr-only; contested and fragile: drawn', () => {
    render(
      <ModelRowView
        row={factor({ attention: ['no-value', 'unconfirmed-estimate', 'contested', 'fragile'] })}
        tier="plain"
      />,
    )
    for (const reason of ['no-value', 'unconfirmed-estimate']) {
      const mark = screen.getByTestId(`model-row-v2-f1-attention-${reason}`)
      expect(mark.className, reason).toMatch(/\bsr-only\b/)
      expect(mark.getAttribute('aria-label'), reason).toBeTruthy()
    }
    for (const reason of ['contested', 'fragile']) {
      expect(screen.getByTestId(`model-row-v2-f1-attention-${reason}`).className, reason).not.toMatch(/\bsr-only\b/)
    }
  })
})

describe('the heading obeys the same rule on the confirmable-estimate branch (AIQ CR 5918407026)', () => {
  const heading = () => screen.getByTestId('model-group-v2-factors-unknown-summary').textContent
  it('RED: no source + unconfirmed-estimate + no primaryValue → "1 using a placeholder"', () => {
    render(<ModelOutline rows={[factor({ attention: ['unconfirmed-estimate'], provenanceSource: undefined })]} tier="plain" />)
    expect(heading()).toBe('1 using a placeholder')
  })
  it('CONTROL: the same row stamped cee_inference → "1 estimated by Olumi"', () => {
    render(<ModelOutline rows={[factor({ attention: ['unconfirmed-estimate'], provenanceSource: 'cee_inference' })]} tier="plain" />)
    expect(heading()).toBe('1 estimated by Olumi')
  })
})
