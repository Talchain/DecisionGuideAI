/**
 * ⛔⛔ CREATING THE ZONES DELETED THE VERTICAL RHYTHM INSIDE THEM.
 *
 * Measured on served `a147cfbb`, guest, analysed model, sections at rest:
 *
 *   BETWEEN zones           16px · 16px · 16px · 16px
 *   WITHIN the answer zone   0px ·  0px ·  0px ·  0px
 *
 * Five blocks — three of them bordered cards — stack with ZERO separation and
 * read as one continuous ruled wall. That is what makes the panel read as a
 * dense diagnostic report rather than a designed surface.
 *
 * ⭐ THE CAUSE IS CAUSAL, NOT CORRELATIONAL, AND IT IS #1647. Before it
 * (`315d7982^`), `AtAGlance`, `TrustLine` and `RobustnessCaveat` were DIRECT
 * children of the content column and each took its `space-y-4`. #1647 wrapped
 * them in `<div data-testid="analysis-new-zone-*-group">` carrying NO className
 * at all, which removed them from that rhythm. The column's own class is
 * BYTE-IDENTICAL across both commits — so the wrapper is the cause, not a
 * change in the column.
 *
 * ⚠ Nothing could have caught it: a green suite cannot see a pixel, and the
 * estate's visual job has had a stale baseline for 120+ commits.
 *
 * ── WHY 12px AND NOT 16 ────────────────────────────────────────────────────
 * The zones are separated by 16px. If the gap INSIDE a zone equalled the gap
 * BETWEEN zones, the groups would stop reading as groups — the grouping #1647
 * exists to create would be invisible. So within-zone must be strictly below
 * between-zone, and 12px is the next step down on `SHELL_SPACING_SCALE_PX`.
 * It also matches the cards' own 12px radius and horizontal padding.
 *
 * Measured on the deployed build before writing this: 8px -> +5.5%,
 * 12px -> +8.7%, 16px -> +11.9% panel height. All three keep the same blocks in
 * the first viewport, so the choice is a grammar question, not a fold one.
 *
 * ── WHAT THIS SPEC CAN AND CANNOT CLAIM ────────────────────────────────────
 * jsdom applies no CSS and cannot measure a gap (trap 3). It asserts the
 * STRUCTURAL facts that produce it and are checkable, and it DERIVES the
 * relationship from the source rather than restating either number — so a lane
 * that later changes the column's rhythm cannot leave the zones behind again.
 */
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

import { SHELL_SPACING_SCALE_PX } from '../../../../canvas/components/workspaceShell/shellContract'

const SOURCE = path.resolve(__dirname, '../AnalysisNewTabBody.tsx')
const src = fs.readFileSync(SOURCE, 'utf8')

/** `space-y-3` -> 12. Tailwind's step is n × 4px. */
const stepToPx = (step: string): number => Number(step) * 4

function columnRhythmPx(): number {
  const m = src.match(/className="px-4 py-4 space-y-(\d+) max-w-\[440px\] mx-auto"/)
  if (m === null) throw new Error('content column not found — the anchor this spec derives from moved')
  return stepToPx(m[1])
}

function zoneRhythms(): Array<{ zone: string; px: number | null }> {
  const zones = [...src.matchAll(/<div\s+className="([^"]*)"\s+data-testid="analysis-new-zone-(\w+)-group">/g)]
  const bare = [...src.matchAll(/<div\s+data-testid="analysis-new-zone-(\w+)-group">/g)]
  return [
    ...zones.map((m) => {
      const s = m[1].match(/space-y-(\d+)/)
      return { zone: m[2], px: s === null ? null : stepToPx(s[1]) }
    }),
    ...bare.map((m) => ({ zone: m[1], px: null })),
  ]
}

describe('every zone carries its own vertical rhythm', () => {
  it('⭐ the sweep finds both zones, and only those — a precondition, not an assumption', () => {
    // Without this, a regex that stopped matching would make every assertion
    // below pass by iterating an empty list (trap 13).
    // V2 fidelity gap 24 (24 Sep 2026): 'further' is deleted; the tail is About.
    // ⛔ V2 prototype (Paul, 25 Sep 2026): 'focus' is deleted too — no "Focus
    // now" block on the Reasoning tab. Exact, so a zone coming back REDs here.
    const found = zoneRhythms().map((z) => z.zone).sort()
    expect(found).toEqual(['also', 'answer'])
  })

  it('⛔ the sweep sees every zone group the source declares, whatever its attribute order', () => {
    // Contrast for the precondition above: a zone group written with its testid
    // before its className would escape both sweep patterns and go unmeasured.
    const declared = [...src.matchAll(/data-testid="analysis-new-zone-(\w+)-group"/g)].map((m) => m[1]).sort()
    expect(declared.length).toBeGreaterThan(0)
    expect(declared).toEqual(zoneRhythms().map((z) => z.zone).sort())
  })

  it('⛔ no zone is a bare wrapper — that is what removed the rhythm in #1647', () => {
    expect(zoneRhythms().filter((z) => z.px === null).map((z) => z.zone)).toEqual([])
  })

  it('⭐ every zone is strictly TIGHTER than the gap between zones, or the groups stop reading as groups', () => {
    const column = columnRhythmPx()
    for (const { zone, px } of zoneRhythms()) {
      expect(px, `zone ${zone} has no rhythm`).not.toBeNull()
      expect(px as number, `zone ${zone} must be tighter than the ${column}px between zones`).toBeLessThan(column)
    }
  })

  it('⭐ and lands on the sanctioned spacing scale rather than a hand-picked value', () => {
    for (const { zone, px } of zoneRhythms()) {
      expect(SHELL_SPACING_SCALE_PX as readonly number[], `zone ${zone} is off-scale at ${px}px`).toContain(px as number)
    }
  })

  /**
   * ⚠ DERIVED, NOT RESTATED. This spec never hard-codes 16 or 12: it reads the
   * column's own class and compares. If a later change moves the column's
   * rhythm, the zones must move with it or this goes red — which is the
   * hand-maintained mirror the original defect was.
   */
  it('the column still carries a rhythm for the comparison to be meaningful', () => {
    expect(SHELL_SPACING_SCALE_PX as readonly number[]).toContain(columnRhythmPx())
  })
})
