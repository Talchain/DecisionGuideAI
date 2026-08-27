/**
 * ⭐ RULING (Fable, 18 Aug 2026): COMPARE IS REMOVED FROM THE PRESENTED TAB ROW.
 *
 * Compare is structurally empty for every staging guest —
 * `useCompareHistoryHydration.ts:79` early-returns without a `userId`, so the
 * surface a guest reaches has nothing in it — and its tab is a competing
 * hierarchy beside Analysis. It is therefore hidden BY CONTRACT
 * (`presentedAsTab: false` in `workspaceShell/shellContract.ts`), the same
 * mechanism Journey was given on 17 Aug.
 *
 * ⚠ SCOPE OF THIS RULING, STATED PRECISELY (trap 20 — a row must restate the
 * scope, never generalise it):
 *   - Compare's TAB is removed. That is all this spec is about.
 *   - Compare's CODE IS NOT DELETED. Retirement is a separate decision.
 *   - The accordion-inside-Analysis half of the original proposal is DEFERRED
 *     and is NOT built here.
 *
 * ── WHY EACH CASE IS SHAPED THE WAY IT IS ─────────────────────────────────
 * The load-bearing case is DT-2: `presentedAsTab: false` must beat the FLAG.
 * `compareTab` is ON in the build config (`netlify.toml:157`
 * `VITE_FEATURE_COMPARE_TAB = "1"`), so unlike Journey — whose flag is absent,
 * and which therefore cannot distinguish "hidden by contract" from "dark by
 * flag" — Compare is a genuine test of the contract's strength. If the
 * contract row were reverted, the flag alone would light the tab again.
 *
 * Every assertion binds by IDENTITY to the compare surface id, never to "some
 * surface is hidden" or to a label predicate (trap 19), and every absence
 * assertion carries a CONTRAST CONTROL in the same run — the surfaces that
 * must STILL be present (trap 13e). A blanket mutant that hid every surface
 * would satisfy a bare `not.toContain('compare')`; it cannot satisfy these.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// Importing OutputsDock pulls in services/threadService → src/lib/supabase,
// which throws at import time without SUPABASE_URL/KEY. Same stub, and for the
// same reason, as `aiPanelV2.parity.spec.tsx`.
vi.mock('../../../lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }) }) }) }) },
  isSupabaseAvailable: () => false,
}))
vi.mock('dompurify', () => ({ default: { sanitize: (s: string) => s } }))
vi.mock('../../utils/markdown', () => ({
  renderMarkdown: (s: string) => s,
  sanitiseMarkdown: (s: string) => s,
}))

import {
  WORKSPACE_SURFACES,
  WORKSPACE_SURFACE_ORDER,
  MAX_PRESENTED_SURFACES,
  presentedSurfaces,
} from '../workspaceShell/shellContract'

describe('Compare is de-tabbed by contract (Fable, 18 Aug 2026)', () => {
  beforeEach(() => {
    vi.resetModules()
    try {
      window.localStorage.removeItem('feature.compareTab')
    } catch {}
  })

  it('DT-1: the compare ROW says hidden, and says why', () => {
    // Bound by identity to the compare row. "Some surface is hidden" — which
    // journey already satisfies — cannot pass this.
    expect(WORKSPACE_SURFACES.compare.presentedAsTab).toBe(false)
    expect(WORKSPACE_SURFACES.compare.hiddenReason.trim().length).toBeGreaterThan(0)
    // …and journey's row is untouched, so this is not passing because some
    // sweep flipped every row (the blanket-mutant discriminator).
    expect(WORKSPACE_SURFACES.journey.presentedAsTab).toBe(false)
    expect(WORKSPACE_SURFACES.results.presentedAsTab).toBe(true)
    expect(WORKSPACE_SURFACES.olumi.presentedAsTab).toBe(true)
    expect(WORKSPACE_SURFACES.diagnostics.presentedAsTab).toBe(true)
  })

  it('DT-2: the CONTRACT beats the FLAG — compareTab ON does not light the tab', async () => {
    // ⭐ THE LOAD-BEARING CASE. `getOutputTabsForParity()` is what both the
    // expanded strip and the collapsed icon rail map over, and it is also what
    // the `?tab=` deep-link reader validates against
    // (`OutputsDock.tsx:1651-1662`) — one authority, three consumers. Driving
    // it with the flag forced ON is the only way to prove the contract row,
    // not the flag, is holding the tab shut.
    vi.doMock('../../../flags', async importOriginal => {
      const actual = await importOriginal<typeof import('../../../flags')>()
      return { ...actual, isCompareTabEnabled: () => true, isAiPanelV2Enabled: () => true }
    })
    const { getOutputTabsForParity } = await import('../OutputsDock')
    const flags = await import('../../../flags')

    // Pin the precondition IN-TEST (trap 13b): assert the flag really is ON in
    // the module graph this derivation just read, so a green result is the
    // contract's doing and not a broken flag accessor.
    expect(flags.isCompareTabEnabled()).toBe(true)

    const ids = getOutputTabsForParity().map(t => t.id)
    expect(ids).not.toContain('compare')
    // CONTRAST CONTROL in the same run — absence is only evidence when the
    // things that must be present read present (trap 13e).
    expect(ids).toEqual(['olumi', 'results', 'analysisNew', 'diagnostics'])
    // ⚠ 120s, and the number is deliberate, not padding. Importing OutputsDock
    // cold through `resetModules` + `doMock` pulls a very large module graph:
    // measured 27.1s on this machine, and the 5s default fired BEFORE any
    // assertion ran. A first 30s budget was WORSE THAN USELESS — it sat just
    // above the measured cost, so the case passed at 27.1s and then reported
    // 30001ms / 30009ms / 30004ms under three mutants and the trailing control:
    // FOUR identical clock-limit readings that look exactly like a biting
    // mutant and are not (trap 20 — when a per-item probe returns the same
    // answer for every item, suspect the probe). A timeout is not a RED; it
    // proves nothing about the predicate. The budget must sit far enough above
    // the cost that this case can only ever fail on its own assertion.
    // The same cold-import cost already times out the two OUTPUT_TABS cases in
    // `aiPanelV2.parity.spec.tsx` at their 5s default on a slow machine.
  }, 120_000)

  it('DT-3: presentedSurfaces() drops compare and keeps the other three, in strip order', () => {
    expect(presentedSurfaces().map(s => s.id)).toEqual(['olumi', 'results', 'analysisNew', 'diagnostics'])
  })

  it('DT-4: the strip budget moved WITH the Record, not independently of it', () => {
    // `MAX_PRESENTED_SURFACES` is a recorded literal, NOT a derivation — so it
    // is a hand-maintained mirror of the Record and this is the assertion that
    // makes it fail loud (trap 12). Deriving it instead would make
    // shell-conformance's "the strip never has to lay out more than the
    // recorded maximum" a tautology that can never RED on a new surface, which
    // is a guard agreeing with itself (trap 13b) — so the literal stays and
    // this pins it in both directions: it REDs if a surface is presented AND
    // if one is hidden without the budget being re-recorded.
    expect(MAX_PRESENTED_SURFACES).toBe(presentedSurfaces().length)
    // 3 while Compare was hidden and nothing replaced it; 4 since the
    // temporary 'Analysis (New)' comparison surface joined the strip
    // (27 Aug 2026). Re-record deliberately when that experiment retires.
    expect(MAX_PRESENTED_SURFACES).toBe(4)
  })

  it('DT-5: compare keeps its ORDER slot and its Record row — hidden, not retired', () => {
    // The ruling hides the tab; it does NOT delete Compare. If a later lane
    // decides to retire the surface, THIS is the case that must be deleted
    // deliberately rather than a row quietly vanishing.
    expect(WORKSPACE_SURFACE_ORDER).toContain('compare')
    expect(WORKSPACE_SURFACES.compare.id).toBe('compare')
    expect(WORKSPACE_SURFACES.compare.label).toBe('Compare')
  })
})
