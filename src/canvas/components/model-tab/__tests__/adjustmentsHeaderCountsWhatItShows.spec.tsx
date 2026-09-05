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
 * `totalCount` gates the compact single-item layout, and its comment says it
 * "keeps its historic meaning (all visible rows) for any gating logic". Adding
 * post-run repairs to it would silently reroute a post-run-only payload into a
 * layout built for one factor adjustment. The header is a separate question
 * from the layout, so it gets a separate answer.
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
