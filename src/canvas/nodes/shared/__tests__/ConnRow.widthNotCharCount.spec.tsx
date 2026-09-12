/**
 * ⛔ A CONNECTION ROW MUST BE CUT BY THE CARD'S WIDTH, NOT BY A CHARACTER COUNT.
 *
 * `ConnRow` truncated twice: a JS cut at a hardcoded 30 characters, AND
 * Tailwind's `truncate` (overflow-hidden + text-overflow-ellipsis) on the same
 * span. The CSS one is width-aware and correct. The JS one runs FIRST and knows
 * nothing about the card, so widening the card could never reveal another
 * character — which is exactly what was observed after #1527 took
 * `NODE_CARD_MAX_W` 320 -> 336 and the same labels went on ending in "...".
 *
 * ⚠ THE HEADER OF `ConnRow.tsx` IS DETAILED AND SAYS NOTHING ABOUT THE 30.
 * In this estate a deliberate constraint is stated where it is made; an
 * undocumented literal beside a documented decision is the tell. No spec pinned
 * it either — checked before removing it.
 *
 * ⚠⚠ SCOPE OF THE IMPACT, STATED BECAUSE THE OBVIOUS FIGURE OVERSTATES IT.
 * 43 of the 87 node labels across the five shipped starters (49%) are longer
 * than 30 characters, so 49% is the share of LABELS the cut would truncate
 * WHENEVER A ROW RENDERS ONE. It is NOT the share of canvas text a user sees
 * cut: `useNodeConnections.ts:35` returns `[]` unless
 * `results.status === 'complete'`, so ConnRow does not mount at all before an
 * analysis, and each host caps the list at 3 rows. Derived, not assumed — a
 * browser probe against a seeded pre-analysis starter found ZERO ConnRows, and
 * a zero from a probe is "unmeasured" until you know why.
 *
 * ⛔ NARROWER STILL, DERIVED AFTER THE ABOVE WAS WRITTEN. A ConnRow needs BOTH
 * a completed analysis AND EXPERT VIEW MODE: the block sits in
 * `postAnalysisLayer2`, rendered at `FactorNode.tsx:931` as
 * `{isDetailed && layer2Content}`, where `isDetailed = viewMode === 'expert'`
 * (`:57`). `viewMode` defaults to `'standard'`. So the reach of this fix is
 * expert-mode users after a run — real, and narrow.
 *
 * ⚠ The block's own comment says "max 3 whole rows in BOTH views" and that
 * means the two PHASE views, not compact/detailed. Misreading it cost a ROADMAP
 * row that had to be withdrawn the same night (2.1396). Recorded here because
 * the next person will read the same sentence.
 *
 * That is CLAUDE.md trap 16's inverse: reachability inside a component is not
 * reachability in the product. The defect is real and the fix is right; saying
 * exactly who sees it is the difference between a measurement and a claim.
 *
 * ⭐ WHY THIS IS NOT "just delete a line": removing a truncation is exactly the
 * change that can leak an unbounded string into a fixed-width card. So this
 * pins BOTH halves — the text is whole in the DOM, and the element still
 * carries the width-bound clip that keeps it inside the card.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ConnRow } from '../ConnRow'

/** 47 chars — longer than the old cut, and a real shape from the shipped starters. */
const LONG = 'RudderStack Platform Capability and Fit Review'

describe('ConnRow is cut by width, never by a character count', () => {
  it('⛔ renders the WHOLE label, with no JS-inserted ellipsis', () => {
    render(<ConnRow edgeId="e1" nodeKind="factor" label={LONG} confidencePct={80} />)
    const link = screen.getByTitle(LONG)
    expect(link.textContent).toBe(LONG)
    expect(link.textContent).not.toMatch(/\.\.\.|…/)
  })

  it('⭐ AND STILL CARRIES THE WIDTH-BOUND CLIP — the half a bare deletion would lose', () => {
    // Without this, "render the whole label" is satisfied by a row that
    // overflows its card and pushes the confidence figure off the edge.
    render(<ConnRow edgeId="e2" nodeKind="factor" label={LONG} confidencePct={80} />)
    const link = screen.getByTitle(LONG)
    expect(link.className).toContain('truncate')
    expect(link.className).toContain('flex-1')
  })

  it('CONTRAST CONTROL: a short label is untouched, so the assertion above is about LENGTH', () => {
    const SHORT = 'Data Team'
    render(<ConnRow edgeId="e3" nodeKind="factor" label={SHORT} confidencePct={null} />)
    expect(screen.getByTitle(SHORT).textContent).toBe(SHORT)
  })

  it('the full label stays available on hover regardless of what is painted', () => {
    render(<ConnRow edgeId="e4" nodeKind="factor" label={LONG} confidencePct={12} />)
    expect(screen.getByTitle(LONG)).toBeTruthy()
  })
})
