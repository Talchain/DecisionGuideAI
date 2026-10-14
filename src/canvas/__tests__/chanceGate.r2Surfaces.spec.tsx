/**
 * #2747 r2 (fresh check r1, BLOCKING 5 and 7): surfaces that showed a probability no canonical cell licenses, each
 * mounted as it is deployed and bound to its own row by test id. Removal is the default for a figure nothing licenses:
 *   - the Model tab's per-limit satisfaction probability ("46%" and its bar) — the checker's reproduction;
 *   - the risk inspector's per-option "exposure", which printed each option's WIN SHARE under the wrong name.
 * Each keeps the rest of its row (the limit's words; the risk's metadata) as the control.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { useCanvasStore } from '../store'
import { GOAL_CONSTRAINT_ROW_TESTID, GoalConstraintsSection } from '../components/model-tab/GoalConstraintsSection'
import { RiskAdvancedEditor } from '../ui/inspector-v2/editors/RiskAdvancedEditor'

const initial = useCanvasStore.getState()
afterEach(() => { cleanup(); useCanvasStore.setState(initial, true) })

describe('#2747 r2 (BLOCKING 5): the Model tab says the limit, never a probability for it', () => {
  it('the checker\'s reproduction: a limit carrying probability 0.46 shows no "46%" and no bar; the limit\'s words stay', () => {
    useCanvasStore.setState({ results: { status: 'idle', progress: 0 } } as never)
    render(<GoalConstraintsSection
      constraints={[{ constraint_id: 'limit:spend', node_id: 'annual_spend', operator: '<=', value: 100000, unit: 'GBP',
        value_frame: 'level', provenance: 'explicit', probability: 0.46 }] as never}
      nodes={[{ id: 'annual_spend', data: { kind: 'factor', label: 'Annual spend' } }]} />)
    const row = screen.getByTestId(GOAL_CONSTRAINT_ROW_TESTID('limit:spend'))
    expect(row).toHaveTextContent('Annual spend ≤ £100,000')
    expect(row.textContent).not.toMatch(/46\s*%/)
    expect(row.querySelector('[role="progressbar"]')).toBeNull()
  })
})

describe('#2747 r2 (BLOCKING 7): the risk inspector shows no per-option "exposure" (a win share under the wrong name)', () => {
  it('with option win shares on the Run, no exposure row and no share figure; the metadata stays', () => {
    useCanvasStore.setState({
      nodes: [{ id: 'risk_1', type: 'risk', position: { x: 0, y: 0 }, data: { label: 'Supplier fails', kind: 'risk' } }], edges: [],
      results: { status: 'complete', progress: 100, report: { option_comparison: [
        { option_id: 'a', option_label: 'Option A', win_probability: 0.62 },
        { option_id: 'b', option_label: 'Option B', win_probability: 0.38 },
      ] } },
    } as never)
    render(<RiskAdvancedEditor nodeId="risk_1" />)
    expect(screen.getByText('Node ID')).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/exposure/i)
    expect(document.body.textContent).not.toMatch(/62\s*%|38\s*%/)
  })
})
