/** TEMPORARY DIAGNOSTIC against DEPLOYED staging. Not for commit. */
import { test, expect, type Page } from '@playwright/test'

const BASE = process.env.STAGING_URL ?? 'https://staging--olumi.netlify.app'
const STARTERS = ['build-vs-buy', 'vendor-selection', 'market-entry', 'pricing-model', 'headcount-allocation'] as const

async function snap(page: Page) {
  return page.evaluate(() => {
    const r = (s: string) => { const e = document.querySelector(s) as HTMLElement | null; if (!e) return null; const b = e.getBoundingClientRect(); if (b.width <= 0 || b.height <= 0) return null; return { l: +b.left.toFixed(1), t: +b.top.toFixed(1), r: +b.right.toFixed(1), b: +b.bottom.toFixed(1) } }
    const vpEl = document.querySelector('.react-flow__viewport') as HTMLElement
    const m = /matrix\(([-0-9.eE]+),\s*[-0-9.eE]+,\s*[-0-9.eE]+,\s*[-0-9.eE]+,\s*([-0-9.eE]+),\s*([-0-9.eE]+)\)/.exec(getComputedStyle(vpEl).transform)
    const flow = document.querySelector('.react-flow')!.getBoundingClientRect()
    const dock = r('aside[aria-label="Outputs dock"]'), side = r('nav[aria-label="Canvas tools"]'), ban = r('[role="banner"]')
    const comp = r('[data-testid="floating-olumi-panel"]')
    const vis = { l: side ? Math.max(flow.left, side.r) : flow.left, t: ban ? Math.max(flow.top, ban.b) : flow.top, r: dock ? Math.min(flow.right, dock.l) : flow.right, b: flow.bottom }
    const all = [...document.querySelectorAll('.react-flow__node[data-id]')] as HTMLElement[]
    const nodes = all.filter((e) => !(e.dataset.id ?? '').startsWith('__ghost-')).map((e) => { const b = e.getBoundingClientRect(); return { id: e.dataset.id!, l: +b.left.toFixed(1), t: +b.top.toFixed(1), r: +b.right.toFixed(1), b: +b.bottom.toFixed(1) } })
    const outside = nodes.filter((n) => n.l < vis.l || n.t < vis.t || n.r > vis.r || n.b > vis.b).map((n) => n.id)
    const span = nodes.length ? { l: Math.min(...nodes.map(n=>n.l)), t: Math.min(...nodes.map(n=>n.t)), r: Math.max(...nodes.map(n=>n.r)), b: Math.max(...nodes.map(n=>n.b)) } : null
    return {
      pane: { w: flow.width, h: flow.height }, dock, side, ban, comp, vis,
      zoom: m ? +Number(m[1]).toFixed(6) : NaN, tx: m ? +Number(m[2]).toFixed(2) : NaN, ty: m ? +Number(m[3]).toFixed(2) : NaN,
      notice: (document.querySelector('[data-testid="model-extent-count"]') as HTMLElement | null)?.textContent ?? null,
      hasButton: !!document.querySelector('[data-testid="model-extent-show-all"]'),
      total: all.length, modelCount: nodes.length, ghosts: all.length - nodes.length,
      outsideVisible: outside, span,
    }
  })
}

async function timeline(page: Page, ms = 4000) {
  return page.evaluate(async (limit: number) => {
    const out: Array<{ t: number; tr: string }> = []
    const vpEl = document.querySelector('.react-flow__viewport') as HTMLElement
    const t0 = performance.now(); let last = ''
    await new Promise<void>((res) => { const tick = () => { const tr = getComputedStyle(vpEl).transform; if (tr !== last) { last = tr; out.push({ t: Math.round(performance.now() - t0), tr }) } ; if (performance.now() - t0 > limit) res(); else requestAnimationFrame(tick) }; requestAnimationFrame(tick) })
    return out
  }, ms)
}

async function boot(page: Page, starter: string) {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto(`${BASE}/#/canvas`, { waitUntil: 'domcontentloaded' })
  await page.locator('.react-flow').waitFor({ state: 'visible', timeout: 180_000 })
  const live = await page.evaluate(async () => { let f = 0; const t0 = performance.now(); await new Promise<void>((r) => { const tick = () => { f++; if (performance.now() - t0 >= 500) r(); else requestAnimationFrame(tick) }; requestAnimationFrame(tick) }); return f })
  expect(live, 'rAF starved — measurements worthless').toBeGreaterThan(15)
  await page.getByTestId(`starter-decision-${starter}`).click({ timeout: 60_000 })
  await page.waitForFunction(() => document.querySelectorAll('.react-flow__node[data-id]').length > 3, undefined, { timeout: 120_000 })
  await page.waitForTimeout(6000)
}

for (const starter of STARTERS) {
  for (const expand of [false, true]) {
    test(`STG ${starter} dock=${expand ? 'expanded' : 'collapsed'}`, async ({ page }) => {
      const label = `${starter}/${expand ? 'exp' : 'col'}`
      await boot(page, starter)
      if (expand) {
        await page.getByTestId('outputs-dock-rail-tab-results').click({ timeout: 30_000 }).catch(async () => {
          await page.getByTestId('dock-collapse-control').click({ timeout: 30_000 })
        })
        await page.waitForTimeout(4000)
      }
      const before = await snap(page)
      console.log(`STG[${label}] BEFORE ` + JSON.stringify(before))
      if (!before.hasButton) { console.log(`STG[${label}] NO-NOTICE`); return }
      await page.getByTestId('model-extent-show-all').click()
      console.log(`STG[${label}] TL ` + JSON.stringify(await timeline(page)))
      await page.waitForTimeout(1200)
      const after = await snap(page)
      console.log(`STG[${label}] AFTER ` + JSON.stringify(after))
      // click again — is it converged?
      if (after.hasButton) {
        await page.getByTestId('model-extent-show-all').click()
        await page.waitForTimeout(1500)
        console.log(`STG[${label}] AFTER2 ` + JSON.stringify(await snap(page)))
      }
    })
  }
}
