/**
 * Canvas audit item 3, "labels through one helper": no producer prefix or developer wording reaches the user.
 * Every expectation is spelt inline (never computed by the production helper), and each row reads a real display
 * path: the inspector's element resolver, the Model outline's projection, the card title, the factor value and goal
 * target formatters, and the option inspector's route note.
 */
import { describe, expect, it } from 'vitest'
import type { Edge, Node } from '@xyflow/react'
import { resolveElementLabel } from '../elementLabel'
import type { EdgeData } from '../edges'
import { toModelRows } from '../../model-tab-v2/adapters'
import { nodeCardTitle } from '../../nodes/shared/nodeCardTitle'
import { formatFactorDisplayValue } from '../../../utils/formatFactorDisplayValue'
import { formatGoalTarget } from '../../../components/results/utils/formatGoalTarget'
import { OPTION_TARGET_EDIT_ROUTE_NOTE } from '../../ui/inspector-v2/panels/OptionPanel'

const QUESTION: Node = { id: 'dec_1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'Decision: Weekly customers' } }
const OPTION: Node = { id: 'opt_1', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Start a loyalty card' } }

describe('"Decision:" never reaches a display surface; the stored label is unchanged', () => {
  it('the inspector resolver (link endpoints, connection rows) names the question without the prefix', () => {
    expect(resolveElementLabel(QUESTION.data)).toBe('Weekly customers')
    expect(QUESTION.data.label).toBe('Decision: Weekly customers')
  })

  it('a label that is only the prefix is shown as written, never emptied', () => {
    expect(resolveElementLabel({ label: 'Decision:' })).toBe('Decision:')
  })

  it('the Model outline names the question row and the link from it without the prefix', () => {
    const edge = { id: 'e1', source: 'dec_1', target: 'opt_1', data: {} } as unknown as Edge<EdgeData>
    const rows = toModelRows({ nodes: [QUESTION, OPTION], edges: [edge], goalThreshold: null })
    const question = rows.find(r => r.id === 'dec_1')
    expect(question?.label).toBe('Weekly customers')
    expect(rows.some(r => r.label.includes('Decision:'))).toBe(false)
  })

  it('the card title shows the question alone', () => {
    expect(nodeCardTitle('Decision: weekly customers', undefined)).toBe('Weekly customers')
  })
})

describe('"Olumi suggestion:" comes off the card title only (the card carries its own authorship mark)', () => {
  it('the card title reads the option alone', () => {
    expect(nodeCardTitle('Olumi suggestion: local workplace partnerships', undefined)).toBe('Local workplace partnerships')
  })

  it('other surfaces keep the words, the only sign there that the option is Olumi\'s', () => {
    expect(resolveElementLabel({ label: 'Olumi suggestion: local workplace partnerships' }))
      .toBe('Olumi suggestion: local workplace partnerships')
  })
})

describe('a figure of exactly 1 reads with a singular time unit', () => {
  it('factor value: "1 week", and "2 weeks" stays plural', () => {
    expect(formatFactorDisplayValue({ label: 'Hiring delay', raw_value: 1, unit: 'weeks' })).toBe('1 week')
    expect(formatFactorDisplayValue({ label: 'Hiring delay', raw_value: 2, unit: 'weeks' })).toBe('2 weeks')
  })

  it('goal target: "1 month"', () => {
    expect(formatGoalTarget(1, 'months')).toBe('1 month')
  })
})

describe('the option inspector says how a target is entered in plain words', () => {
  it('no "internal 0–1 scale"', () => {
    expect(OPTION_TARGET_EDIT_ROUTE_NOTE).toBe(
      'Targets shown without a box are changed under Show technical detail (</>), where they are entered as a share, from 0 to 1.',
    )
  })
})
