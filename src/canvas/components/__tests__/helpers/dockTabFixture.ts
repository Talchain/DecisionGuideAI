/**
 * THE DOCK TAB A SPEC IS MEASURING — STATED, NOT INHERITED.
 *
 * ── WHY THIS EXISTS (9 Sep 2026) ────────────────────────────────────────────
 *
 * Until the default-tab ruling, `OutputsDock` OPENED on the Analysis tab. So a
 * spec could clear `sessionStorage`, render the dock, and query
 * `outputs-error-banner` / `results-analysis-footer` / `pre-analysis-v3-analyse`
 * — all Analysis-surface testids — without ever saying which tab it was on. The
 * premise was real and universally true, and therefore universally unwritten.
 *
 * Paul ruled that a fresh, unchosen session lands on **Reasoning**
 * (`DEFAULT_WORKSPACE_SURFACE`). The premise became false, and 96 cases across
 * 16 files failed — every one of them on a MISSING ELEMENT, not on a
 * disagreement about behaviour. That distinction is the whole justification for
 * this helper: the fixtures were wrong, the assertions were not, and not one
 * assertion is relaxed by calling this.
 *
 * ── WHY A SHARED HELPER RATHER THAN 15 INLINE `setItem` CALLS ───────────────
 *
 * Fifteen hand-copied literals of the same storage payload is the
 * hand-maintained mirror this estate keeps paying for (trap 12): the key, the
 * shape and the tab id would drift independently, and a future default move
 * would have to find all fifteen again. One definition, imported by name, moves
 * once.
 *
 * ⚠ AND WHY IT IS **NOT** IN A GLOBAL `beforeEach`. A global seed would make
 * every dock spec silently start on Analysis, including a future spec written
 * to check where a session LANDS — which would then pass while measuring the
 * fixture rather than the product. The premise has to be visible at the call
 * site, and a spec about the default must be able to decline it. That is why
 * this is an import you can see, not a hidden default you cannot.
 *
 * ── WHAT IT IS NOT ─────────────────────────────────────────────────────────
 *
 * NOT a way to make a default-tab assertion pass. `OutputsDock.defaultTab.spec`
 * and section B of `OutputsDock.analysisNewTab.spec` deliberately do not use
 * this: they assert what the dock does with NOTHING persisted, and seeding a
 * tab would make them certify the seed.
 */
import { OUTPUTS_DOCK_STORAGE_KEY } from '../../OutputsDock'

/**
 * Put the session on the **Analysis** tab, through the dock's own persisted
 * state — the same path a user's earlier click writes, so the fixture is the
 * product's real "this session chose Analysis" state and not a contrivance.
 *
 * Call it AFTER any `sessionStorage.clear()` in the same setup block.
 */
export function seedDockOnAnalysisTab(): void {
  try {
    sessionStorage.setItem(
      OUTPUTS_DOCK_STORAGE_KEY,
      JSON.stringify({ isOpen: true, activeTab: 'results' }),
    )
  } catch {
    /* jsdom private-mode quirk — the spec's own render assertions will say so */
  }
}
