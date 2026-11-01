/**
 * A measured limit shows its FIGURE in the Model tab's "Limits" list, as the person's own words say it ("at most 120"), not "limit not
 * captured". The rows are built the way ModelTabBody builds them (the limits the graph lists as `goal_constraints`, then any limit
 * with no single figure), and drawn by the real GoalConstraintsSection.
 */
import '@testing-library/jest-dom/vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { modelOf } from '../../../scripts/olumi-core/lib/model.mjs'
import { GoalConstraintsSection, GOAL_CONSTRAINT_ROW_TESTID } from '../../canvas/components/model-tab/GoalConstraintsSection'
import { programLimitsWithoutFigure } from '../../canvas/nodes/shared/savedModelProgram'

const here = path.dirname(fileURLToPath(import.meta.url))
const rich = JSON.parse(fs.readFileSync(path.join(here, 'fixtures', 'view-rich-approved.json'), 'utf8'))

/** The turn's graph through ModelTabBody's own row rule: the listed limits, then the limits with no single figure. */
function rowsOf(form: unknown) {
  const { graph } = modelOf({ version: { ...rich.version, form }, pending: null, id: rich.id, chat: [] })!
  const listed = graph.goal_constraints ?? null
  const without = programLimitsWithoutFigure(graph, listed)
  return { graph, rows: without.length === 0 ? listed : [...(listed ?? []), ...without] }
}
afterEach(cleanup)

describe('the Model list states a measured limit with its figure', () => {
  it('the ceiling of 120 reads "at most 120" in its row, and never "limit not captured"', () => {
    const { graph, rows } = rowsOf(rich.version.form)
    render(<GoalConstraintsSection constraints={rows} nodes={graph.nodes.map((n) => ({ id: n.id, data: n }))} />)
    const row = screen.getByTestId(GOAL_CONSTRAINT_ROW_TESTID('ceiling'))
    expect(row).toHaveTextContent(/Capacity ceiling/)
    expect(row).toHaveTextContent(/≤\s*120/)
    expect(row).not.toHaveTextContent(/not captured/)
    expect(screen.getAllByTestId(/^model-goal-constraint-ceiling$/)).toHaveLength(1)
  })
  it('a limit that states no single figure is still listed, honestly without one', () => {
    const form = JSON.parse(JSON.stringify(rich.version.form))
    form.records.find((r: { id: string }) => r.id === 'cap').assertion = { kind: 'interval', low: 100, high: 130, range_kind: 'plausible', likely: null }
    const { graph, rows } = rowsOf(form)
    render(<GoalConstraintsSection constraints={rows} nodes={graph.nodes.map((n) => ({ id: n.id, data: n }))} />)
    const row = screen.getByTestId(GOAL_CONSTRAINT_ROW_TESTID('ceiling'))
    expect(row).toHaveTextContent(/limit not captured/)
    expect(row).not.toHaveTextContent(/NaN|≤/)
  })
})
