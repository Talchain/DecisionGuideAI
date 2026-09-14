/**
 * ⭐⭐ A HUMAN CAN DRAW A LINK ON THEIR OWN MODEL — the four edge-draw sites are
 * judged by the EDGE-ADD carrier, not by the blanket semantic-mutations key.
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────
 * Witnessed on served `a518dca8` before this change: dragging between two
 * unconnected handles produced NO connection line, edges 24 → 24 at 1.5s/4s/8s
 * /15s, and ZERO turn calls. Not refused, not undone — INERT. `nodesConnectable`
 * was false, so `onConnect` never ran.
 *
 * ⭐ AND THAT IS WHY THIS IS NOT MERELY "PERMIT A GESTURE". `store.addEdge`
 * already announces `needs_strength` when the capture stands down, and that
 * toast reaches a live listener (`ReactFlowGraph.tsx` `topbar:show-toast`). With
 * the drag disabled the sentence could never fire. Opening these four sites is
 * what turns a silent nothing into an explained something.
 *
 * ── WHY A SIBLING KEY AND NOT A FLIP ───────────────────────────────────────
 * `canvasSemanticMutations` also gates undo, redo, paste, the blueprint insert
 * and the whole `add-` palette — observed live: `buildPaneMenu` emits SEVEN
 * top-level entries and the served menu shows FOUR. Flipping it would open all
 * of them, five with no durable carrier. The edge add has its own carrier now
 * (CEE `structural_add_edge: 'mutating'`, `dispatch.ts:373`, merged as #1443),
 * so it gets its own key — the same split #1538 used for the node add.
 *
 * ⚠ WHAT THIS FILE DOES NOT CLAIM: that a drawn edge PERSISTS. A bare drag
 * stands down with `strength_not_stated` by design, because sending
 * `USER_EDGE_DEFAULTS.weight = 0.3` would assert a strength the user never
 * stated. The durable path needs a stated strength; this file pins the GATE.
 */
import { describe, it, expect } from 'vitest'
import { CANONICAL_EDIT_AUTHORITY, hasServerGraphAuthority } from '../mutations/mutationAuthority'

describe('the edge-add carrier is judged apart from the blanket semantic key', () => {
  it('CONTRAST CONTROL: the blanket key is still shut, so this is a split not a flip', () => {
    // If this ever reads server_graph, the test below stops discriminating and
    // the whole file must be re-derived (CLAUDE.md trap 12b).
    expect(CANONICAL_EDIT_AUTHORITY.canvasSemanticMutations).toBe('disabled')
  })

  it('⭐ the edge add has its OWN authority key, and it is live', () => {
    expect(CANONICAL_EDIT_AUTHORITY.canvasEdgeAddWithServerHash).toBe('server_graph')
    expect(hasServerGraphAuthority(CANONICAL_EDIT_AUTHORITY.canvasEdgeAddWithServerHash)).toBe(true)
  })

  it('OPPOSITE DIRECTION: the carrierless neighbours are NOT opened by it', () => {
    // undo/redo/paste/blueprint ride the blanket key and must stay shut. This is
    // the assertion that REDs if someone "simplifies" the two keys back into one.
    expect(hasServerGraphAuthority(CANONICAL_EDIT_AUTHORITY.canvasSemanticMutations)).toBe(false)
    expect(CANONICAL_EDIT_AUTHORITY.canvasEdgeAddWithServerHash).not.toBe(
      CANONICAL_EDIT_AUTHORITY.canvasSemanticMutations,
    )
  })
})
