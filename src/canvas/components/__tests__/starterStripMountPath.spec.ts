/**
 * ⭐ THE STARTER STRIP'S MOUNT PATH — bound, not documented.
 *
 * Five real 15–19-node enterprise decision models ship in the bundle. Between
 * the P1-2 rework and this file they reached NO USER, and the reason is the
 * defect this spec exists to make impossible twice:
 *
 *   `FirstUseComposer` gated the strip on the PRESENCE OF `blueprintEventBus`,
 *   using it as a proxy for "this is the primary canvas mount". Meanwhile
 *   `ReactFlowGraph` passed that bus through
 *   `CANVAS_SEMANTIC_MUTATIONS_CONNECTED ? blueprintEventBus : undefined`, and
 *   that constant is `hasServerGraphAuthority('disabled')` → PERMANENTLY FALSE.
 *   A gate about *mutation-authority presentation* silently switched off a gate
 *   about *which mount you are*. Two questions, one boolean (CLAUDE.md trap 21).
 *
 * The proxy is now an explicit `showStarters` prop, and the constraint the old
 * gate was really protecting is the thing this file pins: **PlotWorkspace, the
 * isolation-test route and the sandbox canvas must never gain starter cards.**
 *
 * ── WHY SOURCE-DERIVED AND NOT A RENDER (house pattern: inspectorMountChain) ──
 * A render test proves the strip works under the props the TEST supplies —
 * which is exactly the evidence that would have stayed green through the whole
 * period the strip was dark. What needs pinning is a property of the SOURCE:
 * that the canvas mount opts in, that no other mount does, and that the opt-in
 * is not routed through anything a deployment or an authority table can move.
 * Reading the source is the only way to assert the ABSENCE of a gate rather
 * than the presence of one path through it.
 *
 * ⚠ EVERY FILE READ IS ASSERTED NON-EMPTY BEFORE ANY MATCH IS BELIEVED.
 * `expect(...).not.toContain(...)` passes beautifully against an empty string,
 * and an extraction that silently produced nothing agrees with every other
 * extraction that produced nothing. The non-empty guard and the negative
 * control are the load-bearing parts of this file, not decoration.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(__dirname, '../../../..')

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

/**
 * Strip comments so an absence claim is about CODE, not about prose.
 *
 * The names this file forbids in code are named ON PURPOSE in the doc comments
 * that explain the defect — deleting that explanation to satisfy a text match
 * would trade the record for a green test.
 *
 * ⚠ A STRIPPER THAT OVER-ATE WOULD MAKE EVERY `not.toContain` PASS FOR THE
 * WRONG REASON, so callers MUST pair this with positive controls naming code
 * they expect to survive. That pairing — not a length heuristic — is the
 * discrimination: a first attempt here rejected any strip removing >60% of the
 * file and immediately fired on FirstUseComposer.tsx, which is 62% comments by
 * character. A ratio measures how well-documented the file is, not whether the
 * strip was safe. The floor below only catches a total wipe-out.
 */
function codeOnly(text: string): string {
  const stripped = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
  if (stripped.trim().length < 200) {
    throw new Error(
      `comment strip left ${stripped.trim().length} chars — ` +
        `refusing to make absence assertions against what is left`,
    )
  }
  return stripped
}

const FIRST_USE_COMPOSER = 'src/canvas/components/FirstUseComposer.tsx'
const REACT_FLOW_GRAPH = 'src/canvas/ReactFlowGraph.tsx'
const CANVAS_MVP = 'src/routes/CanvasMVP.tsx'
const PLOT_WORKSPACE = 'src/routes/PlotWorkspace.tsx'
const CANVAS_ISOLATION_TEST = 'src/routes/CanvasIsolationTest.tsx'
const COPILOT_CANVAS = 'src/pages/sandbox-guide/components/canvas/CopilotCanvas.tsx'

/** Every file in the repo that mounts <ReactFlowGraph>. Exactly one may opt in. */
const ALL_REACT_FLOW_GRAPH_MOUNTS = [
  CANVAS_MVP,
  PLOT_WORKSPACE,
  CANVAS_ISOLATION_TEST,
  COPILOT_CANVAS,
] as const

describe('the starter strip mount path', () => {
  it('POSITIVE + NEGATIVE CONTROL — the detector reads real bytes and discriminates', () => {
    const composer = source(FIRST_USE_COMPOSER)
    // Positive: something known to be present.
    expect(composer).toContain('StarterDecisions')
    // Negative: a fabricated name must NOT match. Without this, a detector that
    // matched everything (or a read that returned the whole repo) would pass
    // every assertion below.
    expect(composer).not.toContain('StarterDecisionsV99Fabricated')
  })

  it('CONTROL — every listed mount really does mount ReactFlowGraph', () => {
    // Pins this file's own precondition. The `not.toMatch(showStarters)`
    // assertions below are about files that MOUNT the graph; if a path were
    // renamed away, `source()` would throw, but if a file merely stopped
    // mounting the graph the negative assertions would start passing for the
    // wrong reason — a guard agreeing with itself (trap 13b).
    for (const path of ALL_REACT_FLOW_GRAPH_MOUNTS) {
      expect(source(path), `${path} no longer mounts ReactFlowGraph`).toMatch(/<ReactFlowGraph\b/)
    }
  })

  it('⭐ FirstUseComposer gates the strip on showStarters — NOT on the blueprint bus', () => {
    const composer = source(FIRST_USE_COMPOSER)

    // The strip renders under the explicit prop.
    expect(composer).toMatch(/\{\s*!isGenerating\s*&&\s*showStarters\s*\?\s*<StarterDecisions\s*\/>\s*:\s*null\s*\}/)

    // And the old proxy is gone from the CODE. This is the assertion that REDs
    // if anyone reintroduces "presence of a bus means primary mount". The name
    // still appears in the prop's doc comment, which is where the defect is
    // recorded — that prose is the point, so the claim is scoped to code.
    const composerCode = codeOnly(composer)
    // Positive controls: the strip kept the real code, so the absence below is
    // a fact about the module and not about an over-eager regex.
    expect(composerCode).toContain('showStarters')
    expect(composerCode).toContain('<StarterDecisions />')
    expect(composerCode).not.toContain('blueprintEventBus')
  })

  it('⭐ ReactFlowGraph threads showStarters through, ungated by the authority table', () => {
    const graph = source(REACT_FLOW_GRAPH)

    // Declared on the public props, defaulted OFF at the inner component so a
    // mount that says nothing gets no starters BY CONSTRUCTION, not by accident.
    expect(graph).toMatch(/showStarters\?:\s*boolean/)
    expect(graph).toMatch(/showStarters\s*=\s*false/)

    // Handed to the host verbatim.
    expect(graph).toMatch(/<FloatingOlumiPanelHost[\s\S]{0,200}?showStarters=\{showStarters\}/)

    // ⛔ THE REGRESSION THIS FILE EXISTS FOR. The strip must never again be
    // routed through the mutation-authority constant: it answers "may this
    // control look like a shared-model edit?", which has nothing to do with
    // which mount is rendering. A conditional binding the two together is the
    // exact shape that shipped the strip dark.
    expect(graph).not.toMatch(/showStarters=\{[^}]*CANVAS_SEMANTIC_MUTATIONS_CONNECTED/)
    expect(graph).not.toMatch(/showStarters=\{[^}]*hasServerGraphAuthority/)
  })

  it('⭐ CanvasMVP — the primary canvas — OPTS IN', () => {
    const mvp = source(CANVAS_MVP)
    // Bound to the mount by identity: the prop must sit inside the
    // <ReactFlowGraph …> element, not merely somewhere in the file.
    expect(mvp).toMatch(/<ReactFlowGraph\b[^>]*\bshowStarters\b/)
  })

  it('⭐⭐ NO OTHER MOUNT OPTS IN — PlotWorkspace, isolation test and sandbox canvas stay starter-free', () => {
    for (const path of ALL_REACT_FLOW_GRAPH_MOUNTS) {
      if (path === CANVAS_MVP) continue
      expect(
        source(path),
        `${path} must not offer first-run starter cards — it has no first-run journey, ` +
          `and a saved-example strip over a workspace graph is a lie about what the canvas holds`,
      ).not.toContain('showStarters')
    }
  })
})
