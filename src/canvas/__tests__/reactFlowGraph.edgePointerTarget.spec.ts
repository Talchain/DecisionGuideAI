/**
 * F8 — THE CALL SITES: `ReactFlowGraph`'s edge click and right-click go through
 * the nearest-line re-point (review r08 blocker 2).
 *
 * The reviewer measured that restoring `ReactFlowGraph.tsx` to its base left
 * every F8 test green: the specs drove the pure resolver and the hover arbiter,
 * and nothing bound the two handlers to them. The handler bodies are now
 * `retargetEdgeClick` and `resolveContextMenuEdge` (`edges/edgePointerTarget.ts`),
 * DRIVEN in `edges/__tests__/edgePointerTarget.spec.ts`. This file pins the one
 * step that spec cannot execute — that the component calls them, with the
 * pointer event, xyflow's edge, xyflow's store and the canvas store — the
 * precedent being `reactFlowGraph.restoreScenarioBinding.spec.ts` §3.
 *
 * ⚠ WHAT THIS DOES NOT PROVE: it is a SOURCE scan, not an execution. It reads
 * each handler's own body (brace-matched from its declaration, comments
 * stripped), binds each call by its exact arguments, and carries a negative
 * control for every mutation it claims to catch — a `toContain` on a string
 * that also occurs elsewhere is not a binding.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const SOURCE_PATH = join(HERE, '..', 'ReactFlowGraph.tsx')

/** Line and block comments removed, so a commented-out call is not a call. */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1')
}

/**
 * The body of the arrow function declared at `anchor` — brace-matched from the
 * `=> {` that follows it, so a type literal in the parameters is skipped. Null
 * when the anchor is absent; the tests treat that as a failure, never a pass.
 */
function arrowBody(source: string, anchor: string): string | null {
  const at = source.indexOf(anchor)
  if (at === -1) return null
  const arrow = source.indexOf('=> {', at)
  if (arrow === -1) return null
  const open = arrow + 3
  let depth = 0
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++
    else if (source[i] === '}') {
      depth--
      if (depth === 0) return source.slice(open, i + 1)
    }
  }
  return null
}

const SOURCE = stripComments(readFileSync(SOURCE_PATH, 'utf8'))
const CLICK = arrowBody(SOURCE, 'const handleEdgeClick = useCallback(')
const MENU = arrowBody(SOURCE, 'const onEdgeContextMenu = useCallback(')

const CLICK_CALL = /\bretargetEdgeClick\(\s*event\s*,\s*edge\s*,\s*flowStoreApi\.getState\(\)\s*\)/
const MENU_CALL = /\bconst\s+menuEdge\s*=\s*resolveContextMenuEdge\(\s*event\s*,\s*edge\s*,\s*storeEdges\s*\)/
const MENU_STORE = /\{\s*nodes\s*,\s*edges\s*:\s*storeEdges\s*\}\s*=\s*useCanvasStore\.getState\(\)/
const MENU_TARGET =
  /setContextMenuTarget\(\{\s*kind:\s*'edge'\s*,\s*edgeId:\s*menuEdge\.id\s*,\s*edge:\s*menuEdge\s*,\s*isStructural:\s*isStructuralEdge\(\s*menuEdge\s*,/

describe('instrument checks (not claims)', () => {
  it('each handler body was found, and is non-trivial', () => {
    expect(CLICK).not.toBeNull()
    expect(MENU).not.toBeNull()
    // Both calls live INSIDE these bodies; a body cut short at a stray brace
    // would read as "no call". (Thresholds sit below the base bodies' own
    // lengths, so a revert fails the claims below, not this check.)
    // S.1 for links (Paul, 4 Oct 2026; reverses #2322's E2 mini-editor): the body now ENDS by setting the full
    // inspector from the click rule — a plain click on a link opens it, as a click on a card does. (Was: it ended by
    // closing the inspector, `setShowFullInspector(false)`, because a click opened the at-pointer mini-editor.)
    expect(CLICK as string).toMatch(/onCanvasInteraction\?\.\(\)[\s\S]*setShowFullInspector\(\s*edgeClickOpensInspector\([\s\S]*?\)\s*\)\s*\}$/)
    expect(MENU as string).toMatch(/event\.preventDefault\(\)[\s\S]*setContextMenuTarget\(/)
    expect((MENU as string).length).toBeGreaterThan(300)
  })

  it('comment stripping removes a commented-out call and keeps a live one', () => {
    expect(CLICK_CALL.test(stripComments('// retargetEdgeClick(event, edge, flowStoreApi.getState())'))).toBe(false)
    expect(CLICK_CALL.test(stripComments('/* retargetEdgeClick(event, edge, flowStoreApi.getState()) */'))).toBe(false)
    expect(CLICK_CALL.test(stripComments("x // note\nretargetEdgeClick(event, edge, flowStoreApi.getState())"))).toBe(true)
  })
})

describe('the click: handleEdgeClick re-points through retargetEdgeClick', () => {
  it('the matcher binds the exact arguments (positive and negative controls)', () => {
    expect(CLICK_CALL.test('retargetEdgeClick(event, edge, flowStoreApi.getState())')).toBe(true)
    expect(CLICK_CALL.test('retargetEdgeClick(undefined, edge, flowStoreApi.getState())')).toBe(false)
    expect(CLICK_CALL.test('retargetEdgeClick(event, undefined, flowStoreApi.getState())')).toBe(false)
    expect(CLICK_CALL.test('retargetEdgeClick(event, edge, {})')).toBe(false)
  })

  it('handleEdgeClick takes (event, edge) and calls retargetEdgeClick with them and xyflow\'s store', () => {
    expect(CLICK_CALL.test(CLICK as string)).toBe(true)
    expect(SOURCE).toMatch(/const handleEdgeClick = useCallback\(\(\s*event\?:[^,]+,\s*edge\?:/)
    expect(SOURCE).toMatch(/const flowStoreApi = useStoreApi\(\)/)
    expect(SOURCE).toMatch(/import \{[^}]*\bretargetEdgeClick\b[^}]*\} from '\.\/edges\/edgePointerTarget'/)
  })

  it('the canvas binds it: every onEdgeClick is handleEdgeClick, and there is one', () => {
    const bindings = SOURCE.match(/onEdgeClick=\{[^}]*\}/g) ?? []
    expect(bindings.length).toBeGreaterThan(0)
    expect(new Set(bindings)).toEqual(new Set(['onEdgeClick={handleEdgeClick}']))
  })
})

const OPEN_CALL =
  /setShowFullInspector\(\s*edgeClickOpensInspector\(\s*event\s*,\s*intendedId\s*,\s*flowStoreApi\.getState\(\)\.multiSelectionActive\s*\)\s*\)/

describe('S.1 for links (Paul, 4 Oct 2026): one click opens the full link inspector for the POINTED-AT link', () => {
  it('the matcher binds the exact arguments (positive and negative controls)', () => {
    expect(OPEN_CALL.test('setShowFullInspector(edgeClickOpensInspector(event, intendedId, flowStoreApi.getState().multiSelectionActive))')).toBe(true)
    // the first selected edge instead of the resolver's return (PR Review 5897003679)
    expect(OPEN_CALL.test('setShowFullInspector(edgeClickOpensInspector(event, edge?.id ?? null, flowStoreApi.getState().multiSelectionActive))')).toBe(false)
    // the multi-selection gesture dropped (PR Review 5897538379)
    expect(OPEN_CALL.test('setShowFullInspector(edgeClickOpensInspector(event, intendedId, false))')).toBe(false)
    expect(OPEN_CALL.test('setShowFullInspector(true)')).toBe(false)
  })

  it('handleEdgeClick opens the inspector through the click rule, on the resolver\'s return', () => {
    expect(OPEN_CALL.test(CLICK as string)).toBe(true)
    expect(CLICK as string).toMatch(/const\s+intendedId\s*=\s*retargetEdgeClick\(/)
    expect(SOURCE).toMatch(/import \{[^}]*\bedgeClickOpensInspector\b[^}]*\} from '\.\/edges\/edgePointerTarget'/)
  })

  it('never picks the link by "first selected edge" (carried from the retired mini-editor spec)', () => {
    expect(CLICK as string).not.toMatch(/\.find\(\s*\(?\s*e\s*\)?\s*=>\s*e\.selected\s*\)/)
  })

  it('the retired at-pointer mini-editor is gone from the canvas — click no longer closes the inspector', () => {
    expect(CLICK as string).not.toMatch(/setShowFullInspector\(\s*false\s*\)/)
    expect(SOURCE).not.toMatch(/openLinkQuickEditForClick|LinkQuickEditorHost|useLinkQuickEditStore/)
  })

  it('CONTRAST — the double-click still opens the full inspector', () => {
    const dbl = arrowBody(SOURCE, 'const handleEdgeDoubleClick = useCallback(')
    expect(dbl).not.toBeNull()
    expect(dbl as string).toMatch(/setShowFullInspector\(\s*true\s*\)/)
  })
})

describe('the right-click: onEdgeContextMenu opens its menu on the nearest line, from the store', () => {
  it('the matchers bind the exact arguments (positive and negative controls)', () => {
    expect(MENU_CALL.test('const menuEdge = resolveContextMenuEdge(event, edge, storeEdges)')).toBe(true)
    expect(MENU_CALL.test('const menuEdge = resolveContextMenuEdge(event, edge, [])')).toBe(false)
    expect(MENU_TARGET.test("setContextMenuTarget({ kind: 'edge', edgeId: menuEdge.id, edge: menuEdge, isStructural: isStructuralEdge(menuEdge, g)")).toBe(true)
    // The base shape — xyflow's topmost edge — must NOT satisfy it.
    expect(MENU_TARGET.test("setContextMenuTarget({ kind: 'edge', edgeId: edge.id, edge, isStructural: isStructuralEdge(edge, g)")).toBe(false)
    expect(MENU_TARGET.test("setContextMenuTarget({ kind: 'edge', edgeId: menuEdge.id, edge, isStructural: isStructuralEdge(menuEdge, g)")).toBe(false)
  })

  it('the handler resolves the menu edge from the canvas store and hands THAT edge to the menu', () => {
    const body = MENU as string
    expect(MENU_STORE.test(body)).toBe(true)
    expect(MENU_CALL.test(body)).toBe(true)
    expect(MENU_TARGET.test(body)).toBe(true)
    // …and nothing in it still reads xyflow's edge id for the target.
    expect(body).not.toMatch(/edgeId:\s*edge\.id/)
    expect(SOURCE).toMatch(/import \{[^}]*\bresolveContextMenuEdge\b[^}]*\} from '\.\/edges\/edgePointerTarget'/)
  })

  it('the canvas binds it: every onEdgeContextMenu is onEdgeContextMenu, and there is one', () => {
    const bindings = SOURCE.match(/onEdgeContextMenu=\{[^}]*\}/g) ?? []
    expect(bindings.length).toBeGreaterThan(0)
    expect(new Set(bindings)).toEqual(new Set(['onEdgeContextMenu={onEdgeContextMenu}']))
  })
})
