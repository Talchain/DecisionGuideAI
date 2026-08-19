/**
 * ANSWER FIRST — a real-browser MEASUREMENT of where the Analysis panel puts
 * the result relative to the framing furniture above it.
 *
 * WHY IT EXISTS: jsdom cannot prove "above the fold" — that is layout
 * (CLAUDE.md trap 3). The unit specs pin the COLLAPSE
 * (`DecisionOverviewCard.answerFirst.spec.tsx`); this pins its GEOMETRY, in
 * real Chromium, at real viewports, against a real captured analysis turn.
 *
 * ⚠ RUN IT DELIBERATELY, it is not in any gate:
 *     pnpm exec playwright test -c playwright.geometry.config.ts
 * `*.measure.ts`, never `*.spec.ts`, so the main e2e config cannot collect it
 * into a run with no dev server on its port.
 *
 * ── STATE CLASS, STATED HONESTLY (the fixture rule) ────────────────────────
 * FRESH session, real starter draft (`applyDraftResult`, the product's own
 * path) + a REAL captured CEE analysis turn replayed through `applyV5State`,
 * the same entry point `useConversation` uses. No hand-written report.
 *
 * ── ⚠ WHY THE REPLAY IS TRIMMED, AND WHY THE FIRST VERSION MEASURED NOTHING ─
 * The deployed defect was measured with a THIN BRIEF (the user's typed brief
 * had no success measure), which force-expanded the overview card to its full
 * body — that is how the verdict reached 573px in a 515px region.
 *
 * The first version of this file replayed the capture UNTRIMMED and was a
 * NON-DISCRIMINATING CONTROL with respect to the change it was written for.
 * Derived, not guessed: the capture's `analysis_ready.status` is `'ready'` and
 * it carries `goal_threshold_raw: 1000000`, so `computeSuccessState` branch 2
 * fires, `successIsSet` is true and `liveState` is `'ready'`. At PRISTINE
 * (`autoExpand = state !== 'ready' && state !== 'unassessed'`) that is already
 * `false`, and after the fix it is `false` too — so all three assertions below
 * passed at pristine and the measured furniture offset was not attributable to
 * the diff.
 *
 * (The header used to explain the same shortfall by saying the five committed
 * starters "all carry a success measure". That is not what happens here:
 * `build-vs-buy`'s goal node carries NO threshold and its own `analysis_ready`
 * carries none either — the measure arrives ONLY from the replayed capture. The
 * reason mattered, because it is what makes the trim below possible.)
 *
 * So the replay now DROPS `goal_threshold_raw` and `goal_threshold_unit` from
 * `analysis_ready`, and nothing else. `status` stays `'ready'` (so the state is
 * not `needs_input`) and the normalised `goal_threshold: 0.8` stays, so this is
 * the product's own real value-scale degradation case: a threshold present on
 * the wire but not displayable ⇒ `displayText: null` ⇒ `liveState: 'thin'`.
 * That is a state pristine WOULD auto-expand and the fix collapses, so the
 * numbers below now measure the change. The precondition is PINNED on screen
 * (the thin copy) rather than assumed — a run that silently landed back in
 * `ready` would otherwise report a comfortable number about nothing.
 *
 * It remains a REPLAY, not the deployed thin-brief journey: the brief text is
 * the starter's, and the above-the-fold claim for a genuinely typed thin brief
 * is settled on the deployed build, not here.
 *
 * ── WHAT THE TRIM BOUGHT, MEASURED (19 Aug 2026, local Chromium) ───────────
 * The same file, run twice, differing ONLY in `DecisionOverviewCard`'s
 * `autoExpand` (the PR's one-line change, reverted in place as a mutant and
 * restored HEAD-relative):
 *
 *   pristine  overview h=282  hero.top=536  subCardsExpanded=true   → 2 FAILED
 *   fixed     overview h=135  hero.top=389  subCardsExpanded=false  → 2 passed
 *
 * ⚠ STATED PRECISELY, because two of the three gate assertions discriminate
 * and one does NOT: `subCardsExpanded` and `disclosure` flip, and they are why
 * the pristine arm REDs. `hero.top < fold` passes in BOTH arms here
 * (536 < 586 at 1280x800 — 91% of the fold, i.e. barely). This replayed thin
 * state is not the deployed typed-thin-brief that put the verdict at 573px in
 * a 515px region, so the above-the-fold assertion remains a floor this
 * harness cannot exercise adversarially. Do not read it as the evidence.
 *
 * ── PRECONDITIONS ARE PINNED, NOT HOPED FOR (trap 13b) ─────────────────────
 * A run in which the hero never mounted would otherwise report a comfortable
 * number about a component that is not on screen (trap 3b). Both anchors are
 * asserted before anything is measured.
 *
 * Output: one `ANSWERFIRST {...}` line per viewport on stdout.
 */
import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { repoRoot } from '../visual/repoRoot'
import type { Page } from '@playwright/test'
import {
  openCanvas,
  preparePage,
  seedStarterDraft,
  clearNotifications,
  minimiseFloatingOlumiPanel,
} from '../visual/harness'

/** A real captured CEE analysis turn (2026-08-04), replayed unmodified. */
const CAPTURE = join(repoRoot(), 'src/v5/__tests__/fixtures/live-analysis-turn-walkA-2026-08-04.json')
const STARTER = 'build-vs-buy' as const
const VPS = [
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
]

/**
 * ⚠ COLD-START, MEASURED: the FIRST test in a run can outlast `openCanvas`'s
 * 30s wait while Vite dev-compiles the canvas chunk — the page is still on its
 * "Loading Canvas..." route loader. That produced a failure whose snapshot
 * contained no app at all, which must never be read as a layout finding. One
 * reload and retry, then fail for real.
 */
async function openCanvasWarm(page: Page): Promise<void> {
  try {
    await openCanvas(page)
  } catch {
    await page.reload({ waitUntil: 'domcontentloaded' })
    await openCanvas(page)
  }
}

for (const vp of VPS) {
  test(`ANSWER FIRST @${vp.width}x${vp.height}`, async ({ page }) => {
    await preparePage(page, vp)
    await openCanvasWarm(page)
    const seeded = await seedStarterDraft(page, STARTER)
    expect(seeded.nodeCount, 'build-vs-buy is 19 nodes; a different count means the fixture drifted').toBe(19)
    await clearNotifications(page)
    await minimiseFloatingOlumiPanel(page).catch(() => {})

    const raw = JSON.parse(readFileSync(CAPTURE, 'utf8'))
    // ⚠ The ONLY modification to the captured turn, and it is a DELETION of two
    // keys — never a substitution. See the header: with them present the state
    // is `ready`, which pristine already collapses, and this file measures a
    // difference the change did not make.
    const { goal_threshold_raw: _raw, goal_threshold_unit: _unit, ...analysisReadyThin } = raw.analysis_ready
    const envelope = { ...raw, analysis_ready: analysisReadyThin }
    // Assert the trim landed on the object we think it did — a rename upstream
    // would otherwise leave this file silently replaying the untrimmed capture.
    expect(
      'goal_threshold_raw' in raw.analysis_ready && !('goal_threshold_raw' in envelope.analysis_ready),
      'the capture must carry goal_threshold_raw and the replay must not',
    ).toBe(true)
    expect(envelope.analysis_ready.status, 'status must stay ready — this is a thin measure, not a blocked run').toBe('ready')
    const applied = await page.evaluate(async (env) => {
      // Resolved by the BROWSER against Vite's dev module graph — the same
      // applicator `useConversation` calls on a real turn.
      // Held in a VARIABLE, not a literal: this path exists only as a Vite
      // dev-server URL, and a string literal here is a TS2307 (the shared
      // harness documents the same remedy for `seedStarterDraft`).
      const modulePath = '/src/v5/applyV5State.ts'
      const mod = (await import(/* @vite-ignore */ modulePath)) as {
        applyV5State: (r: unknown, s: unknown, o: unknown) => { applied: string[] }
      }
      const w = window as unknown as { useCanvasStore: { getState: () => Record<string, unknown> } }
      const snap = w.useCanvasStore.getState()
      return mod.applyV5State(
        env,
        { ...snap, currentResultsHash: (snap.results as { hash?: string } | null)?.hash ?? null, backfillGoalThreshold: () => {} },
        { turnClientId: 'measure', currentClientTurnId: 'measure' },
      )
    }, envelope)
    expect(applied.applied.length, 'applyV5State applied nothing — the turn did not land').toBeGreaterThan(0)

    // Tolerant NAVIGATION (results is the default tab); the strict checks are
    // the two visibility preconditions below, which fail loud if it is not.
    const resultsTab = page.getByTestId('outputs-dock-tab-results')
    if (await resultsTab.count()) await resultsTab.click().catch(() => {})
    await expect(page.getByTestId('decision-overview')).toBeVisible({ timeout: 20_000 })
    // PRECONDITION: the verdict is actually on screen. Without this the
    // measurement below is a comfortable number about an absent component.
    await expect(page.getByTestId('hero-headline')).toBeVisible({ timeout: 20_000 })
    // PRECONDITION: the card is in the `thin` state — the state pristine
    // auto-expands. Without this pin a run that landed back in `ready` would
    // report the same comfortable numbers while measuring nothing, which is
    // exactly what the untrimmed version of this file did.
    await expect(
      page.getByText('Framing needs one clarification'),
      'the replay must reach the thin state, or this file is measuring a state pristine already collapsed',
    ).toBeVisible({ timeout: 20_000 })

    const m = await page.evaluate(() => {
      const dock = document.querySelector('[data-testid="outputs-dock"]') as HTMLElement
      let sc: HTMLElement = dock
      for (const el of [...dock.querySelectorAll('*')] as HTMLElement[]) {
        if (el.scrollHeight > el.clientHeight + 40 && /auto|scroll/.test(getComputedStyle(el).overflowY)) { sc = el; break }
      }
      const r = sc.getBoundingClientRect()
      const at = (k: string) => {
        const e = document.querySelector(`[data-testid="${k}"]`) as HTMLElement | null
        if (!e) return null
        const b = e.getBoundingClientRect()
        return { top: Math.round(b.top - r.top + sc.scrollTop), h: Math.round(b.height) }
      }
      const toggle = document.querySelector('[data-testid="brief-bar"]')
      return {
        fold: sc.clientHeight,
        overview: at('decision-overview'),
        heroHeadline: at('hero-headline'),
        // Identity of the collapsed state + proof the content is still offered.
        subCardsExpanded: document.querySelector('[data-testid="brief-dim-goal"]') !== null,
        disclosure: toggle?.getAttribute('aria-expanded') ?? null,
        // Recorded in the output line so the state class is in the artefact,
        // not only in an assertion that has already passed.
        briefState: (document.querySelector('[data-testid="decision-overview"]')?.textContent ?? '')
          .includes('Framing needs one clarification') ? 'thin' : 'other',
        evidenceCheck: (document.querySelector('[data-testid="checks-evidence"]')?.textContent ?? '').trim(),
      }
    })

    const hero = m.heroHeadline!
    const pct = Math.round((hero.top / m.fold) * 100)
    // eslint-disable-next-line no-console
    console.log(`ANSWERFIRST ${JSON.stringify({ vp: vp.width, ...m, heroPctOfFold: pct, aboveFold: hero.top < m.fold })}`)

    // The one claim this file is willing to make as a GATE, in the state it
    // can reach truthfully: with the furniture collapsed, the verdict is on
    // the first screenful.
    expect(hero.top, `verdict at ${hero.top}px in a ${m.fold}px region (${pct}%)`).toBeLessThan(m.fold)
    expect(m.subCardsExpanded, 'the framing sub-cards must not be holding the first screenful').toBe(false)
    expect(m.disclosure, 'the collapsed card must still offer its content').toBe('false')
  })
}
