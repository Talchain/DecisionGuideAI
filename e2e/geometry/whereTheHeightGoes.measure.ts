/**
 * WHERE THE HEIGHT GOES — the board is 2,715px tall and only ~1,490px fits at
 * the legibility floor, so the reader sees ~55% of it. This measure answers the
 * only question that licenses a fix: WHICH px are card, and which are gap?
 *
 * ⛔ IT ASSERTS NOTHING AND MUST NOT. A constant changed on arithmetic nobody
 * re-derived is exactly how #1833 put a 336px overlap on every restored board.
 * This is an instrument; the fix it licenses gets its own RED-first test.
 *
 * CONTROL (trap 13 — a probe with no positive control proves nothing): the
 * per-tier bands must SUM, with the gaps, to the extent the same run reads from
 * the viewport. If `cards + gaps != extent` the clustering is wrong and every
 * number below is void — the run says so rather than printing a tidy table.
 */
import { test, type Page } from '@playwright/test'
import {
  clearNotifications, freezeMotion, openCanvas, preparePage, seedStarterDraft,
  waitForVisualQuiescence, type StarterId,
} from '../visual/harness'

const VP = { width: 1440, height: 900 }

async function report(page: Page, starter: StarterId) {
  await preparePage(page, VP)
  await openCanvas(page)
  await seedStarterDraft(page, starter)
  await clearNotifications(page)
  await freezeMotion(page)
  await waitForVisualQuiescence(page)

  const m = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('.react-flow__node')) as HTMLElement[]
    const model = els.filter((e) => !(e.getAttribute('data-id') || '').startsWith('__ghost-'))
    // Model-space geometry: React Flow writes translate(x,y) in MODEL px on the
    // node wrapper, so this is independent of the camera.
    const read = (e: HTMLElement) => {
      const t = e.style.transform || ''
      const mm = /translate\(\s*([-\d.]+)px[, ]+\s*([-\d.]+)px/.exec(t)
      return {
        id: e.getAttribute('data-id') || '?',
        y: mm ? parseFloat(mm[2]) : NaN,
        h: e.offsetHeight,
        kind: e.getAttribute('data-kind') || e.className.match(/node-(\w+)/)?.[1] || '?',
      }
    }
    const rows = model.map(read).filter((r) => Number.isFinite(r.y)).sort((a, b) => a.y - b.y)
    // Cluster into tiers: a new tier starts when a node's top clears the
    // running tier's own top by more than the tallest card seen so far in it.
    const tiers: { top: number; bot: number; n: number; kinds: string[] }[] = []
    for (const r of rows) {
      const cur = tiers[tiers.length - 1]
      if (cur && r.y < cur.bot) { cur.bot = Math.max(cur.bot, r.y + r.h); cur.n++; cur.kinds.push(r.kind) }
      else tiers.push({ top: r.y, bot: r.y + r.h, n: 1, kinds: [r.kind] })
    }
    const cards = tiers.reduce((s, t) => s + (t.bot - t.top), 0)
    const gaps: number[] = []
    for (let i = 1; i < tiers.length; i++) gaps.push(tiers[i].top - tiers[i - 1].bot)
    const extent = tiers.length ? tiers[tiers.length - 1].bot - tiers[0].top : 0
    const gapSum = gaps.reduce((s, g) => s + g, 0)
    return {
      nodes: model.length, tiers: tiers.length, extent, cards, gapSum,
      // THE CONTROL. Void the run if these do not reconcile.
      reconciles: Math.abs(cards + gapSum - extent) < 1,
      gaps: gaps.map((g) => Math.round(g)),
      bands: tiers.map((t) => ({
        h: Math.round(t.bot - t.top), n: t.n,
        kinds: Array.from(new Set(t.kinds)).join(','),
      })),
    }
  })

  console.log(`[height] ${starter}: ${JSON.stringify(m)}`)
  if (!m.reconciles) console.log(`[height] ⛔ ${starter}: DOES NOT RECONCILE — numbers void`)
}

for (const starter of ['build-vs-buy', 'pricing-model'] as const) {
  test(`HEIGHT — ${starter}`, async ({ page }) => { await report(page, starter) })
}
