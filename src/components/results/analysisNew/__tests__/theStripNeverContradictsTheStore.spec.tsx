/**
 * R7 / X4 — the strip never says something the store contradicts.
 *
 * Two rows from Panel's R7 inventory (olumi-programme-docs
 * `evidence/panel-r7-inventory-20260927`), both cases of the served tab
 * showing something other than what the store holds:
 *
 *   `ms-no-value-set-false`: the factor detail read "No value set" for a
 *     factor that CARRIES a value the formatter declines to render (no usable
 *     unit). The strip's count moved to `hasValue` long ago; the detail line
 *     had not.
 *   `ms-title-brief-first-sentence`: the title cut the user's own question at
 *     the first "." anywhere, so "Should we raise £1.5m?" rendered "Should we
 *     raise £1.".
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

const nodes: Record<string, unknown>[] = []

type MockState = { nodes: unknown; setHighlightedNodes: unknown }
vi.mock('../../../../canvas/store', () => {
  const read = (): MockState => ({ nodes, setHighlightedNodes: vi.fn() })
  const useCanvasStore = (select: (s: MockState) => unknown) => select(read())
  ;(useCanvasStore as unknown as { getState: () => MockState }).getState = read
  return { useCanvasStore }
})
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: () => true }))
vi.mock('../../../../canvas/utils/highlightHelpers', () => ({
  highlightNode: vi.fn(),
  clearHighlight: vi.fn(),
}))
vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/ToastContext', () => ({ useShowToastSafe: () => vi.fn() }))
vi.mock('../../../../canvas/hooks/useModelEditAuthority', () => ({
  useModelEditAuthority: () => ({
    proposeFactorValue: vi.fn(() => 'dispatched'),
    proposeOptionIntervention: vi.fn(),
    proposeFactorConfirmation: vi.fn(),
  }),
}))

import { ModelStrip, oneSentence } from '../sections/ModelStrip'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'

const TID = 'analysis-new-model-strip'

const factor = (id: string, observedState?: Record<string, unknown>) => ({
  id,
  type: 'factor',
  data: { label: `Factor ${id}`, ...(observedState ? { observedState } : {}) },
})

beforeEach(() => {
  nodes.length = 0
})
afterEach(cleanup)

const openDetailFor = (id: string) => {
  render(<ModelStrip isPreRun={false} />)
  fireEvent.click(screen.getByTestId(`${TID}-toggle`))
  const mark = screen.getAllByTestId(`${TID}-mark`).find((el) => el.getAttribute('data-node-id') === id)!
  fireEvent.click(mark)
  return screen.getByTestId(`${TID}-detail-value-text`)
}

describe('⛔ a factor that HAS a value is never told it has none', () => {
  beforeEach(() => {
    nodes.push(
      { id: 'g1', type: 'goal', data: { label: 'Protect net revenue retention' } },
      // A value the formatter declines to render: no usable unit.
      factor('f_hidden', { value: 0.42, unit: 'index', source: 'cee_inference' }),
      factor('f_bare'),
      factor('f_shown', { value: 0.42, raw_value: 42, unit: '£', source: 'user_override' }),
    )
  })

  it('a declined value reads "set but can\'t be shown", never "No value set"', () => {
    const shown = openDetailFor('f_hidden')
    expect(shown).toHaveAttribute('data-has-value', 'true')
    expect(shown).toHaveTextContent(COPY.modelStrip.valueNotShown)
    expect(shown).not.toHaveTextContent(COPY.modelStrip.noValue)
  })

  it('CONTROL: a factor with no value still says so', () => {
    const shown = openDetailFor('f_bare')
    expect(shown).toHaveAttribute('data-has-value', 'false')
    expect(shown).toHaveTextContent(COPY.modelStrip.noValue)
  })

  it('CONTROL: a displayable value is shown as itself', () => {
    const shown = openDetailFor('f_shown')
    expect(shown).toHaveAttribute('data-has-value', 'true')
    expect(shown.textContent).not.toBe(COPY.modelStrip.noValue)
    expect(shown.textContent).not.toBe(COPY.modelStrip.valueNotShown)
  })
})

describe('⛔ the title never cuts the user\'s question inside a number', () => {
  it.each([
    ['Should we raise £1.5m? We have 18 months of runway.', 'Should we raise £1.5m?'],
    ['Churn is 3.5% a month. What should we change?', 'Churn is 3.5% a month.'],
    ['Should we hire e.g. two engineers or one? Budget is tight.', 'Should we hire e.g. two engineers or one?'],
    ['Pick a pricing plan for v2.0 launch', 'Pick a pricing plan for v2.0 launch'],
    ['Raise the Pro price to £59.', 'Raise the Pro price to £59.'],
    ['First line wins\nSecond line is context.', 'First line wins'],
    ['  Should we expand? "Yes" says sales.  ', 'Should we expand?'],
  ])('%j → %j', (brief, title) => {
    expect(oneSentence(brief)).toBe(title)
  })

  it('the MOUNTED title uses it (a decision question with a decimal)', () => {
    nodes.push(
      { id: 'd1', type: 'decision', data: { label: 'Funding', question: 'Should we raise £1.5m? We have 18 months of runway.' } },
      { id: 'g1', type: 'goal', data: { label: 'Extend runway' } },
      factor('f1', { value: 0.42, raw_value: 42, unit: '£', source: 'user_override' }),
    )
    render(<ModelStrip isPreRun={false} />)
    expect(screen.getByTestId(`${TID}-lead`)).toHaveTextContent(/^Should we raise £1\.5m\?$/)
  })
})
