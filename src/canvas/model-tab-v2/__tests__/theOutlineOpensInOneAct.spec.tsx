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

const outline = (filter: string, initiallyClosedGroups?: ModelGroupId[]) => (
  <ModelOutline
    rows={ROWS}
    tier="plain"
    filter={filter}
    onGroupAction={vi.fn()}
    initiallyClosedGroups={initiallyClosedGroups}
  />
)

const renderOutline = (initiallyClosedGroups?: ModelGroupId[]) =>
  render(outline('', initiallyClosedGroups))

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


/**
 * ⛔⛔ THE CASE THE ASSERTIONS ABOVE CANNOT REACH — AND THIS FILE'S OWN NEIGHBOUR
 * RECORDS BEING CAUGHT BY EXACTLY THIS BLINDNESS ONE CHANGE EARLIER.
 * `outlineLayout`'s docblock: *"it renders `ModelOutline` with no
 * `initiallyClosedGroups`, so every group is open by default — while production
 * passes them all as closed. It never exercised the closed-and-searching case at
 * all."* Every assertion above runs with `filter=""`, so every one of them is
 * blind in the same direction.
 *
 * `ModelOutline` keeps TWO closed-sets deliberately — `closed` is the reader's
 * RESTING outline, `searchClosed` the one they are acting on while a needle is
 * live — and `toggle` was repaired specifically so that *"a click must not
 * silently rewrite the state they return to when the needle clears."*
 *
 * A whole-outline control has to obey the same rule, and for a second reason the
 * per-group chevron does not have: it carries a LABEL naming the act. If the
 * label reads one set and the click writes another, the button can announce
 * "Expand all" and collapse the model.
 */
describe('the one act governs the outline the reader is looking at', () => {
  // Matches exactly one group's row, so the other four are open only because the
  // reader has them open at rest — which is the distinction under test.
  const ONE_MATCH = 'Label r0'
  const MATCHED_GROUP = MODEL_GROUP_IDS[0]
  const OTHER_GROUP = MODEL_GROUP_IDS[1]

  const openMidSearch = () => {
    const view = render(outline('', []))
    expect(openCount(), 'precondition: mounted fully open').toBe(MODEL_GROUP_IDS.length)
    view.rerender(outline(ONE_MATCH, []))
    return view
  }

  it('⛔ THE DEFECT: a group hand-closed mid-search makes the label and the act disagree', () => {
    const view = openMidSearch()
    fireEvent.click(screen.getByTestId(`model-group-v2-${OTHER_GROUP}-toggle`))
    expect(openCount(), 'precondition: the hand-close landed').toBe(
      MODEL_GROUP_IDS.length - 1,
    )

    const btn = screen.getByTestId('model-outline-v2-toggle-all')
    expect(btn, 'precondition: the label offers to open them').toHaveTextContent('Expand all')
    fireEvent.click(btn)

    // The act the label named: every group open again.
    expect(openCount()).toBe(MODEL_GROUP_IDS.length)
    view.unmount()
  })

  it('⛔ AND IT MUST NOT REWRITE THE RESTING OUTLINE — the needle clears to what the reader left', () => {
    const view = openMidSearch()
    fireEvent.click(screen.getByTestId(`model-group-v2-${OTHER_GROUP}-toggle`))
    fireEvent.click(screen.getByTestId('model-outline-v2-toggle-all'))

    view.rerender(outline('', []))
    expect(openCount(), 'the search-time act wrote only the search outline').toBe(
      MODEL_GROUP_IDS.length,
    )
    view.unmount()
  })

  it('collapse-all mid-search is likewise scoped to the search', () => {
    const view = openMidSearch()
    const btn = screen.getByTestId('model-outline-v2-toggle-all')
    expect(btn, 'precondition: everything the search governs is open').toHaveTextContent(
      'Collapse all',
    )
    fireEvent.click(btn)
    expect(openCount(), 'the search outline collapsed').toBe(0)

    view.rerender(outline('', []))
    expect(openCount(), 'the RESTING outline is untouched').toBe(MODEL_GROUP_IDS.length)
    view.unmount()
  })

  it('CONTRAST CONTROL: at rest the same control still writes the resting outline', () => {
    // Proves the search branch above is a branch, not a control that stopped
    // writing anything. Without this, a `toggleAll` that did nothing at all
    // would pass the two "resting outline untouched" assertions.
    const view = render(outline('', [...MODEL_GROUP_IDS]))
    fireEvent.click(screen.getByTestId('model-outline-v2-toggle-all'))
    expect(openCount()).toBe(MODEL_GROUP_IDS.length)
    view.unmount()
  })

  it('the group the search cannot open is not counted against the label', () => {
    // Mounted CLOSED, then searched: only the matching group can open, so
    // "Expand all" that opened it has performed the whole of the act available.
    // A label still reading "Expand all" over four groups it is powerless to
    // open is the inert-control defect `outlineLayout` already records.
    const view = render(outline('', [...MODEL_GROUP_IDS]))
    view.rerender(outline(ONE_MATCH, [...MODEL_GROUP_IDS]))
    expect(
      screen.getByTestId(`model-group-v2-${MATCHED_GROUP}`).getAttribute('data-open'),
      'precondition: the match is showing',
    ).toBe('true')
    expect(screen.getByTestId('model-outline-v2-toggle-all')).toHaveTextContent('Collapse all')
    view.unmount()
  })
})
