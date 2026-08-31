/**
 * ⭐ THE REASONING FRONTIER'S MOUNT PATH — bound, not documented.
 *
 * The frontier is the one component on this canvas built to help a team think
 * of what the model does NOT yet contain: a door at the end of each tier that
 * asks Olumi a question. It was written, tested, and reached NO USER, for the
 * dullest possible reason — `enableGhostSuggestions` defaults to `false` and
 * was passed `true` by nothing in the repository.
 *
 * Confirmed on the deployed build before this change: zero frontier doors
 * against thirteen real nodes, with a control proving the probe could see nodes
 * at all. A lane (mine) had even edited the placement logic inside it that same
 * day without noticing it was unreachable — maintained-looking dead code
 * attracting fixes, which is exactly how it stays dark.
 *
 * This file pins the two properties that keep it live and keep it scoped:
 * the primary canvas opts in, and no other mount does.
 *
 * ── WHY SOURCE-DERIVED (house pattern: starterStripMountPath) ──
 * A render test proves the doors work under props the TEST supplies — which is
 * precisely the evidence that stayed green through the whole period they were
 * dark. What needs pinning is a property of the SOURCE: that the opt-in exists
 * at the mount, and that it is not routed through anything a deployment, a flag
 * or an authority table can move. Reading the source is the only way to assert
 * the ABSENCE of a gate rather than the presence of one path through it.
 *
 * ⚠ EVERY FILE READ IS ASSERTED NON-EMPTY BEFORE ANY MATCH IS BELIEVED.
 * `expect(...).not.toContain(...)` passes beautifully against an empty string,
 * and an extraction that silently produced nothing agrees with every other
 * extraction that produced nothing.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(__dirname, '../../../..')

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

/** Strip comments so an absence claim is about CODE, not about prose — the
 *  files below name `enableGhostSuggestions` in the comments that explain why
 *  they do or do not opt in, and deleting that record to satisfy a text match
 *  would trade the explanation for a green test. */
function codeOnly(text: string): string {
  const stripped = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
  if (stripped.trim().length < 200) {
    throw new Error(`comment strip left ${stripped.trim().length} chars — refusing to assert`)
  }
  return stripped
}

const CANVAS_MVP = 'src/routes/CanvasMVP.tsx'
const PLOT_WORKSPACE = 'src/routes/PlotWorkspace.tsx'
const CANVAS_ISOLATION_TEST = 'src/routes/CanvasIsolationTest.tsx'
const COPILOT_CANVAS = 'src/pages/sandbox-guide/components/canvas/CopilotCanvas.tsx'

/** Every file that mounts <ReactFlowGraph>. Exactly one may opt in. */
const ALL_MOUNTS = [CANVAS_MVP, PLOT_WORKSPACE, CANVAS_ISOLATION_TEST, COPILOT_CANVAS] as const
const OTHER_MOUNTS = [PLOT_WORKSPACE, CANVAS_ISOLATION_TEST, COPILOT_CANVAS] as const

describe('the reasoning frontier’s mount path', () => {
  it('POSITIVE + NEGATIVE CONTROL — the detector reads real bytes and discriminates', () => {
    const mvp = codeOnly(source(CANVAS_MVP))
    expect(mvp).toContain('ReactFlowGraph')
    // A fabricated name must NOT match. Without this, a detector that matched
    // everything would pass every assertion below.
    expect(mvp).not.toContain('enableGhostSuggestionsV99Fabricated')
  })

  it('CONTROL — every listed mount really does mount ReactFlowGraph', () => {
    // Pins this file's own precondition. If a file merely stopped mounting the
    // graph, the negative assertions below would start passing for the wrong
    // reason — a guard agreeing with itself (trap 13b).
    for (const path of ALL_MOUNTS) {
      expect(source(path), `${path} no longer mounts ReactFlowGraph`).toMatch(/<ReactFlowGraph\b/)
    }
  })

  it('⭐ the primary canvas opts IN — this is the assertion that would have caught the dark period', () => {
    const mvp = codeOnly(source(CANVAS_MVP))
    // On the element itself, not merely somewhere in the file: a mention in an
    // unrelated helper would satisfy a loose match while the prop stayed off.
    expect(mvp).toMatch(/<ReactFlowGraph\b[^>]*\benableGhostSuggestions\b/)
  })

  it('the opt-in is a LITERAL prop, not routed through a flag or authority table', () => {
    // The starter strip was dark because its gate was proxied through
    // `CANVAS_SEMANTIC_MUTATIONS_CONNECTED`, a permanently-false authority
    // constant — a gate about mutation authority silently switching off a gate
    // about which mount you are (trap 21). This asserts the frontier's opt-in
    // cannot be moved the same way: bare prop, no `={...}` expression.
    const mvp = codeOnly(source(CANVAS_MVP))
    expect(mvp).not.toMatch(/enableGhostSuggestions\s*=\s*\{/)
  })

  it('no OTHER mount gains the frontier', () => {
    for (const path of OTHER_MOUNTS) {
      expect(
        codeOnly(source(path)),
        `${path} must not opt into the reasoning frontier`,
      ).not.toContain('enableGhostSuggestions')
    }
  })

  it('the prop still defaults OFF, so a new mount is dark until it says otherwise', () => {
    const graph = codeOnly(source('src/canvas/ReactFlowGraph.tsx'))
    expect(graph).toMatch(/enableGhostSuggestions\s*=\s*false/)
  })
})
