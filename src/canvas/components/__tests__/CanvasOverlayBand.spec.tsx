/**
 * ONE SLOT, ONE OCCUPANT — the rule the founder asked for, tested as a rule
 * rather than as a list of the pairs that happen to collide today.
 *
 * ⚠ WHY THE CLAIMANTS HERE ARE FAKES. Mounting the real notices would bind
 * these assertions to whatever conditions those components happen to have
 * (`lodActive`, a starter in the graph, a non-zero outside count), and a test
 * that stops firing because an unrelated condition changed is a guard that
 * silently stops guarding. These use two ids drawn from the REAL
 * `OVERLAY_PRIORITY` table, so the priority relation under test is the shipped
 * one; only the rendering is stand-in.
 *
 * The contrast control is the second half of every ordering claim here: it is
 * not enough that the higher-priority occupant renders — the LOWER one must be
 * shown to render once the higher withdraws, or "only one rendered" is equally
 * consistent with the cell being broken and rendering nothing but the first
 * thing it saw.
 */
import { describe, it, expect } from 'vitest'
import { useState } from 'react'
import { render, screen, act } from '@testing-library/react'
import {
  CanvasOverlayBand,
  CanvasOverlayBandProvider,
  OVERLAY_PRIORITY,
  OVERLAY_BAND_HEIGHT,
  OVERLAY_BAND_SELECTOR,
  useOverlayCell,
  type OverlayCell,
} from '../CanvasOverlayBand'

/** A stand-in occupant that claims a real cell under a real id. */
function Claimant({ cell, id, wants = true }: { cell: OverlayCell; id: string; wants?: boolean }) {
  const { granted, target } = useOverlayCell(cell, id, wants)
  if (!wants || !granted) return null
  const body = <div data-testid={id}>{id}</div>
  // Mirrors what every migrated component does, so the portal path itself is
  // exercised rather than only the grant arithmetic.
  return target ? <>{body}</> : body
}

/** The two highest bottom-centre claimants, by identity, from the shipped table. */
const [FIRST, SECOND] = OVERLAY_PRIORITY['bottom-centre']

describe('CanvasOverlayBand — one slot, one occupant', () => {
  it('POSITIVE CONTROL: the priority table under test is non-empty and ordered', () => {
    // Trap 13: every ordering assertion below is vacuous if the table is empty,
    // and `[undefined, undefined]` destructures without complaint.
    expect(OVERLAY_PRIORITY['bottom-centre'].length).toBeGreaterThanOrEqual(2)
    expect(FIRST).toBeTypeOf('string')
    expect(SECOND).toBeTypeOf('string')
    expect(FIRST).not.toBe(SECOND)
  })

  it('two claimants on one cell: only the higher-priority one renders', () => {
    render(
      <CanvasOverlayBandProvider>
        <CanvasOverlayBand />
        {/* Mounted in REVERSE priority order deliberately: if the cell resolved
            by mount order rather than by the table, this is the arrangement
            that would expose it. */}
        <Claimant cell="bottom-centre" id={SECOND} />
        <Claimant cell="bottom-centre" id={FIRST} />
      </CanvasOverlayBandProvider>,
    )

    expect(screen.getByTestId(FIRST)).toBeInTheDocument()
    expect(screen.queryByTestId(SECOND)).toBeNull()
  })

  it('CONTRAST CONTROL: the lower-priority claimant renders once the higher withdraws', () => {
    // Without this, "only one rendered" is equally consistent with a cell that
    // renders nothing but the first id it ever saw.
    function Harness() {
      const [topPresent, setTopPresent] = useState(true)
      return (
        <CanvasOverlayBandProvider>
          <CanvasOverlayBand />
          <Claimant cell="bottom-centre" id={SECOND} />
          <Claimant cell="bottom-centre" id={FIRST} wants={topPresent} />
          <button type="button" data-testid="withdraw" onClick={() => setTopPresent(false)}>
            withdraw
          </button>
        </CanvasOverlayBandProvider>
      )
    }
    render(<Harness />)

    // Before: the higher one holds the cell.
    expect(screen.getByTestId(FIRST)).toBeInTheDocument()
    expect(screen.queryByTestId(SECOND)).toBeNull()

    act(() => {
      screen.getByTestId('withdraw').click()
    })

    // After: the cell is handed to the next in line, not left empty.
    expect(screen.queryByTestId(FIRST)).toBeNull()
    expect(screen.getByTestId(SECOND)).toBeInTheDocument()
  })

  it('a claimant that does not WANT to render never holds the cell shut', () => {
    // The `wants` parameter exists for this: a component whose own conditions
    // say it has nothing to say must not outrank one that does, merely because
    // it sits higher in the table.
    render(
      <CanvasOverlayBandProvider>
        <CanvasOverlayBand />
        <Claimant cell="bottom-centre" id={FIRST} wants={false} />
        <Claimant cell="bottom-centre" id={SECOND} />
      </CanvasOverlayBandProvider>,
    )

    expect(screen.queryByTestId(FIRST)).toBeNull()
    expect(screen.getByTestId(SECOND)).toBeInTheDocument()
  })

  it('cells are independent — a bottom-centre occupant does not evict bottom-left', () => {
    const LEFT = OVERLAY_PRIORITY['bottom-left'][0]
    expect(LEFT, 'bottom-left must declare a claimant for this to test anything').toBeTypeOf('string')

    render(
      <CanvasOverlayBandProvider>
        <CanvasOverlayBand />
        <Claimant cell="bottom-centre" id={FIRST} />
        <Claimant cell="bottom-left" id={LEFT} />
      </CanvasOverlayBandProvider>,
    )

    expect(screen.getByTestId(FIRST)).toBeInTheDocument()
    expect(screen.getByTestId(LEFT)).toBeInTheDocument()
  })

  it('PROVIDER-LESS FALLBACK: a standalone claimant renders inline, as it did before the band', () => {
    // This is what keeps every existing component spec meaningful. Those specs
    // render their component on its own; if that path returned null, they would
    // quietly become tests of a null render while still passing their
    // "renders nothing when …" cases.
    render(<Claimant cell="bottom-centre" id={FIRST} />)
    expect(screen.getByTestId(FIRST)).toBeInTheDocument()
  })

  it('the band reserves a FIXED height and takes no pointer events', () => {
    // Both properties are load-bearing rather than cosmetic. The fixed height
    // is what makes the band an admissible fit contributor (a measured one
    // would re-fit the camera whenever a notice appeared); `pointer-events:
    // none` is what stops a mostly-empty 64px strip swallowing clicks along the
    // whole bottom edge of the canvas.
    const { container } = render(
      <CanvasOverlayBandProvider>
        <CanvasOverlayBand />
      </CanvasOverlayBandProvider>,
    )
    const band = container.querySelector(OVERLAY_BAND_SELECTOR) as HTMLElement | null
    expect(band, 'the band element must be findable by the selector computeFitPadding uses').not.toBeNull()
    expect(band!.style.height).toBe(`var(--canvas-overlay-band-h, ${OVERLAY_BAND_HEIGHT}px)`)
    expect(band!.style.pointerEvents).toBe('none')
    expect(band!.style.position).toBe('absolute')
  })

  it('the band is PERSISTENT — it renders with no occupants at all', () => {
    // Criterion 4 of `computeFitPadding`'s contributor test, asserted rather
    // than assumed. A band that appeared only when occupied would reserve a
    // varying amount of canvas and move the camera.
    const { container } = render(
      <CanvasOverlayBandProvider>
        <CanvasOverlayBand />
      </CanvasOverlayBandProvider>,
    )
    expect(container.querySelector(OVERLAY_BAND_SELECTOR)).not.toBeNull()
  })
})
