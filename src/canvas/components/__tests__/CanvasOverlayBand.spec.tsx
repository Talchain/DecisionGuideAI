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
import { createPortal } from 'react-dom'
import { FocusModeChip } from '../FocusModeChip'
import { useCanvasStore } from '../../store'

/**
 * A stand-in occupant that claims a real cell under a real id.
 *
 * ⚠⚠ THIS RETURNED A FRAGMENT, WHILE ITS OWN COMMENT CLAIMED IT EXERCISED THE
 * PORTAL PATH. It did not: `<>{body}</>` renders inline, exactly like the
 * provider-less fallback, so `createPortal` was never reached by ANY test in the
 * repo. A reviewer proved it with a surviving mutant — making `useOverlayCell`
 * return `target: null` unconditionally, so every overlay draws back at the
 * positions this change exists to remove, left 104/104 GREEN with identical
 * counts, while a contrast mutant (height 64→96) REDDED 2. The kit
 * discriminated; there was simply nothing pointed at the portal.
 *
 * It now portals, like every migrated component, and `lands INSIDE its cell`
 * below asserts the placement rather than mere presence — `getByTestId` finds a
 * portalled node and an inline node identically, which is why presence could
 * never have caught this.
 */
function Claimant({ cell, id, wants = true }: { cell: OverlayCell; id: string; wants?: boolean }) {
  const { granted, target } = useOverlayCell(cell, id, wants)
  if (!wants || !granted) return null
  const body = <div data-testid={id}>{id}</div>
  return target ? createPortal(body, target) : body
}

/** The two highest bottom-centre claimants, by identity, from the shipped table. */
const [FIRST, SECOND] = OVERLAY_PRIORITY['bottom-centre']

describe('CanvasOverlayBand — one slot, one occupant', () => {
  /**
   * ⭐⭐ THE ORDER IS WRITTEN OUT BY HAND, AND THAT IS DELIBERATE — CAUGHT BY A
   * SURVIVING MUTANT ON THIS FILE'S FIRST VERSION.
   *
   * Every other assertion here destructures `FIRST` and `SECOND` from
   * `OVERLAY_PRIORITY` at runtime. That makes them derived, which is the right
   * shape for "the mechanism honours the table" — but it means a mutant that
   * INVERTS the table moves the expectation along with it, and the suite stays
   * green. Measured: swapping the first two entries left all eight tests
   * passing. The guard was agreeing with itself (CLAUDE.md trap 13b).
   *
   * Derivation proves the code and the table AGREE; only a hand-written corpus
   * can notice the table is WRONG (trap 12d). The two are not redundant and
   * neither replaces the other, so both ship.
   *
   * The order encodes a product judgement: A CONTROL OUTRANKS A DISCLOSURE.
   * `model-extent-notice` carries the only "Show whole model" affordance, so
   * suppressing it costs a capability, whereas suppressing a disclosure costs a
   * sentence the user gets back when the winner is dismissed. An earlier
   * "honesty first" ordering put the disclosures on top and made the button
   * unreachable on every fresh draft. Changing this list changes which true
   * thing a user is not told — and, above, what they can no longer do.
   */
  const EXPECTED_BOTTOM_CENTRE = [
    'starter-provenance-banner',
    'model-extent-notice',
    'first-model-notice',
    'canvas-lod-notice',
    'assistant-focus-chip',
    'focus-mode-chip',
  ]

  it('the bottom-centre priority ORDER is the declared one, spelled out', () => {
    expect([...OVERLAY_PRIORITY['bottom-centre']]).toEqual(EXPECTED_BOTTOM_CENTRE)
  })

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
    // A plain px height, deliberately: the `--canvas-overlay-band-h` token this
    // once read was defined in no stylesheet, so the var always fell through to
    // its fallback while claiming to be overridable.
    expect(band!.style.height).toBe(`${OVERLAY_BAND_HEIGHT}px`)
    expect(band!.style.pointerEvents).toBe('none')
    expect(band!.style.position).toBe('absolute')
  })

  it('an occupant LANDS INSIDE its declared cell — the portal path, asserted', () => {
    // ⭐ THE ASSERTION THE SUITE WAS MISSING. Every other test here proves the
    // grant ARITHMETIC (who wins, who withdraws). None proved the winner is
    // actually MOVED into the band — and `getByTestId` cannot tell a portalled
    // node from one rendered inline, so presence was satisfied either way.
    // A reviewer's mutant (`target: null`, i.e. portal disabled, every overlay
    // back at its old position) survived 104/104 because of exactly this.
    //
    // Binds by CONTAINMENT and by IDENTITY: the occupant must be a descendant
    // of the element carrying `data-overlay-cell="bottom-centre"`, not merely
    // present somewhere in the document.
    const { container } = render(
      <CanvasOverlayBandProvider>
        <CanvasOverlayBand />
        <Claimant cell="bottom-centre" id={FIRST} />
      </CanvasOverlayBandProvider>,
    )

    const cell = container.querySelector('[data-overlay-cell="bottom-centre"]')
    expect(cell, 'the bottom-centre cell must exist for an occupant to land in').not.toBeNull()

    const occupant = screen.getByTestId(FIRST)
    expect(
      cell!.contains(occupant),
      `'${FIRST}' rendered, but NOT inside [data-overlay-cell="bottom-centre"]. It is drawing ` +
        `at its own position instead of in the band — which is the defect this band removes, ` +
        `and it is invisible to any assertion that only checks the occupant is present.`,
    ).toBe(true)
  })

  it('CONTRAST CONTROL: provider-less, the same occupant is NOT inside any cell', () => {
    // The other direction, so the containment assertion above cannot pass by
    // accident of the query. Rendered standalone there is no band at all, the
    // fallback draws inline, and containment must be FALSE — this is the
    // documented provider-less behaviour, pinned rather than assumed.
    const { container } = render(<Claimant cell="bottom-centre" id={FIRST} />)
    expect(screen.getByTestId(FIRST)).toBeInTheDocument()
    expect(container.querySelector('[data-overlay-cell="bottom-centre"]')).toBeNull()
  })

  it('A REAL OCCUPANT lands inside the cell AND keeps its pointer events', () => {
    // The stand-in `Claimant` above proves the MECHANISM. This proves a SHIPPED
    // component travels it — a harness can portal correctly while the product
    // does not, and the reviewer's finding was that no test anywhere mounted a
    // real occupant under the provider.
    //
    // `FocusModeChip` is chosen because it is one of the two occupants that was
    // NOT re-enabling pointer events: portalled into a cell that sets
    // `pointer-events: none`, it rendered visibly and its "exit focus mode"
    // button was not hit-testable. So this binds both findings to one mount.
    useCanvasStore.getState().resetCanvas()
    useCanvasStore.setState({
      nodes: [{ id: 'n1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Test Factor' } }],
      selection: { nodeIds: new Set(['n1']), edgeIds: new Set() },
      highlightedEdges: new Set(['e1', 'e2']),
    } as never)

    const { container } = render(
      <CanvasOverlayBandProvider>
        <CanvasOverlayBand />
        <FocusModeChip />
      </CanvasOverlayBandProvider>,
    )

    const chip = screen.getByTestId('focus-mode-chip')
    const cell = container.querySelector('[data-overlay-cell="bottom-centre"]')
    expect(cell, 'the bottom-centre cell must exist').not.toBeNull()
    expect(
      cell!.contains(chip),
      'focus-mode-chip rendered but did not land inside the bottom-centre cell',
    ).toBe(true)

    // ⚠ SCOPE: jsdom computes no cascade, so this asserts the DECLARATION the
    // component makes, not a hit test. A real-browser click was never taken —
    // in either direction — and this comment is here so nobody reads the green
    // as one. `overlayOwner.sourceScan.spec.ts` enforces the same property
    // across all seven occupants from their bytes.
    expect(
      chip.className.includes('pointer-events-auto'),
      'focus-mode-chip does not re-enable pointer events, so inside the band — which sets ' +
        'pointer-events: none, and the property inherits — its exit button is a dead control.',
    ).toBe(true)
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
