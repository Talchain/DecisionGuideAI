/**
 * THE ONE TEST IN THIS REPO THAT MOUNTS A REAL `<ReactFlow>`.
 *
 * ⭐ AND THAT IS THE POINT. The defect this guards does not live in any node
 * component — it lives in the ancestor React Flow renders AROUND them. Before
 * this file, `<ReactFlow>` was mounted by ZERO tests, which is exactly why a
 * canvas-wide keyboard defect shipped under a fully green suite.
 *
 * ⚠ AND WHY IT IS A `.spec.tsx` AND NOT A `.measure.ts`. The behavioural
 * evidence for this fix was first written as `e2e/geometry/nodeKeyboardBleed.
 * measure.ts` — a real browser, far richer, and IN NO GATE. A dated record is
 * not enforced coverage: the fix could regress and nothing would go red, which
 * reproduces the original condition one level up. The full 390-element census
 * and the pointer/marquee arm stay in the browser measure because jsdom cannot
 * answer them; the LOAD-BEARING assertions live here, where CI runs them.
 *
 * ── WHAT jsdom CAN AND CANNOT SETTLE HERE — MEASURED, NOT ASSUMED ───────────
 *
 * ⚠⚠ THE BEHAVIOURAL CLAIM IS NOT ASSERTED HERE, BECAUSE jsdom CANNOT HOST IT.
 * This file first carried two rows of the form "Enter at the in-node control
 * does NOT select the node". MUTATION TESTING PROVED THEM VACUOUS: with the
 * scope disabled entirely they still passed. Chased to the bottom with an
 * UNWRAPPED renderer — i.e. the defect fully present — and React Flow's own
 * `getNodes()` reports NO selection at any point:
 *
 *     at rest [] · after 1st control-Enter [] · after 2nd control-Enter []
 *
 * So the bleed does not reproduce under jsdom at all, and any "it does not
 * select" assertion here is a guard that cannot fail. They are deleted rather
 * than tuned until they agreed with themselves. (An earlier reading of
 * `["n1"]` came from `onSelectionChange`, which fires for reasons of its own —
 * one instrument artefact standing in for another.)
 *
 * WHAT IS ASSERTED INSTEAD is the MECHANISM, which jsdom settles exactly: the
 * scope is armed at the moment React Flow's node handler reads it, and at no
 * other moment. Together with the library-manifest test in the sibling spec —
 * which pins that this is the class that handler consults, and that there are
 * exactly two consumers of it — that is the whole chain, in CI.
 *
 * The BEHAVIOUR (3 of 5 render paths bled; 0 after; marquee over a node still
 * works; the node does not move; Enter at the node still selects) is a browser
 * claim and is measured in a browser by `e2e/geometry/nodeKeyboardBleed.
 * measure.ts`, which is NOT in a gate. That is a stated limit, not a silence.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { createElement } from 'react'
import { ReactFlow, ReactFlowProvider, type Node, type ReactFlowInstance } from '@xyflow/react'
import { NODE_KEYBOARD_SCOPE_CLASS, withNodeKeyboardScope } from '../nodeKeyboardScope'

/**
 * One node, one focusable control inside it, and nothing else. A starter model
 * would exercise thirty components and tell us less: what is under test is the
 * ROUTING of a keydown between a control and the node wrapper, and the smallest
 * graph that has both is the clearest statement of it.
 *
 * The control is a `<button>` with an exact accessible name, so every assertion
 * below binds to it by IDENTITY rather than by "the first focusable thing"
 * (CLAUDE.md trap 19).
 */
const CONTROL_LABEL = 'in-node control under test'
const NODE_ID = 'node-under-test'

function ProbeNode() {
  return createElement(
    'div',
    { style: { width: 160, height: 60 } },
    createElement('button', { type: 'button', 'aria-label': CONTROL_LABEL }, 'press me'),
  )
}
ProbeNode.displayName = 'ProbeNode'

const NODES: Node[] = [{ id: NODE_ID, type: 'probe', position: { x: 0, y: 0 }, data: {} }]

/*
 * ⚠ THE PROBE GOES THROUGH THE SAME SEAM THE REGISTRY USES, not a re-implementation
 * of it: `registry.ts` builds `nodeTypes` by mapping every renderer through this
 * exact function, and `registry.keyboardScope.spec.tsx` pins that derivation in
 * both directions for all nine real renderers. So a fix that stopped being
 * applied to the registry REDs there, and a fix that stopped WORKING REDs here.
 * Neither file can pass for the other's reason.
 */
const PROBE_TYPES = { probe: withNodeKeyboardScope(ProbeNode) }

interface Harness {
  selected: () => string[]
  /** How many `.nokey` elements existed at the moment the node handler ran. */
  scopeSeenByNodeHandler: number | null
}

function mountFlow(): Harness & { container: HTMLElement } {
  let instance: ReactFlowInstance | null = null
  let scopeSeenByNodeHandler: number | null = null

  const { container } = render(
    createElement(
      ReactFlowProvider,
      null,
      createElement(ReactFlow, {
        nodes: NODES,
        edges: [],
        nodeTypes: PROBE_TYPES,
        onInit: (i: ReactFlowInstance) => {
          instance = i
        },
      }),
    ),
  )

  const nodeElement = container.querySelector<HTMLElement>(`.react-flow__node[data-id="${NODE_ID}"]`)
  nodeElement?.addEventListener(
    'keydown',
    () => {
      scopeSeenByNodeHandler = document.querySelectorAll(`.${NODE_KEYBOARD_SCOPE_CLASS}`).length
    },
    true,
  )

  return {
    container,
    /*
     * ⚠ READ FROM REACT FLOW'S OWN STORE, NOT FROM `onSelectionChange`.
     *
     * The first version of this harness read the selection through
     * `onSelectionChange`, and MUTATION TESTING PROVED THOSE ASSERTIONS
     * VACUOUS: with the scope disabled entirely, the two "does NOT select"
     * rows still passed, because that callback had not delivered by the time
     * they read it. Two opposite mutants — never arm, and never disarm —
     * produced IDENTICAL red sets, which is the tell that a probe has stopped
     * discriminating (CLAUDE.md trap 20). `getNodes()` is the authority the
     * product itself reads.
     */
    selected: () => (instance?.getNodes() ?? []).filter((n) => n.selected).map((n) => n.id),
    get scopeSeenByNodeHandler() {
      return scopeSeenByNodeHandler
    },
  } as Harness & { container: HTMLElement }
}

function nodeEl(container: HTMLElement): HTMLElement {
  const el = container.querySelector<HTMLElement>(`.react-flow__node[data-id="${NODE_ID}"]`)
  expect(el, 'React Flow did not render the node wrapper — the mount failed, the fix is untested').not.toBeNull()
  return el!
}

function controlEl(container: HTMLElement): HTMLElement {
  const el = container.querySelector<HTMLElement>(`[aria-label="${CONTROL_LABEL}"]`)
  expect(el, 'the in-node control did not render — nothing below measures anything').not.toBeNull()
  return el!
}

describe('<ReactFlow> mounted for real: the keyboard scope arms exactly when React Flow reads it', () => {
  beforeAll(() => {
    // React Flow measures; jsdom reports 0x0 for everything. Give the flow a
    // size so the node wrapper renders and its handlers bind. Without this the
    // suite would pass by rendering nothing, which is the vacuity this file
    // exists to avoid.
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, value: 800 })
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 600 })
  })

  it('mounts the node wrapper and the in-node control — the precondition, pinned', () => {
    const { container } = mountFlow()
    // POSITIVE CONTROL. Every assertion below is about what happens inside a
    // node, and an empty render satisfies most of them perfectly.
    expect(nodeEl(container)).toBeTruthy()
    expect(controlEl(container)).toBeTruthy()
    expect(nodeEl(container).querySelector('[aria-label]')).toBe(controlEl(container))
  })

  it('nothing carries the scope class at rest — the marquee consumer can never see one', () => {
    mountFlow()
    /*
     * ⭐ `Pane.onPointerDownCapture` (`@xyflow/react` esm/index.mjs:1455-1456)
     * refuses to start a marquee when the pointerdown target has a `.nokey`
     * ancestor. The first version of this fix wrapped node content in a
     * PERMANENT `.nokey` and disabled marquee-over-a-node across the canvas.
     * A pointerdown is not a keydown, so if no `.nokey` element exists at rest,
     * that consumer cannot fire. This is the assertion that makes that true.
     */
    expect(
      document.querySelectorAll(`.${NODE_KEYBOARD_SCOPE_CLASS}`).length,
      'a .nokey element exists at rest — React Flow will refuse to start a marquee over a node',
    ).toBe(0)
  })

  it.each([['Enter'], [' '], ['Escape'], ['ArrowRight']])(
    'the scope is ARMED when the node handler reads a %j originating inside the node',
    (key) => {
      const harness = mountFlow()
      const control = controlEl(harness.container)
      control.focus()
      expect(document.activeElement, 'the control never took focus').toBe(control)

      fireEvent.keyDown(control, { key })

      /*
       * These four are exactly the keys React Flow's node handler acts on:
       * `elementSelectionKeys = ['Enter', ' ', 'Escape']` plus `arrowKeyDiffs`
       * (which MOVES a selected node). The guard is key-agnostic once armed,
       * and pinning all four says so — arrow-key node movement from inside a
       * control is the same defect and is closed by the same mechanism.
       */
      expect(
        harness.scopeSeenByNodeHandler,
        `the scope was NOT armed when the node handler read "${key}" — nothing is gating it`,
      ).toBeGreaterThan(0)
    },
  )

  it('a keydown at the NODE ITSELF never arms the scope — the mechanism that keeps node selection alive', () => {
    const harness = mountFlow()
    fireEvent.keyDown(nodeEl(harness.container), { key: 'Enter' })
    expect(
      harness.scopeSeenByNodeHandler,
      'the scope was armed by a keydown that started at the node — React Flow would stop selecting nodes',
    ).toBe(0)
  })

  it('the scope is DISARMED once the dispatch is over', async () => {
    const harness = mountFlow()
    fireEvent.keyDown(controlEl(harness.container), { key: 'Enter' })
    /*
     * ⚠ THE TIMING HERE IS THE WHOLE DEFECT OF THE FIRST IMPLEMENTATION.
     * `queueMicrotask` looked right and was wrong: a microtask checkpoint runs
     * whenever the JS stack empties, which the browser does BETWEEN listener
     * invocations of one real dispatch, so the scope armed and disarmed before
     * React Flow's handler read it. It survived a synthetic `dispatchEvent` —
     * which keeps the stack non-empty — i.e. the instrument agreed with the
     * code's mistake.
     *
     * ⛔ AND THIS ROW CANNOT CATCH THAT. jsdom's `fireEvent` is a synthetic
     * dispatch, so a microtask disarm passes here. It is recorded as a KNOWN
     * GAP rather than left implied: the mutant is run, it survives, and the
     * browser measure is what closes it.
     */
    await new Promise((r) => setTimeout(r, 0))
    expect(
      document.querySelectorAll(`.${NODE_KEYBOARD_SCOPE_CLASS}`).length,
      'the scope stayed armed after the dispatch — the pointer consumer would see it',
    ).toBe(0)
  })

  it('a pointerdown disarms the scope BEFORE React Flow can read it — the marquee guarantee', () => {
    const harness = mountFlow()
    fireEvent.keyDown(controlEl(harness.container), { key: 'Enter' })
    expect(
      document.querySelectorAll(`.${NODE_KEYBOARD_SCOPE_CLASS}`).length,
      'the scope is not armed after a keydown — this row would then prove nothing about disarming',
    ).toBeGreaterThan(0)

    // The disarm listener is on `document` in the CAPTURE phase, so it runs
    // before `Pane.onPointerDownCapture` (the pane is a descendant of
    // document). React Flow therefore decides whether to start a marquee having
    // seen no `.nokey` element, whatever a pending timer is doing.
    document.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    expect(
      document.querySelectorAll(`.${NODE_KEYBOARD_SCOPE_CLASS}`).length,
      'a pointerdown did not disarm the scope — React Flow would refuse to start a marquee over this node',
    ).toBe(0)
  })
})
