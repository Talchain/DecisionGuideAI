/**
 * The model outline can be opened in one act.
 *
 * Paul, 21 Sep, from a manual test: *"we definitely need on the model tab an
 * 'Expand All', as having to do it individually is a pain, and sometimes users
 * just want to see all of the model expanded."*
 *
 * Five groups — goal, options, factors, outcomes-risks, relationships — meant
 * five clicks to read the model, every time the panel remounted closed.
 *
 * ⭐ THE CONTROL IS NOT INVENTED HERE. `YourDecisionSection` has carried exactly
 * this affordance since pre-analysis-v3: ONE button that flips its own label
 * between `PANEL_COPY.expandAll` and `PANEL_COPY.collapseAll`, styled as a link
 * rather than a box. The same two strings already exist a second time in
 * `strengthen/strengthenCopy.ts`. This surface was the one that lacked it, so
 * the pattern is reused rather than re-designed — which is the whole of "a
 * consistent design" at this scale.
 *
 * ⚠ IT REPORTS STATE, IT DOES NOT JUST ISSUE A COMMAND. A button that always
 * said "Expand all" would lie the moment everything was open. The label is
 * derived from the outline's own state, so it is always the act it will perform.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ModelOutline } from '../ModelOutline'
import { MODEL_GROUP_IDS, type ModelGroupId, type ModelRow } from '../types'

const row = (id: string, group: ModelGroupId): ModelRow => ({
  id,
  kind: 'factor',
  group,
  label: `Label ${id}`,
  primaryValue: '1',
  attention: [],
  editable: true,
})

const ROWS = MODEL_GROUP_IDS.map((g, i) => row(`r${i}`, g))

const renderOutline = (initiallyClosedGroups?: ModelGroupId[]) =>
  render(
    <ModelOutline
      rows={ROWS}
      tier="plain"
      filter=""
      onGroupAction={vi.fn()}
      initiallyClosedGroups={initiallyClosedGroups}
    />,
  )

const openCount = () =>
  MODEL_GROUP_IDS.filter(
    g => screen.getByTestId(`model-group-v2-${g}`).getAttribute('data-open') === 'true',
  ).length

describe('the model outline opens in one act', () => {
  it('⛔ THE ASK: one control opens every group', () => {
    renderOutline([...MODEL_GROUP_IDS])
    expect(openCount(), 'precondition: everything starts closed').toBe(0)

    fireEvent.click(screen.getByTestId('model-outline-v2-toggle-all'))

    expect(openCount()).toBe(MODEL_GROUP_IDS.length)
  })

  it('the label is the ACT IT WILL PERFORM, not a fixed word', () => {
    renderOutline([...MODEL_GROUP_IDS])
    const btn = screen.getByTestId('model-outline-v2-toggle-all')
    expect(btn).toHaveTextContent('Expand all')

    fireEvent.click(btn)
    // Now everything is open, so the only remaining act is the opposite one.
    expect(btn).toHaveTextContent('Collapse all')
  })

  it('and it closes them again — the act is reversible from the same control', () => {
    renderOutline([...MODEL_GROUP_IDS])
    const btn = screen.getByTestId('model-outline-v2-toggle-all')
    fireEvent.click(btn)
    expect(openCount()).toBe(MODEL_GROUP_IDS.length)
    fireEvent.click(btn)
    expect(openCount()).toBe(0)
  })

  it('CONTRAST CONTROL: opening all does not disturb which rows exist', () => {
    renderOutline([...MODEL_GROUP_IDS])
    fireEvent.click(screen.getByTestId('model-outline-v2-toggle-all'))
    // A control that "opened" by dropping the filter or re-deriving rows would
    // pass the count assertions above and still be wrong.
    for (const r of ROWS) expect(screen.getByText(r.label)).toBeInTheDocument()
  })

  it('reads as COLLAPSE ALL when the outline mounts fully open', () => {
    renderOutline([])
    expect(screen.getByTestId('model-outline-v2-toggle-all')).toHaveTextContent('Collapse all')
  })
})
