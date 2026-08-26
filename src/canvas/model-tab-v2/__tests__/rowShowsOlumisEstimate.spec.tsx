/**
 * THE PRODUCT COMPUTED A RANGE AND SHOWED THE USER NOTHING.
 *
 * Measured on a live signed-in journey `20260826T082826Z-fresh-extended-17c4a0`
 * (UI `d0e24ccc` / CEE `c24bfe3`). The persisted graph, at the cold re-read:
 *
 *   Sales Rep Adoption Rate   value 0.6  raw_value —  display_value "High (0.6)"
 *   CRM Feature Fit for B2B   value —    raw_value —  display_value "0.25 to 0.75"
 *
 * `getPrimaryValue` returns null when `raw_value` is undefined, so BOTH rows
 * rendered blank. The second is a BAND OF UNCERTAINTY the product computed,
 * holds, and discarded at the last inch.
 *
 * ⚠ AND IT WAS NEVER A MISSING CAPABILITY. `readFactorDisplayValue` already
 * exists and is already shared by `FactorNode`, the inspector-v2 panels and the
 * debug bundle, "so every consumer shares one priority rule instead of
 * re-implementing it". The Model tab was the one surface not on it — and the
 * option-intervention path IN THE SAME FILE already honoured the field
 * (`adapters.ts`: "a CEE-authored display_value wins the DISPLAY").
 *
 * ── THE CONSTRAINT THIS SPEC EXISTS TO HOLD ───────────────────────────────
 * DISPLAY reads `display_value`. AFFORDANCE keeps reading `raw_value`.
 * Two questions, not one (trap 21, third time on this seam).
 *
 * The inverse harm is the reason: an estimate rendered ALONE reads as a value
 * that IS set, while the affordance correctly still asks the user to set one —
 * the row would contradict its own button. So the cases below pin BOTH axes on
 * the same row, and a mutant that lets the estimate stand in for the value
 * must RED.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { toModelRows } from '../adapters'
import { ModelOutline } from '../ModelOutline'

/** The live shapes, reproduced exactly — including TOP-LEVEL `display_value`. */
const node = (id: string, label: string, obs: unknown, displayValue?: string) => ({
  id,
  type: 'factor',
  data: {
    label,
    kind: 'factor',
    ...(obs === undefined ? {} : { observedState: obs }),
    ...(displayValue === undefined ? {} : { display_value: displayValue }),
  },
})

const RANGE = '0.25 to 0.75'
const ESTIMATE = 'High (0.6)'

function rowsFor(nodes: unknown[]) {
  return toModelRows({ nodes, edges: [] } as never)
}

describe('the row shows what Olumi computed for a value nobody has set', () => {
  it('PRECONDITION — the fixture reproduces the live shape (top-level display_value, no raw_value)', () => {
    // Pin the precondition in-test: measured on the wire, `display_value` was
    // TOP-LEVEL in 11 of 11 occurrences and nested in ZERO. A fixture that
    // nested it would pass against a reader this one does not exercise.
    const n = node('f1', 'CRM Feature Fit', undefined, RANGE)
    expect((n.data as Record<string, unknown>).display_value).toBe(RANGE)
    expect((n.data as Record<string, unknown>).observedState).toBeUndefined()
  })

  it('⭐ ROW 4 — a computed RANGE reaches the user instead of a blank cell', () => {
    const rows = rowsFor([node('f1', 'CRM Feature Fit', undefined, RANGE)])
    expect(rows[0].primaryValue).toBeNull()
    expect(rows[0].estimateText).toBe(RANGE)
  })

  it('an estimated point value reaches the user too', () => {
    const rows = rowsFor([node('f2', 'Sales Rep Adoption', { value: 0.6 }, ESTIMATE)])
    expect(rows[0].estimateText).toBe(ESTIMATE)
  })

  it('⛔ A SUPPLIED VALUE IS NEVER MASKED — estimateText is absent when the user set one', () => {
    // Structural, not incidental: a CEE string must never stand where a person's
    // own number belongs. Same direction as the canonical priority chain.
    const rows = rowsFor([
      node('f3', 'One-Off Migration', { raw_value: 65000, unit: '£' }, '£65k'),
    ])
    expect(rows[0].primaryValue).not.toBeNull()
    expect(rows[0].estimateText).toBeUndefined()
  })

  it('⛔ THE AFFORDANCE AXIS IS UNTOUCHED — an estimated row still asks to be set', () => {
    // The whole constraint in one assertion. If a later change lets the estimate
    // satisfy the affordance, this REDs.
    const rows = rowsFor([node('f1', 'CRM Feature Fit', undefined, RANGE)])
    expect(rows[0].primaryValue).toBeNull()
    expect(rows[0].attention).toContain('no-value')
  })

  /*
   * ⚠ THIS CASE EXISTS BECAUSE ITS FIRST VERSION EXERCISED THE WRONG ARM.
   *
   * `ModelRowView` has TWO value-cell arms — a silent `<span>` when no editor is
   * connected, and the `Not set` BUTTON when one is
   * (`editorAvailable = row.editable && editConnected && typeof onBeginEdit === 'function'`).
   * A render with no callbacks takes the span. So the mutant that matters —
   * rendering the estimate INSTEAD of "Not set", the inverse harm this whole
   * design exists to prevent — mutated the BUTTON arm and my assertions never
   * reached it: 7/7 GREEN on a mutant that shipped the exact defect.
   *
   * A passing test proves nothing until you know which path it took. Both arms
   * are now pinned, and the button arm asserts the two axes are SEPARATE
   * elements rather than one merged string.
   */
  it('BOTH AXES, EDITOR ARM — the estimate sits beside "Not set", never instead of it', () => {
    const rows = rowsFor([node('f1', 'CRM Feature Fit', undefined, RANGE)])
    render(
      <ModelOutline
        rows={rows}
        tier="plain"
        editConnectedIds={new Set(['f1'])}
        onBeginEdit={() => {}}
      />,
    )
    // PRECONDITION: we really are on the button arm, not the silent span.
    const control = screen.getByTestId('model-row-v2-f1-value')
    expect(control.tagName).toBe('BUTTON')

    // The affordance still states the row is not set …
    expect(control.textContent).toContain('Not set')
    // … and Olumi's text is a SEPARATE element beside it, not a substitute.
    expect(screen.getByTestId('model-row-v2-f1-value-estimate').textContent).toBe(
      `Olumi: ${RANGE}`,
    )
  })

  it('BOTH AXES, READ-ONLY ARM — the estimate still reaches the user', () => {
    const rows = rowsFor([node('f1', 'CRM Feature Fit', undefined, RANGE)])
    render(<ModelOutline rows={rows} tier="plain" />)
    expect(screen.getByTestId('model-row-v2-f1-value').tagName).not.toBe('BUTTON')
    expect(screen.getByTestId('model-row-v2-f1-value-estimate').textContent).toBe(
      `Olumi: ${RANGE}`,
    )
    expect(screen.getByTestId('model-group-v2-factors-unknown-summary').textContent).toContain(
      '1 of 1',
    )
  })

  it('DISCRIMINATING — no estimate element at all when CEE supplied no text', () => {
    // Without this, "always render something" would satisfy every case above
    // while inventing a value on a row that genuinely has none.
    const rows = rowsFor([node('f4', 'Bare factor', undefined, undefined)])
    expect(rows[0].estimateText).toBeUndefined()
    render(<ModelOutline rows={rows} tier="plain" />)
    expect(screen.queryByTestId('model-row-v2-f4-value-estimate')).toBeNull()
  })
})
