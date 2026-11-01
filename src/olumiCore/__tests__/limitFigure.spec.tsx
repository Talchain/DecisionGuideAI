/**
 * A measured limit shows its FIGURE in the Model tab's "Limits" list, as the person's own words say it ("at most 120"), not "limit not
 * captured". The rows are built the way ModelTabBody builds them (the limits the graph lists as `goal_constraints`, then any limit
 * with no single figure), and drawn by the real GoalConstraintsSection.
 */
import '@testing-library/jest-dom/vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { modelOf } from '../../../scripts/olumi-core/lib/model.mjs'
import { makeShim } from '../../../scripts/olumi-core/lib/turn.mjs'
import { makeCore } from '../../../scripts/olumi-core/lib/core.mjs'
import { derivedUuidOfSid } from '../../../scripts/olumi-core/lib/ids.mjs'
import { startFakeCore } from './fakeCore.mjs'
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

describe('a limit the person edited shows the figure now saved, never the quote of the old one (review: "at most 4%" beside a saved 5%)', () => {
  let fake: Awaited<ReturnType<typeof startFakeCore>>
  beforeAll(async () => { fake = await startFakeCore(); fake.addPerson('tok-ada', '1', 'Ada') })
  afterAll(async () => { await fake.close() })

  /** The churn ceiling as the person stated it ("keep churn under 4%"), and as core saves it after an edit to 5: only the bound moves. */
  const churn = (value: number, edited: boolean) => {
    const v = JSON.parse(JSON.stringify(rich))
    const cap = v.version.form.records.find((r: { id: string }) => r.id === 'cap')
    const ceiling = v.version.form.records.find((r: { id: string }) => r.id === 'ceiling')
    cap.unit = '%'; cap.assertion = { kind: 'point', value, approximate: false }
    cap.origin = edited ? { by: 'person', quote: `Set "${cap.label}" to ${value} %.`, party: null } : { by: 'person', quote: 'keep churn under 4%', party: null }
    ceiling.origin = { by: 'person', quote: 'keep churn under 4%', party: null }
    return v
  }

  it('the edit/readback journey from 4% to 5%: the Model list states the limit as "at most 5%" (≤ 5%)', async () => {
    const sid = fake.seed('tok-ada', churn(4, false), { edit: { ...churn(5, true), version: { ...churn(5, true).version, id: rich.version.id + 100, n: rich.version.n + 1 } } })
    const uuid = derivedUuidOfSid(sid)!
    const shim = makeShim({ core: makeCore({ base: fake.url }) })
    // before the edit: the person's own words state 4%
    const before = (await shim.graphRead({ token: 'tok-ada', aliases: [] }, uuid)).body as { graph: { goal_constraints: { value: number; source_quote?: string }[]; nodes: { id: string }[] } }
    expect(before.graph.goal_constraints[0]).toMatchObject({ value: 4, source_quote: 'keep churn under 4%' })
    // the edit, as DGAI sends it from the limit card
    const { out } = await shim.turn({ token: 'tok-ada', aliases: [] }, { kind: 'system_event', turn_id: crypto.randomUUID(), scenario_id: uuid, stage: 'frame', event: { kind: 'factor_value_edit', target_id: 'ceiling', value: 5, raw_value: 5 } })
    expect(out.error).toBeNull()
    for (const graph of [out.model!.graph, (await shim.graphRead({ token: 'tok-ada', aliases: [] }, uuid)).body.graph as NonNullable<typeof out.model>['graph']]) {
      expect(graph.goal_constraints![0]).toMatchObject({ constraint_id: 'ceiling', value: 5, operator: '<=' })
      expect(graph.goal_constraints![0]).not.toHaveProperty('source_quote')
      render(<GoalConstraintsSection constraints={graph.goal_constraints as never} nodes={graph.nodes.map((n: { id: string }) => ({ id: n.id, data: n }))} />)
      const text = screen.getByTestId(GOAL_CONSTRAINT_ROW_TESTID('ceiling')).textContent ?? ''
      expect(text).toBe('Capacity ceiling ≤ 5%')   // DGAI's "at most" operator: the saved figure, as the formatter prints it
      expect(text).not.toMatch(/4\s*%/)
      cleanup()
    }
  })
})
