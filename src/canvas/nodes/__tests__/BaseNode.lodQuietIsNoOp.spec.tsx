/**
 * THE NO-OP PROOF — `quiet` renders a card byte-identically to `full`.
 *
 * ⭐ WHY THIS FILE IS THE POINT OF THE PR, NOT AN EXTRA.
 *
 * This change replaces a two-state boolean (`lodActive`) with a three-rung enum
 * (`full` / `quiet` / `line`). A refactor like that is exactly where behaviour
 * moves by accident: every current consumer of `lodActive` had to be re-pointed
 * by hand, and any one of them re-pointed to the WRONG rung would change what a
 * user sees between 0.5 and 0.714 — a band the whole-model gesture passes
 * through on the way back up. The PR's claim is that it is INVISIBLE at rest.
 * A claim like that is worthless as an intention and cheap as a measurement, so
 * it is measured here.
 *
 * WHAT "BYTE-IDENTICAL" MEANS AND WHAT IT DOES NOT. jsdom has no layout
 * (CLAUDE.md trap 3), so this cannot and does not claim two renders LOOK the
 * same. It compares the rendered DOM: the card's entire rendered markup at
 * `quiet` against the same card at `full`. That catches a changed class, a
 * dropped element, an added attribute, a `visibility: hidden` that should not be
 * there, a testid that appears or vanishes — i.e. every way this refactor could
 * plausibly leak — and it compares the whole tree rather than one predicate that
 * some other element could satisfy.
 *
 * ⚠ THE CONTROL THAT KEEPS IT FROM BEING A TAUTOLOGY. Two renders of the same
 * component with the same props are equal for a trivial reason if the rung is
 * not reaching the component at all — a store double missing the slice, a
 * selector reading a field nobody writes, a mock drifting out from under this
 * file, and the comparison passes forever while proving nothing (trap 13: an
 * absence probe needs to be shown able to see a presence). So every equality
 * assertion below is PAIRED with the `line` render, which MUST differ. If the
 * rung is not being read, the pair fails on the second half — loudly, and for
 * the right reason.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { FactorNode } from '../FactorNode'
import { OptionNode } from '../OptionNode'
import { useCanvasStore } from '../../store'
import type { LodRung } from '../../utils/zoomLegibility'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

const makeStoreState = (overrides: Record<string, unknown> = {}) => ({
  hoveredOptionId: null,
  nodes: [],
  edges: [],
  ceeAnalysisReady: null,
  results: { status: 'idle', report: null },
  highlightedNodes: new Set(),
  dimmedNodeIds: new Set(),
  editedSinceRunNodeIds: new Set(),
  analysisHighlight: { source: null, edgeIds: new Set(), nodeIds: new Set() },
  lens: { _dimmedNodeIds: new Set(), _hiddenNodeIds: new Set(), active: 'full' },
  goalThreshold: null,
  goalConstraints: [],
  viewMode: 'standard',
  lodRung: 'full' as LodRung,
  ...overrides,
})

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector) => selector(makeStoreState())),
}))

const setRung = (lodRung: LodRung) => {
  vi.mocked(useCanvasStore).mockImplementation((selector) =>
    (selector as (s: unknown) => unknown)(makeStoreState({ lodRung }) as never),
  )
}

const baseProps = {
  type: 'factor',
  position: { x: 0, y: 0 },
  selected: false,
  isConnectable: true,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  dragging: false,
  zIndex: 0,
  deletable: true,
  selectable: true,
  draggable: true,
  width: 240,
  height: 100,
  sourcePosition: undefined,
  targetPosition: undefined,
}

/**
 * The card's rendered DOM at one rung.
 *
 * ⛔ THE POSITIVE CONTROL IS INSIDE THIS HELPER, DELIBERATELY. `BaseNode` puts
 * a testid on its ROOT only when the card is incomplete, so there is no stable
 * root id to bind to; the comparison is therefore over the whole rendered tree,
 * which is strictly stronger than any single element. What that loses is the
 * identity binding — an empty render compares equal to another empty render —
 * so `node-title` is asserted present FIRST, by testid, on every single call.
 * `getByTestId` throws when it is not, so a card that failed to mount can never
 * reach the comparison (CLAUDE.md trap 13).
 */
const cardHtmlAt = (rung: LodRung, node: React.ReactElement): string => {
  setRung(rung)
  const { container, unmount } = render(<ReactFlowProvider>{node}</ReactFlowProvider>)
  expect(screen.getByTestId('node-title'), 'the card did not mount').toBeTruthy()
  // `data-rung-padding` DECLARES both rungs' boxes for the layout measurer
  // (per-rung reservation, #1932 edeb32b3): it names the Normal band at every
  // rung by design. What this file pins is the box the card RENDERS, so the
  // declaration is dropped before comparing.
  const html = container.innerHTML.replace(/ data-rung-padding="[^"]*"/g, '')
  unmount()
  return html
}

const FACTOR_DATA = {
  label: 'Cash Runway',
  type: 'factor',
  category: 'external',
  observedState: { raw_value: 0.62, unit: null },
}

const OPTION_DATA = { label: 'Expand to EU', type: 'option' }

describe('the `quiet` rung spends only the rail (S5) — the card still says exactly what `full` says', () => {
  beforeEach(() => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      (selector as (s: unknown) => unknown)(makeStoreState() as never),
    )
  })

  /**
   * ⭐ S5 (24 Sep 2026) SPENDS `quiet` — ON PURPOSE, AND ON ONE THING ONLY: THE
   * QUICK-ACTION BAND.
   *
   * This file pinned "quiet renders byte-identically to full" for the refactor
   * that CREATED the rung. The contract has since given the rung a job (v3.1:
   * "Far zoom: readable identity and a simple attention cue"; pt 6: the
   * coaching icon hides at quiet, and the HOVER row is the landing-rung ask
   * door). S5 measured the band reserved under every repeated card as the
   * largest term in the graph's height at the landing zoom, so at `quiet` the
   * card reserves no band and the hover row is drawn BELOW the card. NOTHING
   * ELSE may change: the same text, the same testids (the rail included — it is
   * moved, not removed).
   */
  const railPlacement = (html: string) => /data-rail-placement="([a-z]+)"/.exec(html)?.[1] ?? null
  // jsdom serialises the card's padding as the shorthand; the band is the only
  // bottom padding written as `calc(6px + 27px * var(--canvas-label-scale…`.
  // ⛔ UPDATED 25 Sep 2026 (gap 34): 22 → 27, because the DESIGN moved the rail
  // box to the contract's 25px (`.icon-btn{width:25px}`) and the band is derived
  // from it (6 + (25 + 2) × scale). Same element, same claim.
  const BAND = /calc\(6px \+ 27px \* var\(--canvas-label-scale/
  const textOf = (html: string) => { const d = document.createElement('div'); d.innerHTML = html; return d.textContent }
  const testIdsOf = (html: string) => (html.match(/data-testid="[^"]*"/g) ?? []).sort()

  it.each([
    ['factor', () => <FactorNode {...baseProps} id="factor-1" data={FACTOR_DATA} />],
    // A second type, because `lodFacts` is computed for OPTIONS ONLY and takes
    // its own early-return off the rung. A factor render cannot exercise that
    // branch, so a mis-pointed rung there would be invisible.
    ['option', () => <OptionNode {...baseProps} type="option" id="option-1" data={OPTION_DATA} />],
  ] as const)('%s: quiet moves the rail BELOW and drops its band — same text, same testids; line differs (the control)', (_kind, make) => {
    const full = cardHtmlAt('full', make())
    const quiet = cardHtmlAt('quiet', make())
    const line = cardHtmlAt('line', make())

    expect(railPlacement(full), 'POSITIVE CONTROL: at full the rail is inside the card').toBe('inset')
    expect(full, 'POSITIVE CONTROL: at full the card reserves the band').toMatch(BAND)
    expect(railPlacement(quiet), 'at quiet the hover row must still exist — drawn below the card').toBe('below')
    expect(quiet, 'at quiet the card still reserves the quick-action band').not.toMatch(BAND)
    expect(textOf(quiet), 'quiet changed the card TEXT').toBe(textOf(full))
    expect(testIdsOf(quiet), 'quiet dropped or added an element').toEqual(testIdsOf(full))

    // ⛔ THE CONTROL. Without this, the assertions above pass whenever the rung
    // is not reaching the component at all.
    expect(
      line,
      'the `line` rung rendered identically to `full` — the rung is not reaching BaseNode, so the comparisons above prove nothing',
    ).not.toBe(full)
  })

  it('the body is NOT hidden at quiet, and IS at line — stated as the property, not inferred from the HTML diff', () => {
    // The equality assertions above would also hold if BOTH `quiet` and `full`
    // hid the body. This names the specific attribute that decides it, so the
    // direction of the no-op is pinned and not merely its symmetry.
    const node = <FactorNode {...baseProps} id="factor-1" data={FACTOR_DATA} />

    expect(cardHtmlAt('full', node)).not.toContain('data-lod-hidden')
    expect(cardHtmlAt('quiet', node)).not.toContain('data-lod-hidden')
    expect(cardHtmlAt('line', node)).toContain('data-lod-hidden')
  })

  it('a store double with NO rung renders as `full` — the undefined-safe default', () => {
    // ~ten spec store doubles across this repo set the level-of-detail slice by
    // hand. A double that omits it must get an ordinary card, never a blanked
    // one, or this refactor breaks unrelated suites in the least obvious way.
    const node = <FactorNode {...baseProps} id="factor-1" data={FACTOR_DATA} />
    const full = cardHtmlAt('full', node)

    vi.mocked(useCanvasStore).mockImplementation((selector) => {
      const state = makeStoreState() as Record<string, unknown>
      delete state.lodRung
      return (selector as (s: unknown) => unknown)(state as never)
    })
    const { container, unmount } = render(
      <ReactFlowProvider>
        <FactorNode {...baseProps} id="factor-1" data={FACTOR_DATA} />
      </ReactFlowProvider>,
    )
    expect(screen.getByTestId('node-title'), 'the card did not mount').toBeTruthy()
    const withoutSlice = container.innerHTML.replace(/ data-rung-padding="[^"]*"/g, "")
    unmount()

    expect(withoutSlice, 'a store double without the rung slice did not render an ordinary card').toBe(
      full,
    )
  })
})
