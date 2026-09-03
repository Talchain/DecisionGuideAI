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
  const html = container.innerHTML
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

describe('the `quiet` rung is created, not spent — a card renders identically to `full`', () => {
  beforeEach(() => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      (selector as (s: unknown) => unknown)(makeStoreState() as never),
    )
  })

  it('factor: quiet === full, and line differs (the control)', () => {
    const node = <FactorNode {...baseProps} id="factor-1" data={FACTOR_DATA} />

    const full = cardHtmlAt('full', node)
    const quiet = cardHtmlAt('quiet', node)
    const line = cardHtmlAt('line', node)

    expect(
      quiet,
      'the `quiet` rung changed what a factor card renders — this PR creates the rung and must not spend it',
    ).toBe(full)

    // ⛔ THE CONTROL. Without this, the assertion above passes whenever the rung
    // is not reaching the component at all.
    expect(
      line,
      'the `line` rung rendered identically to `full` — the rung is not reaching BaseNode, so the equality above proves nothing',
    ).not.toBe(full)
  })

  it('option: quiet === full, and line differs (the control)', () => {
    // A second type, because `lodFacts` is computed for OPTIONS ONLY and takes
    // its own early-return off the rung. A factor render cannot exercise that
    // branch, so a mis-pointed rung there would be invisible above.
    const node = <OptionNode {...baseProps} type="option" id="option-1" data={OPTION_DATA} />

    const full = cardHtmlAt('full', node)
    const quiet = cardHtmlAt('quiet', node)
    const line = cardHtmlAt('line', node)

    expect(quiet, 'the `quiet` rung changed what an option card renders').toBe(full)
    expect(
      line,
      'the `line` rung rendered identically to `full` on an option — the rung is not reaching the option branch',
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
    const withoutSlice = container.innerHTML
    unmount()

    expect(withoutSlice, 'a store double without the rung slice did not render an ordinary card').toBe(
      full,
    )
  })
})
