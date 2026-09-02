/**
 * PORTALLED NODE CONTENT CARRIES THE KEYBOARD SCOPE TOO.
 *
 * ── THE DEFECT THIS GUARDS ──────────────────────────────────────────────────
 *
 * `NodePopover` renders node content through `createPortal(…, document.body)`.
 * React propagates events through the REACT tree, so a keydown from a button in
 * there still reaches React Flow's node `onKeyDown`
 * (`@xyflow/react@12.10.2` `dist/esm/index.mjs:2240`). Its only guard,
 * `isInputDOMNode` (`@xyflow/system@0.0.76` `esm:846-854`), walks the DOM tree
 * — `composedPath()[0].closest('.nokey')` — and `nodes/nodeKeyboardScope.tsx`'s
 * scope lives inside `.react-flow__node`, which a portalled element is not a
 * descendant of. So that scope could never gate it, and Enter or Space at a
 * popover control also selected the node behind it.
 *
 * ── WHAT IS ASSERTED HERE, AND WHAT DELIBERATELY IS NOT ─────────────────────
 *
 * ⛔ NOT "it does not select the node". `registry.keyboardScope.mount.spec.tsx`
 * proved by mutation that jsdom cannot host that claim at all: with the defect
 * fully present React Flow's own `getNodes()` reports NO selection at any
 * point, so such an assertion is a guard that cannot fail. The BEHAVIOUR is a
 * browser claim and is measured in a browser by the portalled arm of
 * `e2e/geometry/nodeKeyboardBleed.measure.ts`.
 *
 * What jsdom settles exactly — and what a browser measure cannot state as
 * cleanly — is the MECHANISM: at the moment React Flow's node handler reads it,
 * React Flow's own `isInputDOMNode` returns true for a keydown originating in a
 * portalled popover, and the element that made it true is THAT POPOVER's scope.
 *
 * ⭐ THE ORACLE IS THE LIBRARY'S OWN FUNCTION, NOT A RESTATEMENT OF IT. Every
 * assertion below calls the real `isInputDOMNode` out of the installed
 * `@xyflow/system`. A test that re-implemented `closest('.nokey')` would agree
 * with itself forever if the library's predicate ever changed (CLAUDE.md trap
 * 13c: a mutant kit measures sensitivity, never whether the expectation is
 * right). The sibling `registry.keyboardScope.spec.tsx` pins the consumer
 * manifest at the library's bytes; this pins the behaviour against the same
 * bytes.
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, it, expect, beforeAll } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { createElement, useRef, type ReactNode } from 'react'
import { ReactFlow, ReactFlowProvider, type Node } from '@xyflow/react'
import { NodePopover } from '../NodePopover'
import { NODE_KEYBOARD_SCOPE_CLASS, NODE_KEYBOARD_SCOPE_ATTR, withNodeKeyboardScope } from '../../nodeKeyboardScope'

/**
 * ⚠ RESOLVED THROUGH `@xyflow/react`, NOT FROM HERE. `@xyflow/system` is a
 * transitive dependency and pnpm does not hoist it, so resolving it from this
 * file throws MODULE_NOT_FOUND. Seeding a second `createRequire` at React
 * Flow's own entry resolves it the way React Flow itself does — the same
 * technique, and the same reason, as `registry.keyboardScope.spec.tsx`.
 *
 * The ESM build is loaded explicitly rather than the CJS `require` entry,
 * because the ESM build is what Vite bundles into the app.
 */
type IsInputDOMNode = (event: Event) => boolean
let isInputDOMNode: IsInputDOMNode

const CONTROL_LABEL = 'portalled control under test'
const NODE_ID = 'node-with-popover'
const SCOPE_SELECTOR = `[${NODE_KEYBOARD_SCOPE_ATTR}]`

/**
 * What React Flow's node handler would read, captured from a position in the
 * REACT tree strictly between the popover and React Flow's own node div.
 *
 * ⚠ WHY NOT A NATIVE LISTENER ON THE NODE ELEMENT, which is what the sibling
 * mount spec uses: a portalled control is NOT a DOM descendant of the node, so
 * a native listener there never fires at all. React Flow's handler is a REACT
 * handler and reaches this event only through React's tree propagation, so the
 * instrument has to live in that tree too.
 *
 * This handler sits on the node COMPONENT's own root, i.e. one level below
 * React Flow's node div in the React tree, so it runs in the same synchronous
 * dispatch, on the same `nativeEvent`, AFTER the popover's capture handler and
 * BEFORE React Flow's. Nothing between the two touches the DOM, so what it
 * reads is what React Flow reads.
 */
let readByNodeHandler: boolean | null = null
let gatingElement: Element | null = null

function ProbeNodeBody({ children }: { children: ReactNode }) {
  const anchorRef = useRef<HTMLDivElement>(null)
  return createElement(
    'div',
    {
      ref: anchorRef,
      style: { width: 160, height: 60 },
      onKeyDown: (ev: React.KeyboardEvent) => {
        readByNodeHandler = isInputDOMNode(ev.nativeEvent)
        const target = (ev.nativeEvent.composedPath?.()?.[0] ?? ev.nativeEvent.target) as Element
        gatingElement = target?.closest?.(`.${NODE_KEYBOARD_SCOPE_CLASS}`) ?? null
      },
    },
    createElement(NodePopover, {
      visible: true,
      anchorRef,
      onMouseEnter: () => undefined,
      onMouseLeave: () => undefined,
      children,
    }),
  )
}

function PortalProbeNode() {
  return createElement(
    ProbeNodeBody,
    null,
    createElement('button', { type: 'button', 'aria-label': CONTROL_LABEL }, 'press me'),
  )
}
PortalProbeNode.displayName = 'PortalProbeNode'

const NODES: Node[] = [{ id: NODE_ID, type: 'probe', position: { x: 0, y: 0 }, data: {} }]

/*
 * ⚠ THROUGH THE SAME SEAM THE REGISTRY USES. `registry.ts` builds `nodeTypes`
 * by mapping every renderer through `withNodeKeyboardScope`, so the node here
 * carries the ordinary in-node scope as well. That is deliberate: it is the
 * shipped arrangement, and it is what makes the identity assertion below able
 * to tell the two scopes apart.
 */
const PROBE_TYPES = { probe: withNodeKeyboardScope(PortalProbeNode) }

function mountFlow() {
  readByNodeHandler = null
  gatingElement = null
  return render(
    createElement(
      ReactFlowProvider,
      null,
      createElement(ReactFlow, { nodes: NODES, edges: [], nodeTypes: PROBE_TYPES }),
    ),
  )
}

/** The portalled card, found in `document.body` — never inside the container. */
function popoverEl(): HTMLElement {
  const el = document.querySelector<HTMLElement>('[data-node-popover]')
  expect(el, 'the popover did not render — nothing below measures anything').not.toBeNull()
  return el!
}

function controlEl(): HTMLElement {
  const el = popoverEl().querySelector<HTMLElement>(`[aria-label="${CONTROL_LABEL}"]`)
  expect(el, 'the portalled control did not render inside the popover').not.toBeNull()
  return el!
}

function nodeEl(container: HTMLElement): HTMLElement {
  const el = container.querySelector<HTMLElement>(`.react-flow__node[data-id="${NODE_ID}"]`)
  expect(el, 'React Flow did not render the node wrapper — the mount failed, the fix is untested').not.toBeNull()
  return el!
}

/** The popover's OWN scope element — the one that must do the gating. */
function popoverScopeEl(): HTMLElement {
  const el = popoverEl().querySelector<HTMLElement>(SCOPE_SELECTOR)
  expect(el, `the popover rendered no ${SCOPE_SELECTOR} element`).not.toBeNull()
  return el!
}

describe('NodePopover: portalled node content carries the keyboard scope', () => {
  beforeAll(async () => {
    const fromHere = createRequire(import.meta.url)
    const reactEntry = fromHere.resolve('@xyflow/react')
    const fromReactFlow = createRequire(reactEntry)
    const systemCjs = fromReactFlow.resolve('@xyflow/system')
    const systemEsm = join(dirname(dirname(systemCjs)), 'esm', 'index.js')

    // POSITIVE CONTROL ON THE RESOLUTION ITSELF (trap 13): prove this is the
    // real implementation before believing anything it says. A stub, or a
    // wrong file, would otherwise make every row below pass or fail for a
    // reason that has nothing to do with the product.
    const source = readFileSync(systemEsm, 'utf8')
    expect(source, 'the resolved @xyflow/system ESM build has no isInputDOMNode — wrong file').toContain(
      'function isInputDOMNode',
    )
    expect(source, 'the resolved @xyflow/system has no implementation body — a stub, not the module').toContain(
      'composedPath',
    )

    const mod = (await import(pathToFileURL(systemEsm).href)) as { isInputDOMNode: IsInputDOMNode }
    isInputDOMNode = mod.isInputDOMNode
    expect(typeof isInputDOMNode, '@xyflow/system did not export isInputDOMNode as a function').toBe('function')

    // React Flow measures; jsdom reports 0x0 for everything. Without this the
    // node wrapper never renders and the suite would pass by rendering nothing.
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, value: 800 })
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 600 })
  })

  it('the ORACLE discriminates — isInputDOMNode is false for a bare button and true for an input', () => {
    /*
     * ⭐ A CONTRAST CONTROL ON THE ORACLE, WITH THE EXPECTED ANSWERS DIFFERING
     * (CLAUDE.md trap 13e). Every row below reads `true` from this function.
     * A resolution that returned a stub answering `true` unconditionally would
     * make all of them pass while proving nothing at all — and an oracle that
     * answered `false` unconditionally would make them fail for the wrong
     * reason. Both are excluded here, in the same run.
     */
    const button = document.createElement('button')
    const input = document.createElement('input')
    document.body.append(button, input)
    try {
      const at = (el: Element) => {
        const ev = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
        el.dispatchEvent(ev)
        return isInputDOMNode(ev)
      }
      expect(at(button), 'the oracle gates a bare button with no .nokey ancestor — it is not discriminating').toBe(false)
      expect(at(input), 'the oracle does not gate an <input> — it is not the real isInputDOMNode').toBe(true)
    } finally {
      button.remove()
      input.remove()
    }
  })

  it('the precondition, pinned: the control is genuinely PORTALLED, not a DOM descendant of the node', () => {
    /*
     * ⭐ THE ASSERTION THAT KEEPS THIS FILE ABOUT THE RIGHT DEFECT. If the
     * popover ever stopped portalling, the in-node scope would cover this
     * content and every row below would pass for a reason that has nothing to
     * do with this fix. That is a product change, and it should RED here rather
     * than quietly turn this spec into a tautology.
     */
    const { container } = mountFlow()
    const node = nodeEl(container)
    const control = controlEl()

    expect(node.contains(control), 'the control is INSIDE the node — the popover is no longer portalled').toBe(false)
    expect(control.closest('.react-flow'), 'the popover is inside the React Flow container, not portalled out').toBeNull()
    expect(popoverEl().parentElement, 'the popover is not portalled to document.body').toBe(document.body)
  })

  it('nothing carries the scope class at rest — the marquee consumer can never see one', () => {
    mountFlow()
    /*
     * `Pane.onPointerDownCapture` (`@xyflow/react` esm/index.mjs:1455-1456)
     * refuses to start a marquee when the pointerdown target has a `.nokey`
     * ancestor. It matters MORE for the popover than for the node scope: the
     * popover is portalled in the DOM but is still a REACT descendant of the
     * pane, so a permanent `.nokey` here would be visible to that consumer
     * through React's own tree propagation.
     */
    expect(
      document.querySelectorAll(`.${NODE_KEYBOARD_SCOPE_CLASS}`).length,
      'a .nokey element exists at rest — React Flow will refuse to start a marquee',
    ).toBe(0)
  })

  it.each([['Enter'], [' '], ['Escape'], ['ArrowRight']])(
    'React Flow reads the scope as ARMED for a %j originating in the portalled popover',
    (key) => {
      mountFlow()
      const control = controlEl()
      control.focus()
      expect(document.activeElement, 'the portalled control never took focus').toBe(control)

      fireEvent.keyDown(control, { key })

      /*
       * These four are exactly the keys React Flow's node handler acts on:
       * `elementSelectionKeys = ['Enter', ' ', 'Escape']` plus `arrowKeyDiffs`
       * (which MOVES a selected node). The guard is key-agnostic once armed,
       * and pinning all four says so.
       */
      expect(
        readByNodeHandler,
        `React Flow's own isInputDOMNode returned false for "${key}" from the portalled popover — nothing is gating it`,
      ).toBe(true)
    },
  )

  it('and the element that gated it is THE POPOVER\'S OWN SCOPE — bound by identity, not by "some .nokey exists"', () => {
    /*
     * ⭐ THE DISCRIMINATING ASSERTION (CLAUDE.md trap 19). The node carries a
     * scope too, and `document.querySelector('.nokey')` would be satisfied by
     * either of them — so "a .nokey exists" is a value predicate another object
     * can satisfy. What has to be true is that the element `closest()` actually
     * walked up to is the scope INSIDE THIS POPOVER. A fix that armed only the
     * node's scope would satisfy a count and fail here.
     */
    const { container } = mountFlow()
    const control = controlEl()
    control.focus()
    fireEvent.keyDown(control, { key: 'Enter' })

    const scope = popoverScopeEl()
    expect(gatingElement, 'no element gated the keydown at all').not.toBeNull()
    expect(gatingElement, "the gating element is not the popover's own scope").toBe(scope)
    expect(
      nodeEl(container).contains(gatingElement!),
      'the gating element is inside the node — that scope cannot reach portalled content, so this reading is wrong',
    ).toBe(false)
  })

  it('a keydown at the NODE ITSELF never arms the popover scope — node selection stays alive', () => {
    const { container } = mountFlow()
    const scope = popoverScopeEl()
    fireEvent.keyDown(nodeEl(container), { key: 'Enter' })
    expect(
      scope.classList.contains(NODE_KEYBOARD_SCOPE_CLASS),
      'the popover scope armed on a keydown that started at the node — React Flow would stop selecting nodes',
    ).toBe(false)
  })

  it('the scope is DISARMED once the dispatch is over', async () => {
    mountFlow()
    fireEvent.keyDown(controlEl(), { key: 'Enter' })
    expect(
      document.querySelectorAll(`.${NODE_KEYBOARD_SCOPE_CLASS}`).length,
      'the scope did not arm — this row would then prove nothing about disarming',
    ).toBeGreaterThan(0)
    /*
     * ⛔ KNOWN GAP, STATED RATHER THAN IMPLIED. jsdom's `fireEvent` is a
     * synthetic dispatch, which keeps the JS stack non-empty for the whole
     * dispatch — so a `queueMicrotask` disarm (the first implementation of this
     * mechanism, and a real defect) would pass this row. Only a real trusted key
     * press in a browser can see that, and the portalled arm of the geometry
     * measure is what covers it.
     */
    await new Promise((r) => setTimeout(r, 0))
    expect(
      document.querySelectorAll(`.${NODE_KEYBOARD_SCOPE_CLASS}`).length,
      'the scope stayed armed after the dispatch — the pointer consumer would see it',
    ).toBe(0)
  })

  it('a pointerdown disarms the scope BEFORE React Flow can read it — the marquee guarantee', () => {
    mountFlow()
    fireEvent.keyDown(controlEl(), { key: 'Enter' })
    expect(
      document.querySelectorAll(`.${NODE_KEYBOARD_SCOPE_CLASS}`).length,
      'the scope is not armed after a keydown — this row would then prove nothing about disarming',
    ).toBeGreaterThan(0)

    document.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    expect(
      document.querySelectorAll(`.${NODE_KEYBOARD_SCOPE_CLASS}`).length,
      'a pointerdown did not disarm the scope — React Flow would refuse to start a marquee',
    ).toBe(0)
  })

  it('the scope generates no box, so it cannot change the popover layout', () => {
    mountFlow()
    /*
     * The card is a padded, scrolling, fixed-width box. A scope element that
     * generated a box of its own would sit between that padding and the
     * content. `display: contents` generates none, while `closest()` — which
     * walks the DOM tree, not the box tree — still finds it.
     */
    expect(popoverScopeEl().style.display).toBe('contents')
    // ⚠ AND NO `className` PROP ON IT. React rewrites `className` whenever it
    // renders one, and this component re-renders on an rAF loop that tracks the
    // anchor — so a scope that carried a className would be racing React's own
    // DOM write for the class this mechanism adds.
    expect(
      popoverScopeEl().getAttribute('class'),
      'the scope element carries a class attribute — React will clobber the armed .nokey',
    ).toBeNull()
  })

  it('the INLINE FALLBACK branch carries the scope too — coverage is a property of the component, not of the branch', () => {
    /*
     * `NodePopover` renders inline when it is given no `anchorRef`. That branch
     * IS a DOM descendant of its node and so is already covered by the in-node
     * scope — but which branch a caller hits is not something this fix should
     * depend on, and a future caller that drops `anchorRef` should not silently
     * lose the gate.
     */
    const { container } = render(
      createElement(NodePopover, {
        visible: true,
        onMouseEnter: () => undefined,
        onMouseLeave: () => undefined,
        children: createElement('button', { type: 'button', 'aria-label': CONTROL_LABEL }, 'press me'),
      }),
    )
    const inline = container.querySelector<HTMLElement>('[data-node-popover]')
    expect(inline, 'the inline fallback did not render').not.toBeNull()
    const scope = inline!.querySelector<HTMLElement>(SCOPE_SELECTOR)
    expect(scope, `the inline fallback rendered no ${SCOPE_SELECTOR} element`).not.toBeNull()

    const control = inline!.querySelector<HTMLElement>(`[aria-label="${CONTROL_LABEL}"]`)!
    expect(control.closest(SCOPE_SELECTOR), 'the inline control is not inside the scope').toBe(scope)

    fireEvent.keyDown(control, { key: 'Enter' })
    expect(
      scope!.classList.contains(NODE_KEYBOARD_SCOPE_CLASS),
      'the inline fallback branch does not arm the scope',
    ).toBe(true)
  })
})
