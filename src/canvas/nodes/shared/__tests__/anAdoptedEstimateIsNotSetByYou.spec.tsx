/**
 * An adopted Olumi estimate is never labelled "Set by you".
 *
 * RC's question on #63 (5826320171): on served CEE `92b1bf8`, approving the
 * pricing starting assumptions (a typed chip) stamps the factor
 * `observed_state.source: 'user_assumption'` together with node-level
 * `provenance: 'user_set'`. The user adopted Olumi's estimate; they did not
 * set the number. So no authorship surface may say "Set by you".
 *
 * The value's own source must win over the node-level stamp, on the canvas
 * card and on the Model tab row. The control shows the node-level stamp alone
 * does read "Set by you", so the probe can see that label.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { Node } from '@xyflow/react'

import { NodeProvenanceMark, resolveProvenanceMarks } from '../NodeProvenanceMark'
import { factorValueSourceMark } from '../valueSourceMark'
import { toModelRows } from '../../../model-tab-v2/adapters'
import { ValueProvenanceMark } from '../../../model-tab-v2/ValueProvenanceMark'

afterEach(cleanup)

const SET_BY_YOU = 'Set by you'

/** The shape RC describes on the served tuple: an adopted estimate. */
const adopted = () => ({
  label: 'Monthly churn rate',
  provenance: 'user_set',
  observedState: { value: 0.03, raw_value: 3, unit: '%', source: 'user_assumption' },
})

/** CONTROL: the same node-level stamp with no value source to outrank it. */
const stampOnly = () => ({
  label: 'Monthly churn rate',
  provenance: 'user_set',
  observedState: { value: 0.03, raw_value: 3, unit: '%' },
})

describe('an adopted Olumi estimate is not "Set by you"', () => {
  it('CONTROL: the node-level stamp alone does read "Set by you" (the probe can see the label)', () => {
    render(<NodeProvenanceMark nodeType="factor" data={stampOnly()} />)
    const marks = screen.getAllByTestId('node-provenance-mark')
    expect(marks.map((m) => m.getAttribute('aria-label'))).toContain(SET_BY_YOU)
  })

  it('⭐ canvas card: one mark, "Your assumption", and no "Set by you"', () => {
    expect(resolveProvenanceMarks('factor', adopted())).toEqual([{ claim: 'value', kind: 'assumption' }])
    render(<NodeProvenanceMark nodeType="factor" data={adopted()} />)
    const marks = screen.getAllByTestId('node-provenance-mark')
    expect(marks).toHaveLength(1)
    expect(marks[0]).toHaveAttribute('aria-label', 'Your assumption')
    expect(screen.queryByLabelText(SET_BY_YOU)).toBeNull()
  })

  it('canvas value word: its accessible label is "Your assumption"', () => {
    expect(factorValueSourceMark(adopted())?.label).toBe('Your assumption')
  })

  it('⭐ Model tab row: the provenance mark is "Your assumption", and no "Set by you"', () => {
    const node = { id: 'f1', type: 'factor', position: { x: 0, y: 0 }, data: adopted() } as unknown as Node
    const [row] = toModelRows({ nodes: [node], edges: [], goalThreshold: null })
    expect(row.id).toBe('f1')
    const source = (row as { provenanceSource?: string }).provenanceSource
    expect(source).toBe('user_assumption')
    render(<ValueProvenanceMark source={source} rowId="f1" />)
    const mark = screen.getByTestId('model-row-v2-f1-provenance-mark')
    expect(mark).toHaveAttribute('aria-label', 'Your assumption')
    expect(mark).toHaveAttribute('data-provenance-kind', 'assumption')
    expect(screen.queryByLabelText(SET_BY_YOU)).toBeNull()
  })
})
