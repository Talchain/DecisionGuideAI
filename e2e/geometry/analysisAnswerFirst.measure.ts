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
 * ⚠ AND WHAT THIS IS NOT. The deployed defect was measured with a THIN BRIEF
 * (the user's typed brief had no success measure), which force-expanded the
 * overview card to its full body — that is how the verdict reached 573px in a
 * 515px region. The five committed starters all carry a success measure, so
 * they render the card's `ready` state and this harness CANNOT reproduce the
 * thin-brief geometry (`e2e/visual/states.visual.spec.ts` records the same
 * class of gap for completed analysis generally). The captured turns whose
 * state DOES read thin carry option ids that match no starter graph, so the
 * hero does not mount for them — measured, both ways.
 *
 * So this file measures the OFFSET the collapse removes and the resulting hero
 * position in the state it CAN reach truthfully. The thin-brief above-the-fold
 * claim is settled on the deployed build, not here, and is reported as such
 * rather than being manufactured from a fixture written to produce it.
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

    const envelope = JSON.parse(readFileSync(CAPTURE, 'utf8'))
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
