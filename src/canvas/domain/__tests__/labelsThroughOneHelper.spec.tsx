/**
 * Canvas audit item 3, "labels through one helper": no producer prefix or developer wording reaches the user.
 * Every expectation is spelt inline (never computed by the production helper), and each row reads a real display
 * path: the link inspector, the Model outline's projection, the card title, the factor value and goal target
 * formatters, and the option inspector's route note. The strip is for the QUESTION node only, and display only.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import type { Edge, Node } from '@xyflow/react'
import { resolveElementLabel } from '../elementLabel'
import type { EdgeData } from '../edges'
import { toModelRows } from '../../model-tab-v2/adapters'
import { nodeCardTitle } from '../../nodes/shared/nodeCardTitle'
import { InspectorRouter } from '../../ui/inspector-v2/InspectorRouter'
import { useCanvasStore } from '../../store'
import { formatFactorDisplayValue } from '../../../utils/formatFactorDisplayValue'
import { formatGoalTarget } from '../../../components/results/utils/formatGoalTarget'
import { OPTION_TARGET_EDIT_ROUTE_NOTE } from '../../ui/inspector-v2/panels/OptionPanel'

const QUESTION: Node = { id: 'dec_1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'Decision: Weekly customers' } }
const OPTION: Node = { id: 'opt_1', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Start a loyalty card' } }
const NAMED_FACTOR: Node = { id: 'fac_1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Decision: retain the platform' } }

vi.mock('@xyflow/react', () => ({ useViewport: () => ({ x: 0, y: 0, zoom: 1 }) }))

beforeEach(() => { vi.clearAllMocks() })

describe('"Decision:" never reaches a display surface for the question node', () => {
  it('the link inspector (the relationship panel and its title) names a link from the question without the prefix', () => {
    useCanvasStore.setState({
      nodes: [QUESTION, OPTION] as never[],
      edges: [{ id: 'e1', source: 'dec_1', target: 'opt_1', data: { weight: 1, beliefExists: 1, beliefExistsSource: 'cee' } }] as never[],
      results: { status: 'idle' },
      selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
      goalThreshold: null,
      confirmedNodeIds: new Set(),
      _internal: {},
    } as never)
    const { container } = render(<InspectorRouter nodeId={null} edgeId="e1" onClose={vi.fn()} />)
    expect(container.textContent).toContain('Weekly customers \u2192 Start a loyalty card')
    expect(container.textContent).not.toContain('Decision:')
  })

  it('the Model outline names the question row and the link from it without the prefix', () => {
    const edge = { id: 'e1', source: 'dec_1', target: 'opt_1', data: {} } as unknown as Edge<EdgeData>
    const rows = toModelRows({ nodes: [QUESTION, OPTION], edges: [edge], goalThreshold: null })
    expect(rows.find(r => r.id === 'dec_1')?.label).toBe('Weekly customers')
    expect(rows.some(r => r.label.includes('Decision:'))).toBe(false)
  })

  it('the card title (and accessible name) shows the question alone', () => {
    expect(nodeCardTitle('Decision: weekly customers', undefined, 'decision')).toBe('Weekly customers')
  })
})

describe('NEGATIVES: only the question node, only for display', () => {
  it('a factor the person named "Decision: …" keeps its words in the outline and on its card', () => {
    const rows = toModelRows({ nodes: [NAMED_FACTOR], edges: [], goalThreshold: null })
    expect(rows.find(r => r.id === 'fac_1')?.label).toBe('Decision: retain the platform')
    expect(nodeCardTitle('Decision: retain the platform', undefined, 'factor')).toBe('Decision: retain the platform')
  })

  it('the raw resolver (exports, saves, comparisons) keeps the stored label, even for the question', () => {
    expect(resolveElementLabel(QUESTION.data)).toBe('Decision: Weekly customers')
  })

  it('"Olumi suggestion:" is never stripped: at far zoom the words are the only sign the option is Olumi\'s', () => {
    expect(nodeCardTitle('Olumi suggestion: local workplace partnerships', undefined, 'option'))
      .toBe('Olumi suggestion: local workplace partnerships')
  })

  it('a question label that is only the prefix is shown as written, never emptied', () => {
    expect(nodeCardTitle('Decision:', undefined, 'decision')).toBe('Decision:')
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
