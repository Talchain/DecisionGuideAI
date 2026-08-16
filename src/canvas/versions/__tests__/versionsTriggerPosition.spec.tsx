/**
 * P0 — the "Versions" trigger must never occlude the OutputsDock's chrome.
 *
 * ── WHAT THIS FILE CAN AND CANNOT PROVE (trap 3) ─────────────────────────────
 * jsdom has no layout engine: `getBoundingClientRect()` returns zeros here, so
 * a hit-test in this environment would be theatre. What jsdom CAN prove is
 * that the component renders the DERIVED offset, and arithmetic can prove that
 * offset clears the dock across the whole supported viewport x dock-width
 * matrix. The remaining claim — that a real browser returns the dock's own
 * control from `elementFromPoint()` at its centre — is a browser witness and
 * is banked separately at 1280x800 in both dock states. Neither half is
 * claimed by the other.
 *
 * ── WHY THE MATRIX IS DERIVED (trap 12d) ─────────────────────────────────────
 * The dock widths below are not a hand-written list; they are generated from
 * `dockWidth.ts`, the dock's own width authority. A hand-written list would
 * agree with itself forever while the dock moved underneath it. The rail width
 * and the expanded fallback are additionally pinned against OutputsDock's
 * SOURCE, so a change to either file REDs here rather than silently
 * re-opening the defect.
 */
import '@testing-library/jest-dom/vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { VersionsPanelHost } from '../VersionsPanelHost'
import {
  DOCK_EXPANDED_WIDTH_FALLBACK,
  DOCK_EXPANDED_WIDTH_VAR,
  DOCK_VIEWPORT_GUTTER_PX,
  VERSIONS_TRIGGER_RIGHT_INSET_CSS,
  VERSIONS_TRIGGER_TOP_PX,
  triggerDockHorizontalOverlapPx,
  versionsTriggerRightOffsetPx,
} from '../versionsTriggerPosition'
import {
  DOCK_MIN_WIDTH,
  dockWidthBounds,
  responsiveDockWidth,
} from '../../components/dockWidth'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUTPUTS_DOCK_SRC = resolve(HERE, '../../components/OutputsDock.tsx')
const dockSource = readFileSync(OUTPUTS_DOCK_SRC, 'utf8')

/** The rail the dock collapses to — `var(--dock-right-collapsed, 2.5rem)`. */
const DOCK_RAIL_WIDTH_PX = 40

/**
 * Every laptop-and-up viewport the product supports. 1280 is the narrowest
 * the charter names; the upper end covers external and retina desktops.
 */
const SUPPORTED_VIEWPORTS = [1280, 1366, 1440, 1512, 1600, 1728, 1920, 2560]

/** The measured width of the rendered trigger on the deployed build. */
const OBSERVED_TRIGGER_WIDTH = 95

/**
 * Every EXPANDED width the dock can hold at a given viewport — the responsive
 * default plus both ends of the hard drag bounds. Derived from the dock's own
 * rules, so a change there regenerates this matrix automatically.
 */
function reachableExpandedWidths(viewportWidth: number): number[] {
  const { min, max } = dockWidthBounds(viewportWidth)
  return [...new Set([min, responsiveDockWidth(viewportWidth), max])]
}

/**
 * The two dock states, for one expanded width.
 *
 * ⚠ The pairing here is the whole point, and getting it wrong is how this file
 * first went green-then-red on itself: `--dock-right-expanded` holds the
 * expanded width in BOTH states — collapsing the dock swaps which variable
 * `asideStyle.width` reads, it does not rewrite the expanded one. So the
 * trigger's offset is a function of the EXPANDED width in both rows, while the
 * dock's rendered width is 40px in one of them. Feeding the offset a width the
 * dock does not currently have would be testing a configuration the product
 * cannot reach (trap 16-inverse).
 */
function dockStates(expandedWidth: number): Array<{ label: string; dockWidth: number }> {
  return [
    { label: `expanded to ${expandedWidth}px`, dockWidth: expandedWidth },
    { label: `collapsed to the rail (expanded var still ${expandedWidth}px)`, dockWidth: DOCK_RAIL_WIDTH_PX },
  ]
}

function renderTrigger(): HTMLElement {
  render(<VersionsPanelHost />)
  return screen.getByTestId('versions-panel-trigger')
}

/**
 * The exact shape the trigger's `right` inset must have. Anchored, and it
 * captures the two numbers, so a change to either the fallback or the constant
 * is measured rather than waved through by a substring match.
 */
const RIGHT_INSET_SHAPE = /^calc\(var\(--dock-right-expanded,\s*([\d.]+)rem\)\s*\+\s*([\d.]+)px\)$/

/**
 * Resolve what the RENDERED component's `right` inset comes to, in px, for a
 * given dock expanded width.
 *
 * ⚠ THIS IS THE LOAD-BEARING BINDING (trap 19). Every clearance assertion
 * below runs on the number this returns, so it is measuring the COMPONENT, not
 * this file's own arithmetic. Reverting the component to `right-3` makes the
 * regex fail and takes the entire matrix red — which is the proof obligation:
 * delete the fix, and the guarantee tests must go with it. Reading the offset
 * from `versionsTriggerRightOffsetPx()` instead would leave the matrix green
 * over a product that had gone back to occluding the dock.
 */
function resolveRenderedRightOffsetPx(dockExpandedWidthPx: number): number {
  const trigger = renderTrigger()
  const rightInset = trigger.style.right
  const className = trigger.className
  // Render-and-release, so this is safe to call repeatedly inside one test
  // without a second mount making `getByTestId` ambiguous.
  cleanup()
  const match = RIGHT_INSET_SHAPE.exec(rightInset)
  if (!match) {
    throw new Error(
      `the trigger's right inset does not read the dock's width variable: got ${JSON.stringify(rightInset)} ` +
        `(className: ${className})`,
    )
  }
  const [, fallbackRem, constantPx] = match
  // First paint, before anything has set the custom property, must ALSO clear
  // the dock — so the fallback has to be at least the dock's minimum width.
  expect(Number(fallbackRem) * 16).toBeGreaterThanOrEqual(DOCK_MIN_WIDTH)
  return dockExpandedWidthPx + Number(constantPx)
}

afterEach(cleanup)

describe('the Versions trigger clears the OutputsDock', () => {
  // ── Preconditions, pinned in-test (trap 13b) ───────────────────────────────
  // Every assertion below is about HORIZONTAL separation. That is only the
  // whole guarantee if the two elements genuinely share a vertical band — if
  // they did not, the horizontal arithmetic would be passing for a reason
  // that has nothing to do with the fix.
  it('PRECONDITION: the trigger and the dock share a vertical band, so horizontal clearance is the whole guarantee', () => {
    // The dock's own top inset, read from its source rather than restated.
    expect(dockSource).toContain('top: 12,')
    expect(VERSIONS_TRIGGER_TOP_PX).toBe(12)
    // Same top edge, both ~34px and ~24px tall: they overlap vertically in
    // every state. Nothing about the vertical axis separates them.
  })

  it('PRECONDITION: the dock anchors to the same viewport edge at the same inset', () => {
    expect(dockSource).toContain('right: 12,')
    expect(DOCK_VIEWPORT_GUTTER_PX).toBe(12)
  })

  // ── The cross-file pins. These are what stop the derivation drifting. ──────
  it('the offset reads the dock’s OWN width variable, with the dock’s OWN fallback', () => {
    // Extracted from the shipped literal rather than composed here. Composing
    // it would spell `var(--${…})` in this file, which registers a DYNAMIC
    // var() site with the estate's css-var census and makes the fallback
    // unresolvable to it (`@@1@@`) — the guard would go blind on the very
    // reference this test exists to pin.
    const varRef = VERSIONS_TRIGGER_RIGHT_INSET_CSS.slice(
      VERSIONS_TRIGGER_RIGHT_INSET_CSS.indexOf('var('),
      VERSIONS_TRIGGER_RIGHT_INSET_CSS.indexOf(')') + 1,
    )
    // Still derived: the extracted reference must name the constants.
    expect(varRef).toContain(DOCK_EXPANDED_WIDTH_VAR)
    expect(varRef).toContain(DOCK_EXPANDED_WIDTH_FALLBACK)
    // The cross-file pin. If OutputsDock renames the property or changes the
    // fallback, the trigger stops matching it VERBATIM and this REDs — rather
    // than silently re-opening the overlap at first paint.
    expect(dockSource).toContain(varRef)
  })

  it('the rail width this matrix uses is the width the dock actually collapses to', () => {
    expect(dockSource).toContain('var(--dock-right-collapsed, 2.5rem)')
    expect(DOCK_RAIL_WIDTH_PX).toBe(2.5 * 16)
  })

  // ── The binding to the component (trap 19: bind by IDENTITY) ───────────────
  it('the rendered trigger carries the derived offset — bound by testid AND accessible name', () => {
    const trigger = renderTrigger()
    // Two independent identity handles, so this cannot pass on some other
    // button that happens to be positioned correctly.
    expect(trigger).toHaveAccessibleName(/versions/i)
    expect(trigger.tagName).toBe('BUTTON')

    expect(trigger.style.right).toBe(VERSIONS_TRIGGER_RIGHT_INSET_CSS)
    expect(trigger.style.top).toBe(`${VERSIONS_TRIGGER_TOP_PX}px`)
  })

  it('the trigger no longer pins itself to the viewport edge', () => {
    const trigger = renderTrigger()
    // The defect in one line: `right-3` put the trigger at the dock's own
    // inset. Any return to an edge-pinned inset REDs here.
    expect(trigger.className).not.toMatch(/(^|\s)right-3(\s|$)/)
    expect(trigger.style.right).not.toBe('12px')
    expect(trigger.style.right).not.toBe('0.75rem')
  })

  // ── The guarantee itself, across the derived matrix ────────────────────────
  describe.each(SUPPORTED_VIEWPORTS)('at %ipx wide', (viewportWidth) => {
    const cases = reachableExpandedWidths(viewportWidth).flatMap((expandedWidth) =>
      dockStates(expandedWidth).map((state) => ({ expandedWidth, ...state })),
    )

    it.each(cases)('clears the dock $label', ({ expandedWidth, dockWidth }) => {
      const overlap = triggerDockHorizontalOverlapPx({
        triggerWidth: OBSERVED_TRIGGER_WIDTH,
        // Read off the rendered component, not off this file's arithmetic.
        triggerRightOffset: resolveRenderedRightOffsetPx(expandedWidth),
        dockWidth,
      })
      expect(overlap).toBe(0)
    })
  })

  it('the clearance does not depend on the trigger’s width — it extends away from the dock', () => {
    // A longer label (localisation, a count badge) must not reintroduce the
    // overlap. This is why the rule is stated as an offset and not as a
    // measured gap.
    for (const triggerWidth of [95, 160, 400, 900]) {
      expect(
        triggerDockHorizontalOverlapPx({
          triggerWidth,
          triggerRightOffset: resolveRenderedRightOffsetPx(DOCK_MIN_WIDTH),
          dockWidth: DOCK_MIN_WIDTH,
        }),
      ).toBe(0)
    }
  })

  it('the numeric and CSS forms of the offset agree — one rule, two spellings', () => {
    // The component renders the CSS form; the arithmetic above uses the
    // numeric one. If they ever diverge, every clearance number in this file
    // would be about a position the product does not render.
    for (const expandedWidth of [DOCK_MIN_WIDTH, 333, 416, 480]) {
      expect(resolveRenderedRightOffsetPx(expandedWidth)).toBe(
        versionsTriggerRightOffsetPx(expandedWidth),
      )
    }
  })

  // ── The positive control (trap 13): prove the metric can SEE an overlap ────
  // Without this, `toBe(0)` above is satisfied by a calculator that returns 0
  // for everything, and the whole file would be vacuous.
  it('POSITIVE CONTROL: the shipped defect’s offset is measured as a large overlap, not as zero', () => {
    const shippedOffset = 12 // `right-3`, the offset that shipped in #720
    const overlap = triggerDockHorizontalOverlapPx({
      triggerWidth: OBSERVED_TRIGGER_WIDTH,
      triggerRightOffset: shippedOffset,
      dockWidth: DOCK_RAIL_WIDTH_PX,
    })
    // The rail spans [12, 52] from the right edge; the shipped trigger spanned
    // [12, 107]. The trigger swallowed the rail WHOLE — all 40px of it — which
    // is why `elementFromPoint` at the expand control's own centre returned
    // the trigger on the deployed build.
    expect(overlap).toBe(DOCK_RAIL_WIDTH_PX)
    expect(overlap).toBeGreaterThan(0)
  })

  it('POSITIVE CONTROL: the shipped offset also overlaps the EXPANDED dock at every supported viewport', () => {
    for (const viewportWidth of SUPPORTED_VIEWPORTS) {
      const overlap = triggerDockHorizontalOverlapPx({
        triggerWidth: OBSERVED_TRIGGER_WIDTH,
        triggerRightOffset: 12,
        dockWidth: responsiveDockWidth(viewportWidth),
      })
      expect(overlap).toBe(OBSERVED_TRIGGER_WIDTH)
    }
  })
})
