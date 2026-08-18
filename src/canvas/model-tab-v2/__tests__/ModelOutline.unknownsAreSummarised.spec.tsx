/**
 * B4 — THE "NOT SET" WALL.
 *
 * The defect: `ModelRowView` rendered `primaryValue ?? 'Not set'` in EVERY row,
 * so a model with nine factors and a dozen relationships showed twenty-odd
 * identical inert "Not set" strings stacked down the outline. Each one is
 * individually honest and collectively meaningless — they carry no information
 * that distinguishes one row from another, and they drown the rows that DO have
 * something to say.
 *
 * ⚠ THE FIX IS NOT TO HIDE UNKNOWNS, AND THIS SPEC PINS THAT IN BOTH
 * DIRECTIONS. Never inventing a value is this product's whole differentiator;
 * suppressing the fact that a value is missing would be the same lie told by
 * omission. So the information is MOVED, not removed, and three assertions hold
 * it in place:
 *
 *   1. Where the unknown is ACTIONABLE — the row has a live editor — "Not set"
 *      stays, because there it is not inert text, it is the control you press
 *      to fix it.
 *   2. Where it is NOT actionable, the cell is silent and the GROUP HEADING
 *      states the count. One sentence replaces N identical strings, and the
 *      count is DERIVED from the same `primaryValue === null` the cell reads,
 *      so the two cannot disagree (trap 12).
 *   3. The per-row detail is still available on demand — asserted in
 *      `ModelDetailRegion`, which continues to render "Not set" for the
 *      selected row.
 *
 * This follows a precedent already in `ModelRowView`: the provenance pill is
 * rendered with `showWhenAbsent={false}` because "absence is rendered as
 * absence". The value cell simply did not follow the rule its own neighbour
 * already followed.
 */

import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'

import { ModelOutline } from '../ModelOutline'
import type { ModelRow } from '../types'

function row(over: Partial<ModelRow> & Pick<ModelRow, 'id'>): ModelRow {
  return {
    kind: 'factor',
    group: 'factors',
    label: `Label ${over.id}`,
    primaryValue: null,
    attention: [],
    editable: true,
    ...over,
  } as ModelRow
}

/**
 * Three unknown factors, one known — a group that is 3-of-4 unstated.
 *
 * ⚠ `fac_c` IS NOT EDITABLE, AND THAT IS LOAD-BEARING. The first version of
 * this fixture made every row `editable: true`, so the value cell's
 * `!row.editable` arm was never rendered and a mutant restoring the wall on
 * that arm SURVIVED the whole suite. A fixture that omits a branch certifies
 * nothing about it (trap 22: check what your corpus EXCLUDES).
 */
const FACTORS: readonly ModelRow[] = [
  row({ id: 'fac_a' }),
  row({ id: 'fac_b' }),
  row({ id: 'fac_c', editable: false }),
  row({ id: 'fac_known', primaryValue: '45 days' }),
]

function renderOutline(rows: readonly ModelRow[], editConnectedIds?: ReadonlySet<string>) {
  return render(
    <ModelOutline
      rows={rows}
      tier="plain"
      editConnectedIds={editConnectedIds}
      onBeginEdit={() => {}}
    />,
  )
}

describe('B4 · unknown values are summarised at the group, not repeated down the list', () => {
  it('the group heading states how many rows have no value yet', () => {
    renderOutline(FACTORS, new Set<string>())
    // Bound by identity to the FACTORS group's own summary node, not by
    // searching the document for a number another group could also render.
    const summary = screen.getByTestId('model-group-v2-factors-unknown-summary')
    expect(summary).toHaveTextContent('3 of 4 have no value yet')
  })

  it('a row that is NOT EDITABLE AT ALL prints nothing either', () => {
    // The second silent arm. `fac_c` is `editable: false`, which is a different
    // branch of the value cell from "editable but no live authority" above —
    // and it was the branch a restore-the-wall mutant slipped through.
    renderOutline(FACTORS, new Set(['fac_a', 'fac_b', 'fac_c']))
    const cell = screen.getByTestId('model-row-v2-fac_c-value')
    expect(cell.textContent).toBe('')
  })

  it('ACTIONABLE unknowns keep saying "Not set" — there it is the control, not a label', () => {
    // The opposite-direction twin of the assertion above. Without it, a change
    // that silenced EVERY unknown would pass the previous test while removing
    // the only way to give a factor its first value (design §2 F9).
    renderOutline(FACTORS, new Set(['fac_a']))
    const cell = screen.getByTestId('model-row-v2-fac_a-value')
    expect(cell).toHaveTextContent('Not set')
    expect(cell).toBeEnabled()
  })

  it('a row that HAS a value still shows it, editor or no editor', () => {
    renderOutline(FACTORS, new Set<string>())
    expect(screen.getByTestId('model-row-v2-fac_known-value')).toHaveTextContent('45 days')
  })

  it('no summary is shown when every row in the group has a value', () => {
    // Discriminating: the summary must be a fact about the data, not chrome
    // that always renders. A summary reading "0 of 4" would be its own wall.
    renderOutline([row({ id: 'fac_known', primaryValue: '45 days' })], new Set<string>())
    expect(screen.queryByTestId('model-group-v2-factors-unknown-summary')).toBeNull()
  })

  it('the non-editable row contributes NOTHING to the "Not set" count', () => {
    /*
     * The scope of this change, stated exactly. Four rows, three of them with no
     * value: `fac_a` and `fac_b` are editable (so they keep "Not set" — live for
     * `fac_a`, honestly disabled for `fac_b`, both of which are affordances or
     * explanations), and `fac_c` is not editable at all, so it is silent.
     * => exactly two "Not set", not three.
     */
    renderOutline(FACTORS, new Set(['fac_a']))
    const outline = screen.getByTestId('model-outline-v2')
    const occurrences = (outline.textContent ?? '').split('Not set').length - 1
    expect(occurrences).toBe(2)
  })

  it('the group summary carries the FULL unknown count, including the silent row', () => {
    // The information the silent cell no longer prints is still on screen — and
    // the summary counts `fac_c` even though its cell says nothing, which is the
    // whole point of moving it there.
    renderOutline(FACTORS, new Set(['fac_a']))
    const outline = screen.getByTestId('model-outline-v2')
    expect(
      within(outline).getByTestId('model-group-v2-factors-unknown-summary'),
    ).toHaveTextContent('3 of 4 have no value yet')
  })
})
