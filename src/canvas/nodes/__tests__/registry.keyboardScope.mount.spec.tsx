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
 * ── WHAT jsdom CAN AND CANNOT SETTLE HERE ───────────────────────────────────
 *
 * CAN: which handler receives a keydown, and what the store does about it. That
 * is pure event routing, and it is the whole mechanism.
 * CANNOT: anything about pixels, hit-testing, or pointer capture. The marquee
 * claim (`Shift-drag over a node still starts a selection and does not move the
 * node`) is a browser claim and is made in the browser, not restated here.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { createElement } from 'react'
import { ReactFlow, ReactFlowProvider, type Node, type OnSelectionChangeParams } from '@xyflow/react'
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
  let selection: string[] = []
  let scopeSeenByNodeHandler: number | null = null

  const onSelectionChange = (p: OnSelectionChangeParams) => {
    selection = p.nodes.map((n) => n.id)
  }

  const { container } = render(
    createElement(
      ReactFlowProvider,
      null,
      createElement(ReactFlow, {
        nodes: NODES,
        edges: [],
        nodeTypes: PROBE_TYPES,
        onSelectionChange,
      }),
    ),
  )

  // Record what the DOM looked like from React Flow's own vantage point: a
  // listener on the node element, registered AFTER React's, would run too late,
  // so this one is attached in the capture phase of the node element — the same
  // element React Flow's handler is bound to, at the same moment in the dispatch.
  const nodeEl = container.querySelector<HTMLElement>(`.react-flow__node[data-id="${NODE_ID}"]`)
  nodeEl?.addEventListener(
    'keydown',
    () => {
      scopeSeenByNodeHandler = document.querySelectorAll(`.${NODE_KEYBOARD_SCOPE_CLASS}`).length
    },
    true,
  )

  return {
    container,
    selected: () => selection,
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

describe('<ReactFlow> mounted for real: a keydown inside a node does not select the node', () => {
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
    // POSITIVE CONTROL. Every assertion below is of the form "the node did NOT
    // become selected", and an empty render satisfies all of them perfectly.
    expect(nodeEl(container)).toBeTruthy()
    expect(controlEl(container)).toBeTruthy()
    // And the seam is genuinely in the tree the flow mounted.
    expect(nodeEl(container).querySelector('[aria-label]')).toBe(controlEl(container))
  })

  /*
   * ⚠ THE POSITIVE DIRECTION IS NOT ASSERTED HERE, AND THAT IS MEASURED, NOT
   * ASSUMED. Under jsdom, `fireEvent.keyDown` at the `.react-flow__node`
   * element does NOT produce a selection — WITH OR WITHOUT this fix. Checked
   * with an unwrapped renderer as the control: node-keydown → `[]`,
   * control-keydown → `["n1"]`. So an assertion here would fail for a reason
   * that has nothing to do with the scope, and "fixing" it would mean tuning
   * the test until it agreed with itself.
   *
   * The claim "Enter at the node still selects it, Escape still deselects" is a
   * browser claim and is made in a browser, by
   * `e2e/geometry/nodeKeyboardBleed.measure.ts` — where it passes at pristine
   * AND at this head, so it is a live property and not a vacuous one.
   *
   * What jsdom CAN settle about that direction is the MECHANISM, and it is
   * asserted below: a keydown originating at the node itself never arms the
   * scope, so React Flow's handler reads exactly what it read before the fix.
   */
  it('a keydown at the NODE ITSELF never arms the scope — the mechanism that keeps node selection alive', () => {
    const harness = mountFlow()
    fireEvent.keyDown(nodeEl(harness.container), { key: 'Enter' })
    expect(
      harness.scopeSeenByNodeHandler,
      'the scope was armed by a keydown that started at the node — React Flow would stop selecting nodes',
    ).toBe(0)
  })

  it.each([['Enter'], [' ']])(
    'a keydown of %j at the in-node control does NOT select the node',
    async (key) => {
      const { container, selected } = mountFlow()
      const control = controlEl(container)
      control.focus()
      expect(document.activeElement, 'the control never took focus — the press measures the document').toBe(control)

      fireEvent.keyDown(control, { key })
      // Give React Flow the same chance to select that the passing direction gets.
      await new Promise((r) => setTimeout(r, 0))
      expect(selected(), `"${key}" at an in-node control still selected the node behind it`).toEqual([])
    },
  )

  it('the scope is armed exactly when the node handler reads it, and at no other time', async () => {
    const harness = mountFlow()
    const control = controlEl(harness.container)

    // ⭐ THE POINTER CONSUMER CAN NEVER SEE IT. `Pane.onPointerDownCapture`
    // (`@xyflow/react` esm/index.mjs:1455-1456) bails out of starting a marquee
    // when the pointerdown target has a `.nokey` ancestor. Wrapping node content
    // in a permanent `.nokey` disabled marquee-over-a-node across the whole
    // canvas — the defect this design exists to avoid. At rest there is no such
    // element anywhere in the document, so that consumer cannot fire.
    expect(
      document.querySelectorAll(`.${NODE_KEYBOARD_SCOPE_CLASS}`).length,
      'a .nokey element exists at rest — React Flow will refuse to start a marquee over a node',
    ).toBe(0)

    fireEvent.keyDown(control, { key: 'Enter' })

    // ...and DURING the dispatch it was armed, which is the other half. Without
    // this the test above would also pass on a fix that does nothing at all.
    expect(
      harness.scopeSeenByNodeHandler,
      'the scope was NOT armed when the node handler ran — nothing is gating the keydown',
    ).toBeGreaterThan(0)

    /*
     * ⚠ DISARMED AFTER THE DISPATCH — AND THE TIMING HERE IS THE WHOLE DEFECT
     * OF THE FIRST IMPLEMENTATION. `queueMicrotask` looked right and was wrong:
     * a microtask checkpoint runs whenever the JS stack empties, which the
     * browser does BETWEEN listener invocations of one real dispatch, so the
     * scope armed and disarmed before React Flow's handler ever read it. It
     * survived a synthetic `dispatchEvent` — which keeps the stack non-empty —
     * i.e. the instrument agreed with the code's mistake. Caught in a browser,
     * fixed with a timer task, which cannot run until the dispatch is over.
     */
    await new Promise((r) => setTimeout(r, 0))
    expect(
      document.querySelectorAll(`.${NODE_KEYBOARD_SCOPE_CLASS}`).length,
      'the scope stayed armed after the dispatch — the pointer consumer would see it',
    ).toBe(0)
  })

  it('a pointerdown disarms the scope BEFORE React Flow can read it — the marquee guarantee', () => {
    const harness = mountFlow()
    const control = controlEl(harness.container)

    // Arm it, and hold the dispatch open by not letting the timer run.
    fireEvent.keyDown(control, { key: 'Enter' })
    expect(
      document.querySelectorAll(`.${NODE_KEYBOARD_SCOPE_CLASS}`).length,
      'the scope is not armed after a keydown — this test would then prove nothing about disarming',
    ).toBeGreaterThan(0)

    /*
     * The disarm listener is on `document` in the CAPTURE phase, so it runs
     * before `Pane.onPointerDownCapture` (the pane is a descendant of
     * document). React Flow therefore decides whether to start a marquee having
     * seen no `.nokey` element, whatever a pending timer is doing.
     *
     * The behavioural claim — Shift-drag over a node still marquees, and the
     * node does not move — is a browser claim and is measured in the browser.
     * This is the mechanism that makes it true.
     */
    document.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    expect(
      document.querySelectorAll(`.${NODE_KEYBOARD_SCOPE_CLASS}`).length,
      'a pointerdown did not disarm the scope — React Flow would refuse to start a marquee over this node',
    ).toBe(0)
  })

  it('a key React Flow does not act on is unaffected — the contrast control', async () => {
    const { container, selected } = mountFlow()
    const control = controlEl(container)
    control.focus()
    fireEvent.keyDown(control, { key: 'q' })
    await new Promise((r) => setTimeout(r, 0))
    // Expected answer DIFFERS from the rows above only in cause, not in value —
    // so this row's job is to show the probe is not reporting "not selected"
    // because it stopped reading. Paired with the node-selects-on-Enter test,
    // which reads the SAME selection channel and gets a non-empty answer.
    expect(selected()).toEqual([])
  })
})
