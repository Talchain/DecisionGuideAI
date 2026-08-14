/**
 * F2 (review of #689) — BIND THE MOUNT PATH, do not merely document it.
 *
 * The three factor panels D1 changed are deployed-mounted, and until now that
 * was asserted only in comments and in a review's prose. Trap 3b's rule is that
 * a UI test bound to a component the deployed flags do not mount is worthless
 * evidence — and the estate has shipped that defect twice in one feature. The
 * mitigation there was that the mount is a hardcoded constant rather than a
 * flag, so the classic 3b lever does not exist today. **"No lever today" is a
 * fact about today.** This file makes the chain fail loud the moment someone
 * adds one.
 *
 * ── WHY A SOURCE-DERIVED ASSERTION AND NOT A RENDER ───────────────────────
 * A render test proves the chain works under the props the test supplies. What
 * needs pinning here is different: that the mount is not CONDITIONAL on anything
 * a deployment can move. That is a property of the source, and reading the source
 * is the only way to assert the absence of a gate rather than the presence of one
 * path through it.
 *
 * ⚠ EVERY FILE READ IS ASSERTED NON-EMPTY BEFORE ANY MATCH IS BELIEVED.
 * An extraction that silently produced nothing agrees with every other
 * extraction that produced nothing, and `expect(...).not.toContain(...)` passes
 * beautifully against an empty string. That failure mode has cost this estate a
 * false "LADDER-IDENTICAL" verdict already, so the non-empty guard and the
 * negative control below are the load-bearing parts of this file, not decoration.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(__dirname, '../../../../..')

/** Read a source file, refusing to return anything a match could pass against. */
function source(relPath: string): string {
  const text = readFileSync(resolve(ROOT, relPath), 'utf8')
  if (text.trim().length < 200) {
    throw new Error(
      `refusing to assert against ${relPath}: read ${text.length} chars — ` +
        `an empty or truncated read makes every assertion in this file vacuous`,
    )
  }
  return text
}

const CANVAS_MVP = 'src/routes/CanvasMVP.tsx'
const REACT_FLOW_GRAPH = 'src/canvas/ReactFlowGraph.tsx'
const INSPECTOR_MODAL = 'src/canvas/components/InspectorModal.tsx'
const INSPECTOR_ROUTER = 'src/canvas/ui/inspector-v2/InspectorRouter.tsx'

describe('the inspector mount chain that carries D1 to a real user', () => {
  it('POSITIVE + NEGATIVE CONTROL — the detector reads real bytes and discriminates', () => {
    const modal = source(INSPECTOR_MODAL)
    // Positive: something known to be present.
    expect(modal).toContain('InspectorRouter')
    // Negative: a fabricated name must NOT match. Without this, a detector that
    // matched everything (or a read that returned the whole repo) would pass
    // every assertion below.
    expect(modal).not.toContain('InspectorRouterV99Fabricated')
  })

  it('CanvasMVP mounts ReactFlowGraph', () => {
    const mvp = source(CANVAS_MVP)
    expect(mvp).toMatch(/import\s+ReactFlowGraph\s+from\s+'\.\.\/canvas\/ReactFlowGraph'/)
    expect(mvp).toMatch(/<ReactFlowGraph\b/)
  })

  it('ReactFlowGraph mounts InspectorModal', () => {
    const graph = source(REACT_FLOW_GRAPH)
    expect(graph).toMatch(/import\s+\{\s*InspectorModal\s*\}\s+from\s+'\.\/components\/InspectorModal'/)
    expect(graph).toMatch(/<InspectorModal\b/)
  })

  it('⭐ InspectorModal chooses inspector-v2 UNCONDITIONALLY — not from a flag', () => {
    const modal = source(INSPECTOR_MODAL)

    // The exact literal. This is the assertion that REDs if anyone converts the
    // constant into a flag read (`= isInspectorV2Enabled()`, `= flags.x`,
    // `= import.meta.env.VITE_…`), which is precisely the trap-3b lever that
    // does not exist today.
    expect(modal).toMatch(/^const USE_INSPECTOR_V2 = true$/m)

    // And it is actually consulted, and the v2 router is what it reaches for.
    expect(modal).toMatch(/if\s*\(\s*USE_INSPECTOR_V2\s*\)/)
    expect(modal).toMatch(/<InspectorRouter\b/)
  })

  it('⭐ InspectorRouter maps all three factor panel types D1 touched', () => {
    const router = source(INSPECTOR_ROUTER)
    // Bound BY IDENTITY — panel type to the specific component — not by "the
    // file mentions the panels somewhere". A router that mapped
    // `factor-observable` to the wrong panel would satisfy a mere-mention check.
    expect(router).toMatch(/'factor-controllable':\s*FactorControllablePanel/)
    expect(router).toMatch(/'factor-observable':\s*FactorObservablePanel/)
    expect(router).toMatch(/'factor-external':\s*FactorExternalPanel/)
  })

  it('records the router default that makes a category-less fixture test the wrong panel', () => {
    // Not a mount assertion — a tripwire on the trap that makes component tests
    // in this area lie. `resolvePanelType` falls through to
    // 'factor-controllable', so a fixture omitting `data.category` silently
    // exercises a different panel and passes. If this default ever changes, the
    // fixtures in panelAttributionNaming.spec.tsx need re-reading.
    const router = source(INSPECTOR_ROUTER)
    expect(router).toMatch(/default:\s*return 'factor-controllable'/)
  })
})
