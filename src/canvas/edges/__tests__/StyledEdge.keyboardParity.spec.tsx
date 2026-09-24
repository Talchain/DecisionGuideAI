/**
 * EDGE KEYBOARD PARITY — the edge popover had no keyboard path at all.
 *
 * ── THE MEASUREMENT ─────────────────────────────────────────────────────────
 *
 * `StyledEdge.tsx` is ~2,250 lines and carries the ENTIRE edge hover surface:
 * direction, confidence, strength, provenance, fragility, and the two coaching
 * chips that dispatch turns to CEE. Swept at staging `99b46212`, target and
 * contrast in the SAME sweep of the SAME file (CLAUDE.md trap 13e — a target
 * reading zero is equally consistent with a correct product and a blind probe):
 *
 *     grep -acE 'onFocus|onBlur|tabIndex|onKeyDown|focus-visible'  ->  0   (target)
 *     grep -acE 'onMouseEnter|onMouseLeave'                        ->  6   (contrast)
 *
 * Six mouse bindings, zero keyboard bindings. The popover was mouse-only.
 *
 * ── THE ANCHOR IS THE LIBRARY'S, NOT ONE WE INVENTED ────────────────────────
 *
 * Derived at the bytes of the INSTALLED library, `@xyflow/react@12.10.2`
 * (`dist/esm/index.mjs`, `EdgeWrapper`, :2811 and :2907-2911):
 *
 *     const isFocusable = !!(edge.focusable || (edgesFocusable && typeof edge.focusable === 'undefined'))
 *     ...
 *     tabIndex: isFocusable ? 0 : undefined,
 *     role: edge.ariaRole ?? (isFocusable ? 'group' : 'img'),
 *
 * and `edgesFocusable: true` sits in the store defaults (:142494) beside
 * `nodesFocusable: true`. `ReactFlowGraph.tsx` passes neither `edgesFocusable`
 * nor `disableKeyboardA11y` (swept: zero hits in that file), so the default
 * governs.
 *
 * **So every edge is ALREADY a tab stop.** React Flow already renders
 * `<g class="react-flow__edge" tabIndex={0} role="group">` around each edge.
 * What was missing is that `StyledEdge` did nothing when that focus arrived —
 * exactly the node situation before #1702, and the reason the node fix binds
 * `focusin` to `.react-flow__node` (`usePopoverHover.ts:176-223`) rather than
 * to its own wrapper: `focusin` bubbles UP, so a listener on a DESCENDANT can
 * never see its ANCESTOR take focus.
 *
 * The fixture below therefore reproduces React Flow's own wrapper rather than
 * inventing an anchor, and PINS ITS OWN PRECONDITION in-test (trap 13b): every
 * focus case asserts `document.activeElement` is that element first, so a
 * "popover opened" result cannot be vacuous about focus never having landed.
 *
 * ── WHAT jsdom CAN AND CANNOT SHOW HERE (trap 3) ────────────────────────────
 *
 * ⚠ **jsdom CANNOT prove visibility.** Nothing below asserts the popover is
 * painted, on-screen, unclipped, or above its neighbours. Every assertion is
 * about PRESENCE IN THE DOM and about which element owns focus. A popover that
 * mounts behind the canvas, at zero opacity, or outside the viewport would pass
 * every test in this file. That claim needs a real browser.
 *
 * ⚠ Nor can it prove the TAB ORDER a user experiences. The popover is portalled
 * out of the edge's `<g>` by `EdgeLabelRenderer`, so whether Tab reaches the
 * coaching chips next is a document-order question this harness does not model.
 *
 * ⚠ **`:focus-visible` IS SUPPORTED BY THIS jsdom AND RETURNS TRUE.** Probed
 * directly at jsdom 24.1.3 (the installed version): an SVG `<g>` mixes in
 * `HTMLOrSVGElement` (`SVGElement-impl.js:62`), so `.focus()` works, `focusin`
 * fires with `target` set to the `<g>`, and `g.matches(':focus-visible')`
 * returns `true` after a PROGRAMMATIC focus — it does NOT throw. That matters
 * twice. First, the fail-open `catch` in the product is therefore DEAD CODE
 * under this jsdom, so a test that merely focuses proves nothing about the
 * guard's direction. Second, jsdom cannot distinguish keyboard focus from mouse
 * focus at all. Both branches are therefore driven EXPLICITLY, by stubbing
 * `matches`, which is the only way to pin that the predicate is consulted at
 * all rather than ignored.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, act, cleanup } from '@testing-library/react'
import { createPortal } from 'react-dom'
import { StyledEdge } from '../StyledEdge'
import { Position } from '@xyflow/react'

// ── ReactFlow mocks ──────────────────────────────────────────────────────────
vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return {
    ...actual,
    BaseEdge: () => <path data-testid="base-edge" />,
    /**
     * ⭐ PORTALLED, NOT INLINED — and that is the faithful shape, not a
     * convenience. React Flow's real `EdgeLabelRenderer` portals into
     * `.react-flow__edgelabel-renderer`, a sibling of the edge `<svg>`
     * (`dist/esm/index.mjs:3630`). So in production the popover is NOT a DOM
     * descendant of the edge's `<g>`, which is precisely why closing on
     * focus-out needs a cross-portal test and cannot use `contains()` alone.
     * An inlined mock would have hidden the whole problem.
     */
    EdgeLabelRenderer: ({ children }: { children: React.ReactNode }) =>
      createPortal(children, document.body),
    getBezierPath: () => ['M0 0 L100 100', 50, 50],
    getSmoothStepPath: () => ['M0 0 L100 100', 50, 50],
    getStraightPath: () => ['M0 0 L100 100', 50, 50],
    useReactFlow: () => ({ getNode: () => null, getEdges: () => [], getNodes: () => [] }),
    useStore: (selector: (s: unknown) => unknown) => selector({ nodes: [] }),
  }
})

// ── Store mocks (same shape as StyledEdge.hover.spec.tsx) ────────────────────
vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector: (s: unknown) => unknown) =>
    selector({
      updateEdgeData: vi.fn(),
      runMeta: { ceeReview: null },
      results: { status: 'idle', report: null },
      hoveredOptionId: null,
      highlightedEdges: new Set<string>(),
      dimmedEdgeIds: new Set<string>(),
      lens: {
        active: 'full',
        _dimmedEdgeIds: new Set<string>(),
        _sensitivityWeights: new Map<string, number>(),
        _sensitivityQuartiles: null,
        _fragileEdgeIds: new Set<string>(),
        _lensFragileLabels: new Map<string, string>(),
      },
    }),
  ),
}))

vi.mock('../../store/edgeLabelMode', () => ({
  useEdgeLabelMode: vi.fn((selector: (s: unknown) => unknown) => selector({ mode: 'human' })),
}))
vi.mock('../../hooks/useTheme', () => ({ useIsDark: () => false }))
vi.mock('../../hooks/useFirstTimeHints', () => ({
  useEdgeEditHint: () => ({ showHint: false, dismissHint: vi.fn() }),
}))
vi.mock('../../hooks/usePrefersReducedMotion', () => ({ usePrefersReducedMotion: () => false }))
vi.mock('../../../flags', () => ({ isGraphLensEnabled: () => false }))
vi.mock('../../utils/fragileEdgeMatch', () => ({
  isEdgeFragile: () => false,
  getFragileEdgeSwitchProbability: () => null,
}))
vi.mock('../../utils/graphDisplayCalculations', async (importOriginal) => ({
  // importOriginal-SPREAD, never a hand-listed replacement (CLAUDE.md trap 12).
  ...(await importOriginal<typeof import('../../utils/graphDisplayCalculations')>()),
  calculateEdgeImportance: () => 0.5,
  importanceToStrokeWidth: () => 2,
  weightMagnitudeToStrokeWidth: () => 2,
}))
vi.mock('../../theme/edges', () => ({
  applyEdgeVisualProps: (_: unknown, props: unknown) => props,
}))
vi.mock('../../ui/inspector-v2/inspectorStrings', () => ({
  getStrengthDescription: () => 'moderate',
  getProvenanceLabel: () => '',
}))

// ── Fixture ──────────────────────────────────────────────────────────────────

/** A fully characterised edge, so the popover has real content to carry. */
const characterisedEdge = {
  id: 'e1',
  source: 'n1',
  target: 'n2',
  sourceX: 0,
  sourceY: 0,
  targetX: 100,
  targetY: 100,
  sourcePosition: Position.Right,
  targetPosition: Position.Left,
  selected: false,
  data: {
    weight: 0.3,
    direction: 'positive' as const,
    beliefExists: 0.8,
    weightSource: 'user' as const,
    beliefExistsSource: 'user' as const,
    directionSource: 'user' as const,
  },
}

const SVG_NS = 'http://www.w3.org/2000/svg'
const HARNESS_ATTR = 'data-rf-edge-harness'
/**
 * A SECOND edge's id, never the edge under test. The identity case below needs
 * an owner that is real, distinct, and not `characterisedEdge.id`.
 */
const FOREIGN_EDGE_ID = 'e2-another-edge'

/**
 * Reproduces React Flow's own per-edge wrapper — the `<svg>`, the `<g>`, its
 * class, its `tabIndex` and its `role` all taken from `EdgeWrapper`'s render at
 * `@xyflow/react@12.10.2` `dist/esm/index.mjs:2907-2911`, not invented here.
 *
 * ⚠ BUILT AS REAL DOM AND HANDED TO RTL AS ITS CONTAINER, RATHER THAN RENDERED
 * AS JSX. React must not own the `<svg>`: when it did, mounting the portalled
 * popover mid-commit made React remove a node from a parent it no longer
 * belonged to (`NotFoundError: The node to be removed is not a child of this
 * node`), and EVERY case in this file failed — including the contrast controls,
 * which is the only reason it was caught rather than read as a product result.
 * `createElementNS` also guarantees the real SVG namespace, so `.focus()` and
 * `tabIndex` behave as they do in a browser rather than on an unknown element.
 */
function renderEdgeInReactFlowWrapper(props: Record<string, unknown> = {}) {
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute(HARNESS_ATTR, '')
  const rfEdge = document.createElementNS(SVG_NS, 'g') as SVGGElement
  rfEdge.setAttribute('class', 'react-flow__edge react-flow__edge-styled')
  rfEdge.setAttribute('tabindex', '0')
  rfEdge.setAttribute('role', 'group')
  svg.appendChild(rfEdge)
  document.body.appendChild(svg)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = render(<StyledEdge {...({ ...characterisedEdge, ...props } as any)} />, {
    container: rfEdge as unknown as HTMLElement,
  })

  expect(
    rfEdge.closest('.react-flow__edge'),
    'PRECONDITION: the anchor the product looks for must be reachable from the edge',
  ).toBe(rfEdge)
  return { ...result, rfEdge }
}

const popover = () => document.querySelector('[data-testid="edge-hover-popover"]')

/**
 * Drive `:focus-visible` explicitly. See the header: this jsdom SUPPORTS the
 * pseudo-class and answers `true` for a programmatic focus, so without this the
 * "keyboard focus" and "mouse focus" cases would be indistinguishable and the
 * discrimination test would be a tautology.
 */
function stubFocusVisible(answer: boolean | 'throw') {
  const real = Element.prototype.matches
  vi.spyOn(Element.prototype, 'matches').mockImplementation(function (this: Element, selector: string) {
    if (selector === ':focus-visible') {
      if (answer === 'throw') throw new Error('SyntaxError: unsupported pseudo-class')
      return answer
    }
    return real.call(this, selector)
  })
}

/** Focus the wrapper AND assert the focus landed, so no later result is vacuous. */
function focusEdge(rfEdge: SVGGElement) {
  act(() => {
    rfEdge.focus()
  })
  expect(
    document.activeElement,
    'PRECONDITION: focus must actually be on the React Flow edge wrapper',
  ).toBe(rfEdge)
}

describe('StyledEdge — the edge popover can be opened without a mouse', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    // ⚠ ORDER MATTERS AND IS NOT INCIDENTAL. React must unmount its trees
    // BEFORE the harness DOM is removed from under it; wiping `document.body`
    // first is what produced the commit-phase `NotFoundError` above.
    cleanup()
    document.querySelectorAll(`[${HARNESS_ATTR}]`).forEach((n) => n.remove())
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  /**
   * ⭐ CONTRAST CONTROL, FIRST. Every assertion below is of the form "the
   * popover appeared". If the harness could not produce a popover AT ALL — a
   * broken mock, a store key the component now reads, a portal that went
   * nowhere — the RED cases would fail for a reason that has nothing to do with
   * keyboard access, and the GREEN ones would be measuring the fix against a
   * dead fixture. This is the case that has to pass at pristine.
   */
  it('CONTRAST: the MOUSE path still opens the popover in this harness', () => {
    const { container } = renderEdgeInReactFlowWrapper()
    const hitPath = container.querySelector('path[stroke="transparent"]')
    expect(hitPath).not.toBeNull()
    act(() => {
      fireEvent.mouseEnter(hitPath!)
      vi.advanceTimersByTime(400)
    })
    expect(popover(), 'the mouse path is the control — if THIS fails the harness is blind').not.toBeNull()
  })

  /**
   * ⭐⭐ THE DEFECT. RED at staging `99b46212`: focus lands on the wrapper (the
   * precondition above proves that) and nothing happens, because `StyledEdge`
   * binds no focus listener anywhere.
   */
  it('opens the popover when the edge takes KEYBOARD focus', () => {
    stubFocusVisible(true)
    const { rfEdge } = renderEdgeInReactFlowWrapper()
    expect(popover(), 'PRECONDITION: nothing is open before focus').toBeNull()

    focusEdge(rfEdge)

    expect(popover(), 'a keyboard user must reach the same content a mouse user gets').not.toBeNull()
  })

  /**
   * ⭐⭐ NO DELAY ON THE KEYBOARD PATH, and this is asserted rather than
   * inherited. The 300ms enter delay models a POINTER PASSING OVER an edge on
   * its way somewhere else. A Tab is never accidental in that way, so making a
   * keyboard user wait is latency bought for no benefit — the same reasoning
   * `usePopoverHover.ts:171-174` records for nodes.
   *
   * The timers are never advanced in this case. If the implementation reused
   * the 300ms `setTimeout`, this fails while the case above still passes — so
   * the two are not redundant.
   */
  it('opens it with NO delay — before any timer is advanced', () => {
    stubFocusVisible(true)
    const { rfEdge } = renderEdgeInReactFlowWrapper()
    focusEdge(rfEdge)
    expect(popover(), 'a deliberate Tab must not be made to wait 300ms').not.toBeNull()
  })

  /**
   * ⭐⭐ THE DISCRIMINATION, and the case that stops the one above from being
   * satisfied by "open on ANY focus". A mouse click focuses the edge too
   * (React Flow's `onEdgeClick` runs on the same element), and opening on every
   * click would bypass the hover intent the 300ms delay exists to provide.
   *
   * Without this case, deleting the `:focus-visible` check entirely would leave
   * the suite green — a guard agreeing with itself (trap 13b).
   */
  it('does NOT open on a focus that is not a KEYBOARD focus', () => {
    stubFocusVisible(false)
    const { rfEdge } = renderEdgeInReactFlowWrapper()
    focusEdge(rfEdge)
    expect(popover(), ':focus-visible must actually be consulted, not ignored').toBeNull()
  })

  /**
   * ⭐ THE FALLBACK DIRECTION, pinned. A DOM implementation that does not know
   * `:focus-visible` throws rather than answering false. Failing toward MORE
   * recovery is deliberate: a popover that opens when it need not is a
   * nuisance; one that will not open is the defect this change closes.
   *
   * This is the ONLY case that exercises the `catch`, because this jsdom
   * supports the pseudo-class (see the header) and would otherwise never
   * reach it.
   */
  it('fails TOWARD opening when :focus-visible is unsupported', () => {
    stubFocusVisible('throw')
    const { rfEdge } = renderEdgeInReactFlowWrapper()
    focusEdge(rfEdge)
    expect(popover(), 'an unknown pseudo-class must not cost a keyboard user the content').not.toBeNull()
  })

  /**
   * ⭐⭐ DISMISSIBLE — WCAG 2.1 AA 1.4.13 names three obligations for content
   * shown on hover or focus (dismissible, hoverable, persistent). The mouse
   * path already satisfies HOVERABLE (`handlePopoverEnter` cancels the close).
   * DISMISSIBLE requires a way to remove the content WITHOUT moving focus, and
   * before this change the edge popover had none in any modality: there was no
   * key handler on this component at all.
   */
  it('Escape dismisses the focus-opened popover without moving focus', () => {
    stubFocusVisible(true)
    const { rfEdge } = renderEdgeInReactFlowWrapper()
    focusEdge(rfEdge)
    expect(popover(), 'PRECONDITION: it must be open before Escape can dismiss it').not.toBeNull()

    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' })
    })

    expect(popover(), 'Escape must close it').toBeNull()
    expect(document.activeElement, 'and must NOT move focus away from the edge').toBe(rfEdge)
  })

  /**
   * The other half of the focus path. Without this, focus could leave the edge
   * entirely and the popover would stay on screen forever.
   */
  it('closes when focus leaves the edge for something unrelated', () => {
    stubFocusVisible(true)
    const { rfEdge } = renderEdgeInReactFlowWrapper()
    focusEdge(rfEdge)
    expect(popover()).not.toBeNull()

    const elsewhere = document.createElement('button')
    document.body.appendChild(elsewhere)
    act(() => {
      fireEvent.focusOut(rfEdge, { relatedTarget: elsewhere })
    })

    expect(popover(), 'focus moved off the edge — the popover must go with it').toBeNull()
  })

  /**
   * ⭐⭐ THE CROSS-PORTAL CASE, and the reason `contains()` alone is wrong.
   * `EdgeLabelRenderer` portals the popover OUT of the edge's `<g>`
   * (`dist/esm/index.mjs:3630`), so the popover is not a DOM descendant of the
   * element losing focus. A close rule written as `rfEdge.contains(next)` would
   * shut the popover the instant a keyboard user tabbed into the very content
   * it was opened to show — including the two coaching chips, which are the
   * only actionable controls on this surface.
   *
   * Bound by the popover's own identity attribute, never by "some element
   * somewhere" (trap 19).
   */
  it('stays open when focus moves INTO the portalled popover', () => {
    stubFocusVisible(true)
    const { rfEdge } = renderEdgeInReactFlowWrapper()
    focusEdge(rfEdge)
    const open = popover()
    expect(open, 'PRECONDITION: open before focus moves into it').not.toBeNull()

    const chip = open!.querySelector('button')
    expect(chip, 'PRECONDITION: the popover really does carry a focusable chip').not.toBeNull()
    expect(
      rfEdge.contains(chip!),
      'PRECONDITION: the chip must be OUTSIDE the edge group, or this case proves nothing',
    ).toBe(false)

    act(() => {
      fireEvent.focusOut(rfEdge, { relatedTarget: chip })
    })

    expect(popover(), 'tabbing into the popover must not destroy it').not.toBeNull()
  })

  /**
   * ⭐⭐⭐ THE EXIT STEP — the move the case above stops one short of, and the
   * finding an independent review returned CHANGES_REQUIRED for at
   * `c1f3649e`. Reproduced at that head before this test was written.
   *
   * `focusout` was bound to `.react-flow__edge` ONLY. The popover is portalled
   * to a sibling subtree, so when focus is inside the popover and the user tabs
   * onward, `focusout` is emitted from the PORTAL — it never reaches the edge
   * group, and the edge's listener is never called. Nothing closed the popover
   * or the highlight, so stale edge context stayed on screen as the user moved
   * on. The entry case above cannot see this: it ends at entry.
   *
   * ⚠ WHY REAL `.focus()` CALLS AND NOT `fireEvent.focusOut` HERE. The cases
   * above dispatch focusout synthetically at a chosen element, which is exactly
   * what hid this defect — a synthetic dispatch AT THE EDGE tests the edge's
   * listener whether or not the real event would have gone there. Driving real
   * focus makes the DOM choose the emitting element, so the routing itself is
   * under test rather than assumed.
   *
   * ⚠ STEP 2 IS ALSO THE `relatedTarget` CONTROL. If this jsdom did not supply
   * `relatedTarget` on a real focus move, the guard would see `null`, the
   * popover would close on entry, and step 2 would fail — so step 2 passing is
   * what makes step 3's result meaningful rather than an artefact.
   *
   * ⚠ jsdom proves NOTHING about visibility or about the tab order a user
   * experiences (see the header). Every assertion here is about presence in the
   * DOM and about which element owns focus.
   */
  it('closes when focus leaves the portalled POPOVER for something unrelated', () => {
    stubFocusVisible(true)
    const { rfEdge } = renderEdgeInReactFlowWrapper()

    const elsewhere = document.createElement('button')
    elsewhere.setAttribute(HARNESS_ATTR, '')
    document.body.appendChild(elsewhere)

    // ── STEP 1 · POSITIVE CONTROL: departure straight from the edge ──────────
    // This already worked at `c1f3649e`. It has to pass BEFORE the fix, or the
    // fixture is wrong rather than the product.
    focusEdge(rfEdge)
    expect(popover(), 'PRECONDITION: keyboard focus opened it').not.toBeNull()
    act(() => {
      elsewhere.focus()
    })
    expect(
      popover(),
      'CONTROL 1: focus leaving the EDGE for something unrelated already closes it',
    ).toBeNull()

    // ── STEP 2 · REQUIRED CONTROL: entering our own popover keeps it open ────
    focusEdge(rfEdge)
    const open = popover()
    expect(open, 'PRECONDITION: re-focusing the edge re-opens it').not.toBeNull()
    const chip = open!.querySelector('button')
    expect(chip, 'PRECONDITION: the popover really does carry a focusable chip').not.toBeNull()
    expect(
      rfEdge.contains(chip!),
      'PRECONDITION: the chip is OUTSIDE the edge group — the portal is what makes this non-trivial',
    ).toBe(false)
    act(() => {
      chip!.focus()
    })
    expect(
      document.activeElement,
      'PRECONDITION: focus must really be inside the popover now',
    ).toBe(chip)
    expect(
      popover(),
      'CONTROL 2: tabbing INTO our own popover must not destroy it',
    ).not.toBeNull()

    // ── STEP 3 · THE DEFECT: departure FROM the popover ──────────────────────
    act(() => {
      elsewhere.focus()
    })
    expect(
      popover(),
      'THE DEFECT: focus left the popover for something unrelated — the popover and its edge context must go with it',
    ).toBeNull()
  })

  /**
   * ⭐⭐⭐ THE IDENTITY DISCRIMINATION — CLAUDE.md trap 19: an assertion or a
   * guard must bind to its object by IDENTITY, never by a value predicate
   * another object could satisfy.
   *
   * At `c1f3649e` the exception was `next.closest('[data-edge-popover]')` — a
   * predicate EVERY edge's popover satisfies. With two edges on the canvas,
   * edge A's handler read edge B's popover as "inside mine" and held A's
   * popover open while focus was demonstrably elsewhere. That is a second,
   * independent leak of the same stale-context harm, and the exit case above
   * cannot see it: its `elsewhere` is a bare button that matches no selector.
   *
   * The fixture PINS ITS OWN PRECONDITION (trap 13b): it asserts that the
   * blanket selector DOES match the foreign popover, so this case cannot pass
   * except by consulting identity. Without that assertion a fixture that had
   * quietly stopped carrying the attribute would pass while proving nothing.
   */
  it('does NOT treat ANOTHER edge’s popover as its own', () => {
    stubFocusVisible(true)
    const { rfEdge } = renderEdgeInReactFlowWrapper()

    // A second edge's popover: same attribute NAME, different OWNER.
    const foreign = document.createElement('div')
    foreign.setAttribute(HARNESS_ATTR, '')
    foreign.setAttribute('data-edge-popover', FOREIGN_EDGE_ID)
    const foreignChip = document.createElement('button')
    foreign.appendChild(foreignChip)
    document.body.appendChild(foreign)

    focusEdge(rfEdge)
    const open = popover()
    expect(open, 'PRECONDITION: our own popover is open').not.toBeNull()

    expect(
      foreignChip.closest('[data-edge-popover]'),
      'PRECONDITION: the BLANKET selector matches the foreign popover — otherwise identity is never tested',
    ).toBe(foreign)
    expect(foreign, 'PRECONDITION: the foreign popover is not ours').not.toBe(open)
    expect(
      open!.getAttribute('data-edge-popover'),
      'PRECONDITION: our popover must not be stamped with the foreign edge’s id',
    ).not.toBe(FOREIGN_EDGE_ID)

    act(() => {
      foreignChip.focus()
    })

    expect(
      popover(),
      'IDENTITY: another edge’s popover is not this edge’s popover — ours must close',
    ).toBeNull()
  })

  /**
   * Parity means matching the mouse path's OWN exclusions too, not exceeding
   * them. Structural edges (decision→option, option→factor) deliberately have
   * no causal popover — they carry a native `<title>` on the hitbox instead —
   * and `handleMouseEnter` returns early for them. The focus path must make the
   * same exclusion, or keyboard users would be shown a surface mouse users
   * never see.
   */
  it('does NOT open a causal popover on a structural edge', () => {
    stubFocusVisible(true)
    const { rfEdge } = renderEdgeInReactFlowWrapper({
      data: { ...characterisedEdge.data, edge_type: 'structural' },
    })
    focusEdge(rfEdge)
    expect(popover(), 'structural edges have no causal popover in ANY modality').toBeNull()
  })
})

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * THE TAP QUESTION — DEMONSTRATED, NOT ASSERTED
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The brief for this work said the popover is unreachable "by keyboard and by
 * touch", and proposed porting the node fix's tap path (`nodeHandlers.onClick`,
 * which toggles the preview when `(hover: none)` matches).
 *
 * ⛔ **THAT PATH WOULD BE DEAD ON AN EDGE, AND THIS IS THE CASE THAT SHOWS IT.**
 * An equivalent mutant must be demonstrated rather than asserted (trap 13c),
 * and so must a dead path. Two facts compose:
 *
 *   1. MEASURED BELOW: the popover is gated `showHoverPopover && !selected`
 *      (`StyledEdge.tsx:2059`). A selected edge shows NO popover, however it
 *      was hovered.
 *   2. READ AT THE LIBRARY BYTES: React Flow's `EdgeWrapper.onEdgeClick`
 *      (`@xyflow/react@12.10.2` `dist/esm/index.mjs:2856-2866`) calls
 *      `addSelectedEdges([id])` on every click, and a tap IS a click.
 *
 * So a tap necessarily sets `selected`, and `selected` necessarily suppresses
 * the popover. A tap-toggle would have been code that runs and can never be
 * seen — CLAUDE.md trap 16's inverse, where the path is live and the DATA
 * cannot reach it.
 *
 * ⭐ AND THE TAP IS ALREADY SERVED, BY A RICHER SURFACE. The same click reaches
 * `ReactFlowGraph.tsx:1522 handleEdgeClick`, which calls
 * `setShowFullInspector(true)` and opens `InspectorModal` with this edge's id
 * (`:2992-2999`). A finger gets the full inspector, not a truncated popover.
 * That is why this change ships a keyboard path and NOT a tap path.
 */
describe('StyledEdge — why the edge tap path is not the node tap path', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    // ⚠ ORDER MATTERS AND IS NOT INCIDENTAL. React must unmount its trees
    // BEFORE the harness DOM is removed from under it; wiping `document.body`
    // first is what produced the commit-phase `NotFoundError` above.
    cleanup()
    document.querySelectorAll(`[${HARNESS_ATTR}]`).forEach((n) => n.remove())
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('a SELECTED edge shows no popover at all — so a tap-toggle could never be seen', () => {
    const { container } = renderEdgeInReactFlowWrapper({ selected: true })
    const hitPath = container.querySelector('path[stroke="transparent"]')
    act(() => {
      fireEvent.mouseEnter(hitPath!)
      vi.advanceTimersByTime(400)
    })
    expect(popover(), 'the !selected gate is what makes a tap-toggle structurally dead').toBeNull()
  })

  it('CONTRAST: the same edge UNSELECTED does show one — so the case above is a gate, not a blind harness', () => {
    const { container } = renderEdgeInReactFlowWrapper({ selected: false })
    const hitPath = container.querySelector('path[stroke="transparent"]')
    act(() => {
      fireEvent.mouseEnter(hitPath!)
      vi.advanceTimersByTime(400)
    })
    expect(popover()).not.toBeNull()
  })
})

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ROW 35 (gap audit `DESIGN-GAP-AUDIT-20260924.md`) — ENTER/SPACE OPENS WHAT
 * A CLICK OPENS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * React Flow's own `onKeyDown` on `.react-flow__edge` already answers
 * Enter/Space (`elementSelectionKeys`, read at the installed
 * `@xyflow/system@0.0.76` bytes) — by calling `addSelectedEdges([id])` alone.
 * It never calls the `onClick` prop that carries this app's real behaviour
 * (`ReactFlowGraph.tsx`'s `handleEdgeClick` → `setShowFullInspector(true)`).
 *
 * This harness cannot reach `ReactFlowGraph.tsx` — `StyledEdge` is rendered in
 * isolation, exactly as every other case in this file does. What it CAN prove,
 * by identity rather than by inference: that pressing Enter/Space on the
 * FOCUSED edge dispatches the SAME `click` event the library's own
 * `onEdgeClick` (bound as a real DOM listener on `.react-flow__edge`, the
 * identical anchor `EdgeWrapper` uses) would consume — so whatever the real
 * click path does, the keyboard path now triggers it too.
 */
describe('StyledEdge — Enter/Space on the focused edge triggers the SAME click event a mouse would', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    cleanup()
    document.querySelectorAll(`[${HARNESS_ATTR}]`).forEach((n) => n.remove())
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  /**
   * `onClick` bound the way `EdgeWrapper` itself binds it: a real DOM
   * listener on `.react-flow__edge`. Standing in for React Flow's own
   * click handling without re-implementing the library.
   */
  function withClickSpy(rfEdge: SVGGElement) {
    const onClick = vi.fn()
    rfEdge.addEventListener('click', onClick)
    return onClick
  }

  it('PIN: Enter on the focused edge fires a click on .react-flow__edge', () => {
    const { rfEdge } = renderEdgeInReactFlowWrapper()
    const onClick = withClickSpy(rfEdge)
    focusEdge(rfEdge)

    act(() => {
      fireEvent.keyDown(rfEdge, { key: 'Enter' })
    })

    expect(onClick, 'Enter must reach the same click React Flow\'s own onClick consumes').toHaveBeenCalledTimes(1)
  })

  it.each(['metaKey', 'ctrlKey', 'altKey', 'shiftKey'] as const)(
    'CONTRAST: a MODIFIED Enter (%s) is left to the canvas shortcuts — no click (review 5823365172 N1)',
    (modifier) => {
      const { rfEdge } = renderEdgeInReactFlowWrapper()
      const onClick = withClickSpy(rfEdge)
      focusEdge(rfEdge)
      act(() => {
        fireEvent.keyDown(rfEdge, { key: 'Enter', [modifier]: true })
      })
      expect(onClick).not.toHaveBeenCalled()
    },
  )

  it('PIN: Space (" ") does the same, and its default (page scroll) is prevented', () => {
    const { rfEdge } = renderEdgeInReactFlowWrapper()
    const onClick = withClickSpy(rfEdge)
    focusEdge(rfEdge)

    // A raw, cancelable event dispatched directly: `dispatchEvent` returns
    // `false` when some handler called `preventDefault()`, which is the one
    // reliable cross-version way to observe it (RTL's `fireEvent` result is
    // not that signal).
    const evt = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true })
    let notPrevented = true
    act(() => { notPrevented = rfEdge.dispatchEvent(evt) })

    expect(onClick, 'Space must ALSO reach the click, not only Enter').toHaveBeenCalledTimes(1)
    expect(notPrevented, 'Space must not be left free to scroll the page').toBe(false)
  })

  it('CONTRAST: a key that is not Enter or Space does nothing', () => {
    const { rfEdge } = renderEdgeInReactFlowWrapper()
    const onClick = withClickSpy(rfEdge)
    focusEdge(rfEdge)

    act(() => {
      fireEvent.keyDown(rfEdge, { key: 'a' })
    })

    expect(onClick, 'an unrelated key must not open anything').not.toHaveBeenCalled()
  })

  /**
   * ⭐⭐ THE DISCRIMINATION THIS FIX EXISTS FOR — without it, "Enter opens a
   * click" could be satisfied by a global `document`-level listener that
   * ALSO fires for a keystroke that landed on a totally unrelated control
   * inside this edge's own group (the fragile-cue-only glyph, which has its
   * OWN tabIndex/onKeyDown and bubbles its keydown up through this same
   * `.react-flow__edge`). Binding on `event.target !== rfEdge` — the
   * identical guard `focusIn` above already uses — means a descendant's own
   * Enter/Space is left to that descendant's own handler alone.
   */
  it('does NOT fire when Enter lands on a DESCENDANT control, only when it lands on the edge itself', () => {
    const { rfEdge } = renderEdgeInReactFlowWrapper()
    const onClick = withClickSpy(rfEdge)
    // A stand-in descendant control, inside the edge's own DOM subtree —
    // reproducing the fragile-cue glyph's own focusable child without
    // depending on that fixture's own render gates.
    const descendant = document.createElement('button')
    rfEdge.appendChild(descendant)

    act(() => {
      // `fireEvent.keyDown` dispatches with `bubbles: true` by default, so
      // this reaches the SAME ancestor listener a real bubble would.
      fireEvent.keyDown(descendant, { key: 'Enter' })
    })

    expect(onClick, 'a descendant\'s own Enter must not also open the whole edge').not.toHaveBeenCalled()
  })
})
