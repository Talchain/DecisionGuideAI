/**
 * A collapsed row says what is behind it, visibly.
 *
 * ── THE DEFECT ─────────────────────────────────────────────────────────────
 * `10-REASONING-PANEL-revised.html` draws each of its three collapsed rows with
 * a subtitle — "What moves the outcome, and through what", "What this run could
 * not settle", "Method, provenance and receipts". A title plus a count is a
 * container name and a number; the subtitle is what tells a reader whether it
 * is worth a click.
 *
 * `SectionShell` HAS a `subtitle` prop. It is declared, plumbed through
 * `AnalysisNewSection`, and lands on the toggle as `title={subtitle}` — a
 * HOVER TOOLTIP, unreachable by touch and by keyboard. And no mount passed one,
 * so even that never rendered. A prop that is fully wired and never supplied is
 * the same defect class as a component with no importers: built, not plugged in.
 *
 * ── WHAT THIS PINS ─────────────────────────────────────────────────────────
 * That the subtitle is VISIBLE — `toBeVisible`, not merely present — because
 * the failing version of this was a `title` attribute, which every
 * presence-based assertion would have passed.
 */
import '@testing-library/jest-dom/vitest'
import { describe, expect, it } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { SectionShell } from '../sections/SectionShell'

const TID = 'shell'

function renderShell(subtitle?: string) {
  cleanup()
  render(
    <SectionShell title="Drivers and dynamics" subtitle={subtitle} count={5} testId={TID}>
      <p>body</p>
    </SectionShell>,
  )
}

describe('a collapsed row says what is inside it', () => {
  it('CONTROL: the title and count render without a subtitle', () => {
    // Without this, a broken shell would make every assertion below vacuous.
    renderShell()
    expect(screen.getByTestId(`${TID}-title`)).toHaveTextContent('Drivers and dynamics')
    expect(screen.getByTestId(`${TID}-count`)).toHaveTextContent('5')
    expect(screen.queryByTestId(`${TID}-subtitle`), 'no subtitle, no element').toBeNull()
  })

  it('the subtitle is VISIBLE, not a hover tooltip', () => {
    renderShell('What moves the outcome, and through what')
    const sub = screen.getByTestId(`${TID}-subtitle`)
    // ⚠ `toBeVisible`, deliberately. The shipped behaviour put this string on
    // `title=`, which is present in the DOM and invisible to touch and to
    // keyboard — and which a presence assertion would happily pass.
    expect(sub).toBeVisible()
    expect(sub).toHaveTextContent('What moves the outcome, and through what')
  })

  it('DISCRIMINATOR: the subtitle is NOT the title, and does not replace it', () => {
    // The cheapest wrong implementation renders the subtitle in the title slot.
    renderShell('What this run could not settle')
    expect(screen.getByTestId(`${TID}-title`)).toHaveTextContent('Drivers and dynamics')
    expect(screen.getByTestId(`${TID}-title`)).not.toHaveTextContent('could not settle')
  })

  it('the row still announces as ONE control', () => {
    // A subtitle inside the toggle must not become a second tab stop or a
    // nested interactive element.
    renderShell('Method, provenance and receipts')
    expect(screen.getAllByRole('button')).toHaveLength(1)
    expect(screen.getByRole('button')).toHaveTextContent('Method, provenance and receipts')
  })
})
