/**
 * EVERY NODE RENDERER CARRIES THE KEYBOARD SCOPE — derived from the registry.
 *
 * ── WHAT THIS TEST IS FOR, AND WHAT IT DELIBERATELY IS NOT ──────────────────
 *
 * The defect this guards is a property of React Flow's node WRAPPER, which no
 * test in this repo mounts (0 files mount `<ReactFlow>`). jsdom cannot observe
 * it: the handler that selects the node lives in the ancestor React Flow renders
 * around these components, and a standalone render never creates that ancestor.
 * The behavioural claim is therefore made in a real browser, by
 * `e2e/geometry/nodeKeyboardBleed.measure.ts`, and is not restated here.
 *
 * What jsdom CAN settle — and what a browser measure cannot, because a starter
 * only renders the node types it happens to contain — is COVERAGE OF THE
 * REGISTRY: that every renderer React Flow can be handed is wrapped, including
 * the two the browser measure could not drive.
 *
 * ⭐ AND IT IS DERIVED FROM `rawNodeTypes`, NOT FROM A LIST OF TYPE NAMES. A
 * hand-written list of the nine types would pass forever after someone added a
 * tenth (CLAUDE.md trap 12) — which is precisely the failure mode the fix
 * itself exists to avoid, so restating it in the test would reintroduce it one
 * level up.
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { createElement, type ComponentType } from 'react'
import { ReactFlowProvider, type NodeProps } from '@xyflow/react'
import { nodeTypes, rawNodeTypes } from '../registry'
import { withNodeKeyboardScope, NODE_KEYBOARD_SCOPE_CLASS } from '../nodeKeyboardScope'

/** React Flow's own opt-out class, spelled once here so a rename REDs loudly. */
const SCOPE_SELECTOR = `.${NODE_KEYBOARD_SCOPE_CLASS}`

describe('node registry: keyboard scope coverage', () => {
  it('exports one wrapped renderer for every raw renderer, in both directions', () => {
    const raw = Object.keys(rawNodeTypes).sort()
    const exported = Object.keys(nodeTypes).sort()

    // POSITIVE CONTROL: an empty registry would satisfy "every entry is
    // wrapped" perfectly. Pin the count so a registry that stopped exporting
    // anything REDs instead of scoring 100%.
    expect(raw.length).toBeGreaterThan(0)

    // BOTH DIRECTIONS: no type may be dropped by the wrapping, and none may be
    // invented by it.
    expect(exported).toEqual(raw)
  })

  it.each(Object.keys(rawNodeTypes))(
    'wraps the "%s" renderer — asserted by identity, not by count',
    (type) => {
      const Wrapped = nodeTypes[type] as ComponentType<NodeProps> & { displayName?: string }
      const Raw = (rawNodeTypes as Record<string, ComponentType<NodeProps> & { displayName?: string; name?: string }>)[
        type
      ]

      // ⚠ BOUND BY IDENTITY (trap 19). "Some component is exported for this key"
      // is satisfied by ANY component; what has to be true is that the exported
      // one is the scope wrapper AROUND THIS renderer. The display name carries
      // the inner component's own identity, so a wrapper applied to the wrong
      // renderer fails here rather than passing on a value predicate.
      const inner = Raw.displayName ?? Raw.name ?? 'Node'
      expect(Wrapped.displayName).toBe(`NodeKeyboardScope(${inner})`)

      // And it is NOT the bare renderer.
      expect(Wrapped).not.toBe(Raw)
    },
  )

  /*
   * ── THE TWO THE BROWSER MEASURE COULD NOT DRIVE ────────────────────────────
   *
   * `GhostOptionNode` ("Add another option") and `GhostTierNode` ("Another
   * factor/risk/outcome") are the sharpest cases in the whole defect: their
   * component ROOT *is* the focusable control (`div[role="button"][tabindex=0]`),
   * so there is no inner element a per-component fix could put the class on.
   * They render `visibility: hidden` under the visual harness's pinned flag
   * posture on all five starters, so they are in the census but cannot be
   * focused there. This is where they are held.
   */
  it.each(['ghost-option', 'ghost-tier'])('the %s renderer is inside the scope, not outside it', (type) => {
    const Wrapped = nodeTypes[type] as ComponentType<NodeProps>
    const { container } = render(
      createElement(ReactFlowProvider, null, createElement(Wrapped, ghostProps(type))),
    )

    const scope = container.querySelector(SCOPE_SELECTOR)
    expect(scope, `the ${type} renderer produced no ${SCOPE_SELECTOR} element`).not.toBeNull()

    // ⭐ THE LOAD-BEARING ASSERTION, and it is the one that would have caught a
    // scope placed one level too low: the CONTROL must be inside the scope. A
    // wrapper that renders the scope as a SIBLING of the control, or inside it,
    // satisfies "a .nokey exists" and gates nothing, because
    // `isInputDOMNode` walks UP from the target.
    const control = container.querySelector('[role="button"]')
    expect(control, `the ${type} renderer rendered no [role="button"]`).not.toBeNull()
    expect(scope!.contains(control!), `${type}'s control is not inside ${SCOPE_SELECTOR}`).toBe(true)
    expect(control!.closest(SCOPE_SELECTOR)).toBe(scope)
  })

  /*
   * ⚠ THE SILENT-DISARM CASE, AND WHY IT NEEDS THE LIBRARY'S OWN BYTES.
   *
   * Every other assertion in this file reads `NODE_KEYBOARD_SCOPE_CLASS`, so
   * renaming that constant to anything at all leaves them ALL GREEN while the
   * product is fully defective again — React Flow would look for `.nokey` and
   * find nothing. The class is NOT configurable from `<ReactFlow>` props
   * (unlike `noDragClassName` / `noPanClassName` / `noWheelClassName`): it is
   * hardcoded inside `isInputDOMNode`.
   *
   * So this asserts against the SHIPPED LIBRARY rather than against a literal
   * we wrote down. It REDs in both directions that matter: if we rename our
   * constant, and if an upgrade changes React Flow's opt-out — the second being
   * the one nobody would think to check, and the one that would take the whole
   * fix dark with a green suite.
   */
  it("the scope class is the one React Flow's own isInputDOMNode looks for", () => {
    // ⚠ RESOLVED THROUGH `@xyflow/react`, NOT FROM HERE. `@xyflow/system` is a
    // transitive dependency and pnpm does not hoist it, so resolving it from
    // this file throws MODULE_NOT_FOUND. Seeding a second `createRequire` at
    // React Flow's own entry resolves it the way React Flow itself does.
    const fromHere = createRequire(import.meta.url)
    const fromReactFlow = createRequire(fromHere.resolve('@xyflow/react'))
    const source = readFileSync(fromReactFlow.resolve('@xyflow/system'), 'utf8')

    // POSITIVE CONTROL: prove the probe is reading the right file before
    // believing anything it says about the contents (trap 13). Without it, a
    // resolution that landed on the wrong module would fail this test for the
    // wrong reason — or, if the assertion were an absence, pass for one.
    // (Both halves: the CJS entry is minified, so `function isInputDOMNode` is
    // not the spelling there. `composedPath` proves this is the implementation
    // and not a type stub or a re-export shim.)
    expect(source, 'the resolved @xyflow/system does not mention isInputDOMNode — wrong file').toContain(
      'isInputDOMNode',
    )
    expect(source, 'the resolved @xyflow/system has no implementation body — a stub, not the module').toContain(
      'composedPath',
    )

    // Quote style differs between the ESM and UMD builds, so match the call
    // rather than one spelling of it.
    const optOut = new RegExp(String.raw`closest\(\s*['"\`]\.${NODE_KEYBOARD_SCOPE_CLASS}['"\`]\s*\)`)
    expect(
      optOut.test(source),
      `@xyflow/system no longer opts out on ".${NODE_KEYBOARD_SCOPE_CLASS}" — the node keyboard scope is disarmed and every other assertion in this file would still pass`,
    ).toBe(true)
  })

  it('the scope generates no box, so it cannot move the graph', () => {
    const Probe = withNodeKeyboardScope(() => createElement('span', { 'data-testid': 'inner' }))
    const { container } = render(createElement(Probe, {} as NodeProps))
    const scope = container.querySelector(SCOPE_SELECTOR) as HTMLElement

    // React Flow sizes `.react-flow__node` from its content and this repo's
    // layout is computed from measured node sizes, so a scope that generated a
    // box could move every node on the canvas. `display: contents` is the whole
    // reason this wrapper is safe to add.
    expect(scope.style.display).toBe('contents')
  })
})

/** Minimal props each ghost renderer needs to mount. */
function ghostProps(type: string): NodeProps {
  const data = type === 'ghost-option' ? { prompt: 'add an option' } : { tier: 'factor', prompt: 'add a factor' }
  return {
    id: `__ghost-${type}__`,
    type,
    data,
    selected: false,
    isConnectable: false,
    zIndex: 0,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    dragging: false,
    draggable: false,
    selectable: false,
    deletable: false,
  } as unknown as NodeProps
}
