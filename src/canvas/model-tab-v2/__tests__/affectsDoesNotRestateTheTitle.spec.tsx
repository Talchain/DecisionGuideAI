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
import { render, screen, fireEvent } from '@testing-library/react'
import { ModelDetailRegion } from '../ModelDetailRegion'
import type { ModelRow, ModelRowDetail } from '../types'

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
