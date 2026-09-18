/**
 * ⭐⭐ `linkedOptionIds` — "which options are linked to this node", pinned in
 * both directions.
 *
 * ⚠ UNRUN AT THE TIME OF WRITING. No suite, no typecheck and no browser was
 * executed for this file — the cost constraints on the lane barred all three.
 * CI is the authority on whether it passes; it is written to be RED against the
 * predicate it replaces (`edges.some(e => e.source === id)`), which is the only
 * claim being made for it here.
 *
 * ── WHAT THIS FILE PINS THAT NO OTHER FILE DOES ────────────────────────────
 *  1. BOTH DIRECTIONS. An `option → decision` edge is an option link — the rule
 *     `DecisionPanel.tsx:66-77` already ruled for this state (review D3), not a
 *     second answer invented for the pill.
 *  2. THE MIRROR. An outgoing edge to a NON-option is not an option link, so a
 *     `decision → outcome` edge cannot silently satisfy the question.
 *  3. THE SHARED KIND CHAIN. A node whose kind lives only in `data.kind`
 *     resolves through `resolveNodeTypeLiteral`. The contrast is written out:
 *     the private `type || data.type` spelling this repo carries in three other
 *     places returns NOTHING on that node, so this case is what a private
 *     predicate would have got wrong.
 *  4. THE DEDUPE, which is reachable rather than defensive — `applyPatch.ts`
 *     appends CEE-supplied edges with no duplicate check, and `useModelHealth`
 *     already warns about the result.
 *
 * ⚠ SCOPE. These are pure-function assertions. They say nothing about what any
 * surface renders; the rendered claim is pinned in
 * `BaseNode.needsJudgementBadge.spec.tsx` §6, and neither file substitutes for
 * the other.
 */
import { describe, it, expect } from 'vitest'
import { linkedOptionIds } from '../linkedOptions'

const DECISION = { id: 'dec_1', type: 'decision', data: { type: 'decision', label: 'Platform choice' } }
const OPTION_A = { id: 'opt_a', type: 'option', data: { type: 'option', label: 'Rebuild' } }
const OPTION_B = { id: 'opt_b', type: 'option', data: { type: 'option', label: 'Buy' } }
const OUTCOME = { id: 'out_1', type: 'outcome', data: { type: 'outcome', label: 'Margin' } }

/** An option whose kind is seeded ONLY in `data.kind` — a real seeding location
 *  (`resolveNodeTypeLiteral`'s header records the store, the wire and the
 *  importers each using a different one). */
const OPTION_BY_DATA_KIND = { id: 'opt_kind', data: { kind: 'option', label: 'Partner' } }

describe('linkedOptionIds — the fact behind "Nothing to compare yet"', () => {
  it('counts an OUTGOING decision → option edge', () => {
    expect(linkedOptionIds([DECISION, OPTION_A], [{ source: DECISION.id, target: OPTION_A.id }], DECISION.id))
      .toEqual([OPTION_A.id])
  })

  it('⭐ counts an INCOMING option → decision edge — the case the old predicate denied', () => {
    const edges = [{ source: OPTION_A.id, target: DECISION.id }]
    // The discrimination, stated: the predicate this replaces reads FALSE here,
    // so a green result below is this function's doing and not the fixture's.
    expect(edges.some(e => e.source === DECISION.id)).toBe(false)
    expect(linkedOptionIds([DECISION, OPTION_A], edges, DECISION.id)).toEqual([OPTION_A.id])
  })

  it('⭐ MIRROR — an outgoing edge to a NON-option is not an option link', () => {
    const edges = [{ source: DECISION.id, target: OUTCOME.id }]
    // Opposite direction of the same defect: the old predicate reads TRUE here
    // and suppressed the pill on a decision with nothing to compare.
    expect(edges.some(e => e.source === DECISION.id)).toBe(true)
    expect(linkedOptionIds([DECISION, OUTCOME], edges, DECISION.id)).toEqual([])
  })

  it('⭐ resolves kind through the estate\'s ONE chain — an option seeded via `data.kind` counts', () => {
    const nodes = [DECISION, OPTION_BY_DATA_KIND]
    const edges = [{ source: DECISION.id, target: OPTION_BY_DATA_KIND.id }]

    // THE CONTRAST THAT MAKES THIS CASE WORTH SPENDING. The private spelling
    // carried elsewhere in this repo — `n.type === 'option' || n.data?.type ===
    // 'option'` — sees nothing on this node. Written out rather than described,
    // so the case cannot quietly become a tautology if the fixture drifts.
    const privateSpelling = (n: { type?: string; data?: unknown }) =>
      n.type === 'option' || (n.data as { type?: string } | undefined)?.type === 'option'
    expect(privateSpelling(OPTION_BY_DATA_KIND)).toBe(false)

    expect(linkedOptionIds(nodes, edges, DECISION.id)).toEqual([OPTION_BY_DATA_KIND.id])
  })

  it('returns nothing for a kind outside the taxonomy — fails closed, never guesses', () => {
    const widget = { id: 'wid_1', type: 'widget', data: { type: 'widget' } }
    expect(linkedOptionIds([DECISION, widget], [{ source: DECISION.id, target: widget.id }], DECISION.id))
      .toEqual([])
  })

  it('⭐ DEDUPES BY OPTION, not by edge — two edges to one option are one option', () => {
    const edges = [
      { source: DECISION.id, target: OPTION_A.id },
      { source: DECISION.id, target: OPTION_A.id },
    ]
    expect(linkedOptionIds([DECISION, OPTION_A], edges, DECISION.id)).toEqual([OPTION_A.id])
  })

  it('dedupes across DIRECTIONS too — one option joined both ways is one option', () => {
    const edges = [
      { source: DECISION.id, target: OPTION_A.id },
      { source: OPTION_A.id, target: DECISION.id },
    ]
    expect(linkedOptionIds([DECISION, OPTION_A], edges, DECISION.id)).toEqual([OPTION_A.id])
  })

  it('keeps distinct options distinct, in edge order', () => {
    const edges = [
      { source: DECISION.id, target: OPTION_B.id },
      { source: OPTION_A.id, target: DECISION.id },
    ]
    expect(linkedOptionIds([DECISION, OPTION_A, OPTION_B], edges, DECISION.id))
      .toEqual([OPTION_B.id, OPTION_A.id])
  })

  it('an edge to an id no node carries names no option', () => {
    expect(linkedOptionIds([DECISION], [{ source: DECISION.id, target: 'ghost' }], DECISION.id))
      .toEqual([])
  })

  it('ignores a self-loop — a node is not its own option', () => {
    expect(linkedOptionIds([DECISION], [{ source: DECISION.id, target: DECISION.id }], DECISION.id))
      .toEqual([])
  })

  it('ignores edges that touch neither end of this node', () => {
    expect(linkedOptionIds([DECISION, OPTION_A, OPTION_B], [{ source: OPTION_A.id, target: OPTION_B.id }], DECISION.id))
      .toEqual([])
  })

  it('survives absent slices rather than taking the canvas down with it', () => {
    expect(linkedOptionIds(undefined, undefined, DECISION.id)).toEqual([])
    expect(linkedOptionIds(null, [{ source: DECISION.id, target: OPTION_A.id }], DECISION.id)).toEqual([])
    expect(linkedOptionIds([DECISION, OPTION_A], null, DECISION.id)).toEqual([])
    expect(linkedOptionIds([DECISION, OPTION_A], [{ source: DECISION.id, target: OPTION_A.id }], '')).toEqual([])
  })
})
