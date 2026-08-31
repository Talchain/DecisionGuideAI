/**
 * A `fitView` node set comes from REACT FLOW'S OWN STORE, never from the canvas
 * store — enforced structurally, because the two look identical at the call site
 * and only one of them works.
 *
 * ## The defect (measured 31 Aug 2026, Chromium 1280x800, build-vs-buy)
 *
 * `ModelExtentNotice`'s "Show whole model" button did nothing at all. Not
 * "moved a bit" — the viewport transform was BYTE-IDENTICAL before and after
 * the click (`matrix(0.5, 0, 0, 0.5, 167, 61)`), with 10 of 19 nodes left
 * outside the pane and the notice still claiming "Showing 9 of 19 elements".
 * The sanctioned whole-model access under founder ruling R1 — the answer R1
 * gives to a model too tall for the pane — was inert.
 *
 * Its call looked correct, and had a long comment explaining that passing the
 * node set explicitly is "the same thing `ReactFlowGraph.handleFitView` has
 * always done". **It was not the same thing.** `handleFitView` passes
 * `getNodesRef.current()` — React Flow's nodes. The notice passed
 * `useCanvasStore(s => s.nodes)` — the canvas store's. Sourcing the list from
 * `getNodes()` instead moved the camera 0.5 -> 0.263 and put every node inside
 * the pane.
 *
 * ⚠ SCOPE, STATED EXACTLY. What is measured is that store-sourced nodes produce
 * a no-op fit and `getNodes()`-sourced nodes do not. The precise xyflow
 * internal reason (most likely that a store node carries no `measured` box, so
 * the bounds resolve degenerately) was NOT established, and this guard does not
 * rest on it. The rule stands on the measurement and on consistency with the
 * two call sites that always worked.
 *
 * ## Why a source scan and not a unit test
 *
 * The behavioural pin already exists — `e2e/visual/modelExtent.visual.spec.ts`
 * asserts the button's OUTCOME, and it caught this. But it lives in
 * `Visual Regression (advisory)`, which is red on every commit for an unrelated
 * reason (stale references failing the harness self-test), so nobody reads it.
 * A real assertion inside a permanently-red advisory job is an assertion
 * nobody sees. This scan runs in the required suite and costs milliseconds.
 *
 * The rule is derived from the bytes, not from a hand-list of call sites, so a
 * fourth `fitView` added tomorrow is covered without anyone remembering.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { blankNonCode } from '../../../tests/helpers/stripSourceComments'

const CANVAS_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const EXCLUDED_DIR_NAMES = new Set(['__tests__', '__fixtures__', '__helpers__', '__mocks__'])

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stats = statSync(full)
    if (stats.isDirectory()) {
      if (!EXCLUDED_DIR_NAMES.has(entry)) out.push(...sourceFiles(full))
      continue
    }
    if (!/\.(ts|tsx)$/.test(entry)) continue
    if (/\.(spec|test)\.(ts|tsx)$/.test(entry)) continue
    out.push(full)
  }
  return out
}

/**
 * Every `fitView({ ... nodes ... })` call site, with the identifier the node
 * list is built from.
 *
 * Deliberately shallow: it reads the `nodes` value out of the options object
 * and then resolves that identifier's assignment in the same file. A fit that
 * inlines `getNodes()` directly is matched too.
 */
interface FitSite {
  file: string
  nodesExpr: string
  /** The right-hand side the expression ultimately resolves to, if it is a local const. */
  resolved: string
}

function fitSites(): FitSite[] {
  const sites: FitSite[] = []
  for (const file of sourceFiles(CANVAS_ROOT)) {
    const code = blankNonCode(readFileSync(file, 'utf8'))
    const rel = relative(CANVAS_ROOT, file)

    // `fitView(` / `fitViewRef.current(` followed by an options object that
    // mentions `nodes`. Non-greedy to the first closing brace of the object.
    const callRe = /fitView(?:Ref\.current)?\s*\(\s*\{([\s\S]*?)\}\s*\)/g
    let m: RegExpExecArray | null
    while ((m = callRe.exec(code)) !== null) {
      const opts = m[1]
      if (!/\bnodes\b/.test(opts)) continue

      // Either `nodes: <expr>` or a shorthand `{ nodes }`.
      const explicit = /\bnodes\s*:\s*([A-Za-z_$][\w$]*)/.exec(opts)
      const nodesExpr = explicit ? explicit[1] : 'nodes'

      // Resolve the identifier to its NEAREST PRECEDING declaration.
      //
      // ⚠ A whole-file search is wrong and produced a false RED on two
      // CORRECT call sites: both `ReactFlowGraph` and `CommandPalette` hold a
      // component-level `const nodes = useCanvasStore(s => s.nodes)` for
      // rendering, and separately build a `const nodes = getNodes()` inside the
      // fit callback. Matching the first declaration in the file reported the
      // render-time one and accused two working fits. Scanning backwards from
      // the call site takes the one actually in scope.
      const before = code.slice(0, m.index)
      const declRe = new RegExp(`\\b(?:const|let)\\s+${nodesExpr}\\s*=\\s*([^\\n]+)`, 'g')
      let decl: RegExpExecArray | null
      let resolved = nodesExpr
      while ((decl = declRe.exec(before)) !== null) resolved = decl[1]
      sites.push({ file: rel, nodesExpr, resolved })
    }
  }
  return sites
}

describe('a fitView node set is sourced from React Flow, never the canvas store', () => {
  it('finds the fit call sites at all — the scan is not silently matching nothing', () => {
    const sites = fitSites()
    // A positive control. If this ever reads 0, the regex has stopped
    // discriminating and every assertion below is vacuous (CLAUDE.md trap 13).
    expect(sites.length, 'the scan found no fitView call passing a node set').toBeGreaterThanOrEqual(3)
  })

  /**
   * Fit call sites whose node list is NOT built from `getNodes()`.
   *
   * ⚠ SHIPPED AS AN EXPLICIT KNOWN SET, NOT SILENTLY EXCLUDED. Every member is
   * a `useFocusCamera` FOCUS move (frame a plan's focus nodes, frame an edge's
   * two endpoints) sourcing from `useCanvasStore.getState()` — the same source
   * that made "Show whole model" a no-op. **Whether focus is affected has NOT
   * been measured**, and this file will not assert either way about code it did
   * not drive: a whole-graph fit and a two-node focus resolve different bounds,
   * and the one thing today proved is how easily an unmeasured claim about this
   * seam goes wrong.
   *
   * The set is pinned EXACTLY so the suite stays green for the right reason and
   * REDs if it GROWS (a new store-sourced fit) or SHRINKS (one was fixed and
   * this note is now stale). Do not add to it to make a test pass.
   */
  const KNOWN_NOT_GET_NODES = [
    'hooks/useFocusCamera.ts',
  ]

  it('every whole-graph fit target list is built from getNodes()', () => {
    const offenders = fitSites()
      .filter((s) => !/getNodes(Ref)?\s*[.(]/.test(s.resolved))
      .filter((s) => !KNOWN_NOT_GET_NODES.includes(s.file))

    expect(
      offenders.map((o) => `${o.file}: nodes = ${o.resolved.trim()}`),
      'a fitView node set that does not come from getNodes() — a store-sourced list made "Show whole model" a silent no-op',
    ).toEqual([])
  })

  it('the known store-sourced set is exactly what it claims — no more, no fewer', () => {
    const notGetNodes = [...new Set(
      fitSites()
        .filter((s) => !/getNodes(Ref)?\s*[.(]/.test(s.resolved))
        .map((s) => s.file),
    )].sort()

    // REDs on growth (a new one crept in) AND on shrinkage (one was fixed and
    // the note above is now lying about the state of the codebase).
    expect(notGetNodes, 'the known store-sourced fit set has moved').toEqual([...KNOWN_NOT_GET_NODES].sort())
  })
})
