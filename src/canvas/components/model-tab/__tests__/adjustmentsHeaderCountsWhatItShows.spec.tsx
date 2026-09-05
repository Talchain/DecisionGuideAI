/**
 * The adjustments header never claims a number the list does not have.
 *
 * ── THE DEFECT, DERIVED FROM THE CODE'S OWN ARITHMETIC ─────────────────────
 * `ModelAdjustments` renders when ANY of three arrays is non-empty
 * (`adjustments`, `repairActions`, `postRunRepairs`) but counts only the first
 * two (`totalCount = factorCount + repairActions.length`). So a payload
 * carrying ONLY post-run repairs renders the section, skips the `=== 1` arm,
 * and lands on the multi-item header with both counts at zero:
 *
 *     Olumi applied 0 adjustments
 *
 * — in `typography.panelHeader`, directly above a populated list of repairs.
 * A heading that states a count is a claim about what is under it.
 *
 * ── WHY THE FIX IS A THIRD BRANCH AND NOT `totalCount + postRunRepairs` ────
 * `totalCount` gates the compact single-item layout, and that arm RETURNS
 * EARLY. Adding post-run repairs to it reroutes a post-run-only payload into a
 * layout built for one factor adjustment, where both its locals are `undefined`
 * — so the header claims an adjustment over an empty span and the repair
 * renders nowhere. The header is a separate question from the layout.
 *
 * ⚠⚠ I WROTE THAT PARAGRAPH AND THEN DID THE THING IT FORBIDS. Answering a
 * review finding ("`totalCount` still ignores `postRunRepairs`") I widened the
 * sum, left this comment standing above it, and shipped the exact reroute it
 * names. A second review caught it by EXECUTION — the rendered DOM was
 * `<p>Olumi applied 1 adjustment</p><span></span>`.
 *
 * The test below could not see it: it asserted only `not.toHaveTextContent(0)`,
 * and the compact arm says "1". A guard written against the number was blind to
 * the row disappearing. `THE LAYOUT` case exists so that cannot recur.
 *
 * The gate is now the honest one — compact only when there is genuinely one
 * thing — and `totalCount` keeps its documented meaning.
 */
import '@testing-library/jest-dom/vitest'
import { describe, expect, it } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { ModelAdjustments } from '../ModelAdjustments'

const POST_RUN = [
  { code: 'STRENGTH_DEFAULTED', target: 'Delivery Throughput', detail: 'A strength was defaulted.' },
]

function renderAdjustments(props: Record<string, unknown>) {
  cleanup()
  const merged = { adjustments: [], repairActions: [], postRunRepairs: [], ...props }
  render(<ModelAdjustments {...(merged as Parameters<typeof ModelAdjustments>[0])} />)
}

describe('the adjustments header counts what it shows', () => {
  it('CONTROL: nothing at all renders nothing at all', () => {
    // Without this the assertions below could pass by the section never
    // mounting, which is the shape that makes an absence claim vacuous.
    const { container } = render(
      <ModelAdjustments adjustments={[]} repairActions={[]} postRunRepairs={[]} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('a post-run-only payload never says "0"', () => {
    renderAdjustments({ postRunRepairs: POST_RUN })
    const section = screen.getByTestId('model-adjustments')
    expect(section, `header claimed a count it does not have`).not.toHaveTextContent(/\b0\b/)
  })

  it('THE LAYOUT: a post-run-only payload still RENDERS its repair', () => {
    // ⚠ THE CASE THE WIDENED SUM BROKE, and the one the count assertion above
    // cannot see. `(adjustments=[], repairActions=[], postRunRepairs=[one])`
    // took the compact arm, where both its locals are `undefined` — a header
    // over an empty span, with the repair rendered nowhere. Asserted by CONTENT,
    // not by a count, because the count was what lied.
    renderAdjustments({ postRunRepairs: POST_RUN })
    const section = screen.getByTestId('model-adjustments')
    expect(
      section.textContent ?? '',
      'the repair itself must be on screen, not just counted',
    ).toContain('analysis-time')
  })

  it('DISCRIMINATOR: a single FACTOR adjustment still takes the compact arm', () => {
    // The gate must stay narrow. Widening it to "never compact" would throw
    // away the layout the compact arm exists for.
    renderAdjustments({ adjustments: [{ code: 'A', type: 'A', target: 'X', detail: 'one' }] })
    expect(screen.getByTestId('model-adjustments').textContent ?? '').toContain('1 factor')
  })

  it('DISCRIMINATOR: a real count is still stated', () => {
    // The cheapest way to pass the test above is to delete every number from
    // the header. This REDs if that happens.
    renderAdjustments({
      repairActions: [
        { code: 'A', detail: 'one' },
        { code: 'B', detail: 'two' },
      ],
    })
    expect(screen.getByTestId('model-adjustments')).toHaveTextContent(/\b2\b/)
  })
})
