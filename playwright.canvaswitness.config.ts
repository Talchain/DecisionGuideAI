import { defineConfig } from '@playwright/test'
/**
 * CANVAS WITNESS — the instrument for the Canvas editor goal (22 Sep 2026).
 *
 * Separate from `playwright.core.config.ts` (a gate with a pinned spec manifest)
 * and from `playwright.witnessjourney.config.ts` (the whole-journey witness).
 * This one measures the Canvas's own two questions: is the model truthful to
 * inspect, and is it genuinely editable.
 *
 * No `webServer`: it binds to the SHA-pinned `deploy_url` permalink from
 * /version.json, so a run cannot straddle a mid-run redeploy.
 * `retries: 0` — a retried witness is how a flaky instrument hides.
 *
 * ── THE VERDICT DISCIPLINE, WHICH IS THE POINT OF THE SUITE ─────────────────
 *
 * Every spec here prints one of **PASS / FAIL / NOT-MEASURED**, and the third
 * is not a formality:
 *
 *  · **A control that does not fire makes the run NOT-MEASURED, never a PASS.**
 *    Each spec states its controls in the same run — a known-good case that
 *    must be seen, a fabricated input that must find nothing, or both — and
 *    asserts them before it reports anything about the product.
 *  · **A contaminated scenario VOIDS the run.** A guest session restores the
 *    last board, so a spec that reuses one page across cases can measure a
 *    board it did not open. `openingViewAtLaptop` and `edgeLabelOverlap` take a
 *    fresh context per case and assert the example picker matches exactly one
 *    element as a precondition; the first version of the former did neither and
 *    matched three node buttons whose aria-labels carry the board's name.
 *  · **No coordinate is computed.** Five consecutive false FAILs on edge
 *    editing on 22 Sep 2026 had one cause: the bounding-box centre of a bezier
 *    path is not on the path, so a hover never landed and "no control appeared"
 *    was indistinguishable from "the product offers no control". Actions here
 *    are anchored to elements (`locator.click()`, `locator.dblclick()`), and
 *    the only geometry read is a rect taken from an element itself.
 *
 * ── WHAT EACH ONE ANSWERS ───────────────────────────────────────────────────
 *
 *  · `nodeAffordanceHover`   — does each node advertise an edit, at rest AND on
 *                              hover? (the difference is itself the finding)
 *  · `inspectorDestination`  — does selecting a node reach an ENABLED editor?
 *  · `renameReachability`    — does a double-click open a rename field seeded
 *                              with that node's own label, per kind?
 *  · `openingViewAtLaptop`   — on arrival at 1280/1440/1512 wide: how much of
 *                              the model is in view, at what rendered type size?
 *
 * ⚠ ONE WITNESS IS DELIBERATELY ABSENT, AND SAYING SO IS THE POINT. Paul's
 * capture shows two edges' words overlapping ("Moderate boost est." over
 * "Moderate drag est."). A probe for it was built three times and **none of the
 * three produced a verdict worth keeping**: the first searched the wrong layer
 * and found nothing; the second found fourteen bare `+`/`-` glyphs and called a
 * two-square-pixel corner touch a FAIL; the third reached the right population
 * and measured **zero edge words in the DOM on arrival**, because the board
 * opens at the `quiet` rung where they do not render — and eight zoom steps did
 * not bring them back. Shipping it would add a spec that reports NOT-MEASURED
 * every night, which is how a suite stops being read. The finding stands
 * (Paul saw it); the instrument does not, and it is recorded here rather than
 * committed as noise.
 *
 * Run: `npm run canvas:witness`. It hits deployed staging and spends no model
 * calls — the guest route renders the real board.
 */
export default defineConfig({
  testDir: './e2e/canvas-witness',
  timeout: 240_000,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: { headless: true, viewport: { width: 1440, height: 900 } },
})
