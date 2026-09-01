/**
 * THE DOMINANT-FACTOR WARNING PAINTS ITS OWN NUMBER — a real-browser
 * MEASUREMENT, because jsdom cannot prove that a pixel reached the screen.
 *
 * WHY IT EXISTS: witnessed on deployed staging (`83f20058`, 1 Sep 2026) the
 * amber nudge rendered "⚠ Dominant factor: two senior engineers have hinted
 * they wo" — a hard cut MID-WORD, no ellipsis — while the sentence it was
 * cutting ends "…has an influence score of 100%.". The number the warning
 * exists to convey never reached the user.
 *
 * ⚠ RUN IT DELIBERATELY, it is not in any gate:
 *     pnpm exec playwright test -c playwright.geometry.config.ts
 * `*.measure.ts`, never `*.spec.ts`, so the main e2e config cannot collect it
 * into a run with no dev server on its port.
 *
 * ── WHY IT MEASURES ANCESTORS, NOT THE LEAF (the whole point) ──────────────
 * `e2e/visual/nodeTextClipping.visual.spec.ts` skips any element with
 * text-bearing children — LEAVES ONLY — and is scoped to `.react-flow__node`.
 * Here every leaf measures clean and the evicted span is 0px wide (below that
 * spec's own 4px floor). The clipping happened at the PARENT. So this walks the
 * number's ANCESTOR CHAIN and requires the painted rect to survive every
 * clipping box on the way out. That is the level at which the eviction happens.
 *
 * ── STATE CLASS, STATED HONESTLY (the fixture rule) ────────────────────────
 * FRESH session, real starter draft (`build-vs-buy`, the product's own
 * `applyDraftResult` path) + a REAL captured CEE analysis turn replayed
 * UNMODIFIED through `applyV5State` — the same applicator `useConversation`
 * calls on a real turn. Nothing here is hand-authored: the capture's own
 * `top_drivers` are Churn Trend 0.991 / Competitive Intensity 0.909, which is
 * what makes the nudge mount and what makes its claim comparative.
 *
 * ⚠⚠ ASSERT NO STALE DEV SERVER IS HOLDING PORT 5189 BEFORE YOU BELIEVE A
 * NUMBER (measured 1 Sep 2026, and it cost several runs). A dev server from an
 * earlier run OUTLIVES `playwright test` and keeps the port. `reuseExistingServer`
 * is false, so Playwright does not adopt it — but the browser still reaches it,
 * and it serves the module graph it had when it started. On a tree that had
 * ALREADY been fixed it served the PRISTINE component for run after run.
 *
 * ⚠ AND THE CHECK ITSELF IS A TRAP: `lsof -ti tcp:5189` lists browser CLIENT
 * connections as well as the listener, so it returns PIDs that are not the
 * server and keeps returning them after you kill the server. Killing those
 * achieves nothing and reads as "the port will not free". Use:
 *     lsof -nP -iTCP:5189 -sTCP:LISTEN
 * (An earlier version of this header blamed `node_modules/.vite`. That was
 * WRONG — clearing the cache changed nothing, because the stale bytes were in
 * a live process, not on disk. Corrected here rather than left standing, per
 * CLAUDE.md: the correcting comment is the one nobody re-checks.)
 *
 * The reason this was CAUGHT at all: the probe binds to `data-testid` IDENTITY,
 * so a stale transform surfaced as "the handles are missing" rather than as a
 * confident wrong number. A class-only probe would have measured the wrong code
 * silently (CLAUDE.md trap 19, at the level of the running server).
 *
 * ⚠ THE SHORT LABEL IS THE POINT. "Churn Trend" is 11 characters — nothing like
 * the long label in the witness — and the number was STILL lost. Measured in
 * Chromium at pristine: the metric span rendered 0px wide. The defect was never
 * about long labels; it was about a `flex-basis: 0%` span behind two
 * unshrinkable `whitespace-nowrap` siblings.
 */
import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Page } from '@playwright/test'
import { repoRoot } from '../visual/repoRoot'
import {
  openCanvas, preparePage, seedStarterDraft, clearNotifications, minimiseFloatingOlumiPanel,
} from '../visual/harness'

const CAPTURE = join(repoRoot(), 'src/v5/__tests__/fixtures/live-analysis-turn-walkA-2026-08-04.json')
const STARTER = 'build-vs-buy' as const
const VP = { width: 1280, height: 800 }

/** Cold start: the first test can outlast `openCanvas` while Vite compiles the canvas chunk. */
async function openCanvasWarm(page: Page): Promise<void> {
  // Two independent cold starts to survive: Vite pre-bundling after a cache
  // clear (the port is open before it serves — ERR_CONNECTION_REFUSED), and the
  // canvas chunk dev-compiling past `openCanvas`'s 30s wait. Both produce a
  // failure whose snapshot contains no app at all, which must never be read as
  // a layout finding.
  let last: unknown
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try { await openCanvas(page); return } catch (e) {
      last = e
      console.log(`OPENCANVAS_ATTEMPT_${attempt} ` + String(e).slice(0, 300))
      if (page.isClosed()) break
      await page.waitForTimeout(5_000)
      await page.goto('/#/canvas', { waitUntil: 'domcontentloaded' }).catch(() => {})
    }
  }
  throw last
}

test(`DOMINANT NUDGE NUMBER @${VP.width}x${VP.height}`, async ({ page }) => {
  await preparePage(page, VP)
  await openCanvasWarm(page)
  const seeded = await seedStarterDraft(page, STARTER)
  expect(seeded.nodeCount, 'build-vs-buy is 19 nodes; a different count means the fixture drifted').toBe(19)
  await clearNotifications(page)
  await minimiseFloatingOlumiPanel(page).catch(() => {})

  const envelope = JSON.parse(readFileSync(CAPTURE, 'utf8'))
  // Pin what makes the nudge mount, so a capture that drifted cannot leave this
  // file reporting a comfortable number about a component that never rendered.
  const td = envelope.blocks[0].enrichment.decision_brief.top_drivers
  expect(td[0].sensitivity, 'top driver must clear the 0.8 dominance floor').toBeGreaterThanOrEqual(0.8)
  expect(td[0].sensitivity - td[1].sensitivity, 'dominance is COMPARATIVE — a tie must not mount it').toBeGreaterThan(0.01)

  const applied = await page.evaluate(async (env) => {
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

  const resultsTab = page.getByTestId('outputs-dock-tab-results')
  if (await resultsTab.count()) await resultsTab.click().catch(() => {})
  // PRECONDITION: the nudge is actually on screen (trap 3b).
  await expect(page.getByTestId('t1-dominant-nudge')).toBeVisible({ timeout: 20_000 })

  // ⚠ SETTLED READING, NEVER A FIRST READ. Probes here race the panel's entry
  // animation: a first read can report a transient. Scroll the nudge into view,
  // let it settle, then take TWO readings and require them to agree.
  await page.getByTestId('t1-dominant-nudge').scrollIntoViewIfNeeded()
  await page.waitForTimeout(600)

  const measure = () => page.evaluate(() => {
    // Does the "NN%" glyph run survive every CLIPPING ANCESTOR on its way out?
    const numberSurvives = (metric: HTMLElement) => {
      const tn = [...metric.childNodes].find(n => n.nodeType === 3 && /\d+%/.test(n.textContent ?? ''))
      if (!tn) return { found: false as const, reason: 'no text node carrying NN%' }
      const i = (tn.textContent ?? '').search(/\d+%/)
      const len = ((tn.textContent ?? '').match(/\d+%/) ?? [''])[0].length
      const r = document.createRange(); r.setStart(tn, i); r.setEnd(tn, i + len)
      const rect = r.getBoundingClientRect()
      if (rect.width < 1 || rect.height < 1) {
        return { found: true as const, visible: false, w: +rect.width.toFixed(1), clippedBy: 'zero-area (evicted)' }
      }
      // Walk the ancestor chain; every CLIPPING box must contain it.
      // ⚠ `auto`/`scroll` ancestors are SKIPPED, and that is deliberate: the
      // dock body is `overflow-y-auto`, so text below the fold there is
      // RECOVERABLE by scrolling. The defect class is "hidden with nowhere to
      // recover" (`hidden`/`clip`), which is the same line
      // `nodeTextClipping.visual.spec.ts` draws. The first version of this
      // probe enforced containment on `auto` too and reported a FALSE
      // POSITIVE against the scroll container on a correctly-fixed tree.
      for (let el = metric.parentElement; el; el = el.parentElement) {
        const cs = getComputedStyle(el)
        // Reached a SCROLL PORT: everything from here outwards is the fold, not
        // hiding. Stop. (The dock nests `overflow-y-auto` inside an
        // `overflow-hidden` shell, so a walk that did not stop here reported
        // the OUTER shell as the clipper on a correctly-fixed tree — the second
        // false positive this probe produced before it was pointed correctly.)
        if (/auto|scroll/.test(cs.overflowX + ' ' + cs.overflowY)) break
        if (!/hidden|clip/.test(cs.overflowX + ' ' + cs.overflowY)) continue
        const b = el.getBoundingClientRect()
        if (rect.left < b.left - 0.5 || rect.right > b.right + 0.5 ||
            rect.top < b.top - 0.5 || rect.bottom > b.bottom + 0.5) {
          return { found: true as const, visible: false, w: +rect.width.toFixed(1),
                   clippedBy: `${el.tagName.toLowerCase()}.${el.className}`.slice(0, 120) }
        }
      }
      return { found: true as const, visible: true, w: +rect.width.toFixed(1), clippedBy: null }
    }

    const metric = document.querySelector('[data-testid="t1-dominant-nudge-metric"]') as HTMLElement | null
    const row = document.querySelector('[data-testid="t1-dominant-nudge-row"]') as HTMLElement | null
    const label = document.querySelector('[data-testid="t1-dominant-nudge-label"]') as HTMLElement | null
    if (!metric || !row || !label) {
      const n = document.querySelector('[data-testid="t1-dominant-nudge"]')
      return { mounted: false as const,
        has: { metric: !!metric, row: !!row, label: !!label },
        nudgeHTML: (n?.outerHTML ?? 'NO NUDGE').slice(0, 1500) }
    }

    // POSITIVE CONTROL — reproduce the deployed mechanism beside the real one
    // and require the probe to CATCH it. Without this, a probe that silently
    // stopped discriminating would report a clean pass forever (trap 13).
    const control = row.cloneNode(true) as HTMLElement
    control.style.cssText = 'display:flex;flex-wrap:nowrap;overflow:hidden;width:120px'
    const cMetric = control.querySelector('[data-testid="t1-dominant-nudge-metric"]') as HTMLElement
    cMetric.style.cssText = 'flex:1 1 0%;min-width:0;overflow:hidden;white-space:nowrap'
    ;(control.querySelector('[data-testid="t1-dominant-nudge-label"]') as HTMLElement)
      .style.cssText = 'white-space:nowrap'
    row.parentElement!.appendChild(control)
    const controlCaught = numberSurvives(cMetric).found && !numberSurvives(cMetric).visible
    control.remove()

    return {
      mounted: true as const, controlCaught,
      rowW: row.clientWidth, rowScroll: row.scrollWidth,
      rowOverflow: row.scrollWidth - row.clientWidth,
      labelW: +label.getBoundingClientRect().width.toFixed(1),
      metricW: +metric.getBoundingClientRect().width.toFixed(1),
      metricText: metric.textContent, labelText: label.textContent,
      number: numberSurvives(metric),
    }
  })

  const first = await measure()
  await page.waitForTimeout(400)
  const m = await measure()
  console.log('DOMINANTNUDGE_FIRST ' + JSON.stringify(first))
  console.log('DOMINANTNUDGE ' + JSON.stringify(m))
  expect(
    first.mounted === m.mounted &&
      (!first.mounted || !m.mounted || first.number.visible === m.number.visible),
    'the two readings disagree — the layout had not settled, so neither is evidence',
  ).toBe(true)
  // Evidence for the PR: the warning as a human sees it, in this arm.
  const arm = process.env.NUDGE_ARM ?? 'after'
  await page.getByTestId('t1-dominant-nudge')
    .screenshot({ path: `test-results/geometry/dominant-nudge-${arm}.png` })
    .catch(() => {})
  expect(m.mounted, 'the nudge did not mount — nothing was measured').toBe(true)
  if (!m.mounted) return
  expect(
    m.controlCaught,
    'the POSITIVE CONTROL was not caught — the probe cannot see an evicted number, ' +
      'so a clean result from it would mean nothing',
  ).toBe(true)
  expect(m.number.found, 'the metric span carries no NN% text node at all').toBe(true)
  expect(
    m.number.found && m.number.visible,
    `the influence number is NOT painted on screen (${JSON.stringify(m.number)}) — ` +
      `row ${m.rowW}px holding ${m.rowScroll}px, metric span ${m.metricW}px wide`,
  ).toBe(true)
  expect(m.rowOverflow, 'the row must not clip its own children').toBeLessThanOrEqual(1)
})
