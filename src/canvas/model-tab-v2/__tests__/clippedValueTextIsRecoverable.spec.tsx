/**
 * ⭐⭐ TEXT THAT TRUNCATES BY DESIGN MUST BE RECOVERABLE. SEVEN CELLS WERE NOT.
 *
 * MEASURED on the DEPLOYED build `80ccf768` (guest session, seeded "Customer
 * Data Platform Selection", dock measured at exactly 414px, Model tab open),
 * by sweeping every text-bearing leaf in `outputs-dock-panel-diagnostics` and
 * comparing `scrollWidth` against `clientWidth`:
 *
 *   61 clipped elements, of which the ONLY unrecoverable ones were the SEVEN
 *   `-value-estimate` hints. Worst: "Olumi: Moderate (0.5)" rendered a
 *   **31px box for content needing 125px** — three readable characters — with
 *   no `title`, no `aria-label` and no `sr-only` anywhere above it.
 *
 * ⚠ TWO CORRECTIONS TO THE FIRST VERSION OF THAT SWEEP, BOTH FOUND INSIDE MY
 * OWN MEASUREMENT, because they are the reason the figure is 7 and not 78:
 *   · `clientWidth === 1` is the `.sr-only` signature, not clipping. The first
 *     pass counted #1282's deliberate screen-reader twins as defects.
 *   · The relationship phrase looked unrecoverable under a rule demanding the
 *     recovery text CONTAIN the visible string. It does not contain it — the
 *     visible half is `split.remainder` — but `ValueLeaf`'s split arm already
 *     carries `title={display}` with the whole producer string. Recoverable.
 * The sweep's controls both fired (an injected real overflow was flagged; an
 * injected `sr-only` was excluded), which is the only reason the 7 is credible.
 *
 * ── WHAT THIS SPEC PINS, AND WHAT IT DELIBERATELY DOES NOT ────────────────
 * It pins RECOVERABILITY only. It does NOT pin geometry, and the trade that
 * produces the truncation is deliberate and unchanged: the hint is the atom
 * that gives so the node's label does not. Two alternative fixes are excluded
 * ON MEASUREMENT and must not be re-proposed — widening the grid cap
 * (`minmax(0,5.5rem)` was tried and cost four fully-visible option labels) and
 * stacking the hint onto a second line (tried; rows measured 42px, which is why
 * `whitespace-nowrap` is on both idle arms). See `ModelRowView.tsx`.
 *
 * ⚠ BOTH IDLE ARMS ARE PINNED. This component has EIGHT return paths and two
 * IDLE ones — a silent `<span>` with no editor connected, and the `Not set`
 * BUTTON with one. `rowShowsOlumisEstimate.spec` records a mutant that shipped
 * the exact defect while staying 7/7 green because it only reached one arm.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { toModelRows } from '../adapters'
import { ModelOutline } from '../ModelOutline'

const RANGE = '0.25 to 0.75'
/** The exact string measured at 31px-of-125px on the deployed build. */
const LIVE_WORST = 'Moderate (0.5)'

const factor = (id: string, label: string, displayValue: string) => ({
  id,
  type: 'factor',
  data: { label, kind: 'factor', display_value: displayValue },
})

const rowsFor = (nodes: unknown[]) => toModelRows({ nodes, edges: [] } as never)

describe('clipped value text is recoverable — the estimate hint', () => {
  it('PRECONDITION — the fixture really produces a truncating estimate hint', () => {
    // Pin the precondition in-test. Without this the assertions below could
    // pass on a row that renders no hint at all, which is the shape of a
    // guard agreeing with itself.
    const rows = rowsFor([factor('f1', 'GDPR EU Data Residency Compliance', LIVE_WORST)])
    expect(rows[0].primaryValue).toBeNull()
    expect(rows[0].estimateText).toBe(LIVE_WORST)
  })

  it('⭐ EDITOR ARM — the hint carries its own full text, verbatim', () => {
    const rows = rowsFor([factor('f1', 'GDPR EU Data Residency Compliance', LIVE_WORST)])
    render(
      <ModelOutline
        rows={rows}
        tier="plain"
        editConnectedIds={new Set(['f1'])}
        onBeginEdit={() => {}}
      />,
    )
    // PRECONDITION: this really is the button arm, not the silent span.
    expect(screen.getByTestId('model-row-v2-f1-value').tagName).toBe('BUTTON')

    const hint = screen.getByTestId('model-row-v2-f1-value-estimate')
    // Bound by IDENTITY to the hint element, and to the EXACT string it renders
    // — not to "some title exists somewhere above it", which is how the
    // enclosing button's "Change this value" was mistaken for recovery.
    expect(hint.getAttribute('title')).toBe(`Olumi: ${LIVE_WORST}`)
    expect(hint.getAttribute('title')).toBe(hint.textContent)
  })

  it('⭐ READ-ONLY ARM — the same, because a fix to one arm is a fix half the rows never get', () => {
    const rows = rowsFor([factor('f2', 'Migration and Integration Effort', RANGE)])
    render(<ModelOutline rows={rows} tier="plain" />)
    expect(screen.getByTestId('model-row-v2-f2-value').tagName).not.toBe('BUTTON')

    const hint = screen.getByTestId('model-row-v2-f2-value-estimate')
    expect(hint.getAttribute('title')).toBe(`Olumi: ${RANGE}`)
    expect(hint.getAttribute('title')).toBe(hint.textContent)
  })

  it('⛔ THE AFFORDANCE IS NOT WHAT RECOVERS IT — the button still says its own thing', () => {
    // The discriminating case. Before this change the nearest `title` above the
    // hint was the button's "Change this value" — present, and about a
    // different subject entirely. A recovery rule that accepts any ancestor
    // title would score the defect as already fixed, so this pins that the two
    // titles are DIFFERENT and each is about its own element.
    const rows = rowsFor([factor('f1', 'GDPR EU Data Residency Compliance', LIVE_WORST)])
    render(
      <ModelOutline
        rows={rows}
        tier="plain"
        editConnectedIds={new Set(['f1'])}
        onBeginEdit={() => {}}
      />,
    )
    const control = screen.getByTestId('model-row-v2-f1-value')
    const hint = screen.getByTestId('model-row-v2-f1-value-estimate')
    expect(control.getAttribute('title')).toBe('Change this value')
    expect(hint.getAttribute('title')).not.toBe(control.getAttribute('title'))
  })
})
