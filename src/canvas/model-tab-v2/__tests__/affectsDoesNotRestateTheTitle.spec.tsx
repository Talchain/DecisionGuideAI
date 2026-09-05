/**
 * ⭐⭐ A SECTION THAT RESTATES THE TITLE IS NOT INFORMATION.
 *
 * For a RELATIONSHIP the projection sets `affects` to exactly one entry — the
 * edge's target. When the producer did not name the edge, `relationshipLabel`
 * builds the row's own title as `${from} → ${to}` from the SAME
 * `resolveCanvasLabel` call. So the panel rendered:
 *
 *     Hit Next Launch Date → Boost Productivity     ← the row
 *     What it affects                               ← a 14px section header
 *     Boost Productivity                            ← the same string again
 *
 * Three lines and a heading to repeat the second half of the title the reader
 * is already looking at. Paul reported it from a manual test on the deployed
 * build.
 *
 * ⚠ THE PREDICATE IS "DOES THE TITLE ALREADY SAY THIS?", NOT "IS THIS AN
 * EDGE?" — and the second test here is the one that matters. A
 * producer-NAMED relationship does not mention its target in the title, so
 * this section is the only place the target is stated; suppressing it there
 * would delete real information rather than remove a repetition.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ModelDetailRegion } from '../ModelDetailRegion'
import type { ModelRow, ModelRowDetail } from '../types'
import { RELATIONSHIP_LABEL_SEPARATOR } from '../adapters'

const TARGET = { id: 'n_boost', label: 'Boost Productivity' }

const relationshipRow = (label: string): ModelRow => ({
  id: 'e1',
  kind: 'relationship',
  group: 'relationships',
  label,
  primaryValue: null,
  provenanceSource: 'cee_inference',
  attention: [],
  editable: false,
})

const detail = (over: Partial<ModelRowDetail> = {}): ModelRowDetail => ({
  rowId: 'e1',
  description: null,
  secondaryValues: [],
  basis: 'Inferred from model structure',
  adjustments: [],
  affects: [TARGET],
  interventions: [],
  advancedParameters: [],
  ...over,
})

const HEADING = 'What it affects'

describe('the derived-title case — the repetition goes, the affordance stays', () => {
  it('drops the heading when the row title already names the target', () => {
    render(
      <ModelDetailRegion
        row={relationshipRow('Hit Next Launch Date → Boost Productivity')}
        detail={detail()}
        tier="plain"
      />,
    )
    // PRECONDITION: the title really does contain the target, or "the heading
    // is absent" would be testing a case that never had a repetition in it.
    expect(screen.getByTestId('model-detail-v2-affects')).toBeTruthy()
    expect(screen.queryByText(HEADING)).toBeNull()
  })

  it('keeps the route to the target on the canvas, stated as an action', () => {
    const onFocusOnCanvas = vi.fn()
    render(
      <ModelDetailRegion
        row={relationshipRow('Hit Next Launch Date → Boost Productivity')}
        detail={detail()}
        tier="plain"
        onFocusOnCanvas={onFocusOnCanvas}
      />,
    )
    const control = screen.getByTestId(`model-detail-v2-affects-${TARGET.id}`)
    // ⚠ THE PROPERTY, NOT THE WORDING. A first draft pinned the literal
    // "on canvas" and a harmless rephrase RED-ed it — the mutant battery
    // caught that, which is what a decoy is for. What must hold is that this
    // control states an ACTION rather than repeating the bare fact the title
    // already carries; the exact phrasing is a copy decision, not a contract.
    expect(control.textContent?.trim()).not.toBe(TARGET.label)
    expect(control.textContent).toContain(TARGET.label)
    fireEvent.click(control)
    // Binds by IDENTITY — the target's id, not "a click happened".
    expect(onFocusOnCanvas).toHaveBeenCalledWith(TARGET.id)
  })
})

/**
 * ⭐⭐ AN OUTSIDE CORPUS, BOTH DIRECTIONS — because this began as a PREDICATE
 * OVER TEXT, and this estate has watched that class oscillate through four
 * rounds before anyone admitted the approach was wrong.
 *
 * The first version asked *"does the title contain the target's label?"*.
 * Measured over these cases it produced FIVE false suppressions, and a
 * word-boundary match does not rescue it — "Revenue Growth Rate" contains
 * "Revenue" as a whole word. The exit was to stop asking about the text and
 * ask about the CONSTRUCTION: the derived title ends with the shared
 * separator plus the target's label, by construction.
 *
 * ⚠ WHICH DIRECTION IS WORSE MATTERS, AND IT IS NOT SYMMETRIC. A false KEEP
 * leaves a redundant heading — the defect this fix exists to remove, and
 * visible. A false SUPPRESSION drops a heading over a genuinely different
 * detail. Both are cheap here BECAUSE the affordance survives either way: the
 * suppressed branch still renders the target's label inside a working control,
 * so no route and no content is lost — only the heading. That asymmetry is
 * what keeps this from being a four-round problem, and it is why the predicate
 * is allowed to be simple as long as it fails toward KEEPING.
 */
describe('the corpus — both directions, cases not drawn from the implementation', () => {
  /*
   * ⚠ IMPORTED, NOT SPELT. A first draft wrote the separator into this spec as
   * a literal — which is the same hand-maintained mirror the export was
   * created to remove, reintroduced one file along. Both the builder and the
   * detail region now read this constant, and so does the corpus, so the three
   * cannot drift apart.
   */
  const SEP = RELATIONSHIP_LABEL_SEPARATOR
  const cases: Array<[string, string, boolean, string]> = [
    [`Hit Next Launch Date${SEP}Boost Productivity`, 'Boost Productivity', true, 'the reported case'],
    [`Onboarding Quality${SEP}Churn`, 'Churn', true, 'short target, derived title'],
    ['Product gaps mediate churn', 'Churn Rate', false, 'producer-named edge'],
    ['Boost productivity', 'Boost Productivity', false, 'case differs'],
    [`Reduce Costs${SEP}Margin`, 'Cost', false, 'substring: Cost inside Costs'],
    ['Revenue Growth Rate', 'Revenue', false, 'substring: whole word, different node'],
    ['Sales drives Revenue Growth', 'Revenue', false, 'substring inside a longer name'],
    [`Time Pressure${SEP}Team Capacity`, 'Capacity', false, 'substring: inside Team Capacity'],
    [`Churn${SEP}Revenue`, 'Churn', false, 'target is the FROM half, not the TO half'],
  ]

  it.each(cases)('%s / %s → suppress=%s (%s)', (label, target, shouldSuppress) => {
    render(
      <ModelDetailRegion
        row={relationshipRow(label)}
        detail={detail({ affects: [{ id: 'n', label: target }] })}
        tier="plain"
      />,
    )
    const headingPresent = screen.queryByText(HEADING) !== null
    expect(headingPresent).toBe(!shouldSuppress)
    // The affordance survives in BOTH branches — this is what makes a wrong
    // answer cost a heading rather than content.
    expect(screen.getByTestId('model-detail-v2-affects-n')).toBeTruthy()
    cleanup()
  })
})

describe('⚠ the discriminating twin — a producer-named edge KEEPS the section', () => {
  it('renders the heading and the target when the title does NOT name it', () => {
    render(
      <ModelDetailRegion
        row={relationshipRow('Product gaps mediate churn')}
        detail={detail()}
        tier="plain"
      />,
    )
    // PRECONDITION: this title genuinely omits the target — otherwise the two
    // tests are the same case and neither discriminates.
    expect('Product gaps mediate churn').not.toContain(TARGET.label)

    expect(screen.getByText(HEADING)).toBeTruthy()
    expect(screen.getByTestId(`model-detail-v2-affects-${TARGET.id}`).textContent).toBe(
      TARGET.label,
    )
  })

  it('a node with several downstream targets keeps the section', () => {
    const row: ModelRow = { ...relationshipRow('Sales cycle length'), id: 'f1', kind: 'factor', group: 'factors' }
    render(
      <ModelDetailRegion
        row={row}
        detail={detail({
          rowId: 'f1',
          affects: [TARGET, { id: 'n_rev', label: 'Revenue' }],
        })}
        tier="plain"
      />,
    )
    expect(screen.getByText(HEADING)).toBeTruthy()
  })
})
