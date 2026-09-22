import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

const EXAMPLE = /Pricing Model Transition Strategy/i

async function pinnedOrigin() {
  const j = (await (await fetch('https://staging--olumi.netlify.app/version.json')).json()) as { commit: string; deploy_url: string }
  return { origin: j.deploy_url, build: j.commit }
}

/** On-path point via getPointAtLength + getScreenCTM. A bezier's bbox centre is not on the curve. */
async function onPathPoint(page: Page): Promise<{ x: number; y: number } | null> {
  const cands = await page.evaluate(() => {
    const out: Array<{ x: number; y: number }> = []
    for (const g of Array.from(document.querySelectorAll('.react-flow__edge'))) {
      const el = (g.querySelector('path.react-flow__edge-interaction') ?? g.querySelector('path')) as SVGPathElement | null
      if (!el) continue
      try {
        const len = el.getTotalLength(); const m = el.getScreenCTM(); if (!m) continue
        for (const f of [0.5, 0.35, 0.65]) {
          const p = el.getPointAtLength(len * f)
          const x = m.a * p.x + m.c * p.y + m.e, y = m.b * p.x + m.d * p.y + m.f
          if (x > 40 && y > 40 && x < window.innerWidth - 40 && y < window.innerHeight - 40) { out.push({ x: Math.round(x), y: Math.round(y) }); break }
        }
      } catch { /* zero-length */ }
      if (out.length >= 8) break
    }
    return out
  })
  for (const c of cands) {
    await page.mouse.move(c.x - 30, c.y - 30); await page.waitForTimeout(150)
    await page.mouse.move(c.x, c.y); await page.waitForTimeout(1_600)
    if (await page.locator('[data-testid="edge-direct-strength-edit"]').count() > 0) return c
  }
  return null
}
const writers = (page: Page) => page.evaluate(() => ({
  sliders: document.querySelectorAll('[role="slider"],input[type="range"]').length,
  live: Array.from(document.querySelectorAll('input,textarea'))
    .filter((i) => { const e = i as HTMLInputElement; return !e.readOnly && !e.disabled && !/Ask about this model/i.test(e.placeholder ?? '') }).length,
}))

test('DOUBLE-CLICK PROMISE — does the advertised gesture produce the editor', async ({ page }) => {
  test.setTimeout(240_000)
  const { origin, build } = await pinnedOrigin()
  console.log(`[DCP] servedUI=${build}`)
  await page.goto(origin, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /continue without an account/i }).click()
  const card = page.getByRole('button', { name: EXAMPLE })
  await card.waitFor({ state: 'visible', timeout: 45_000 })
  await card.click()
  await page.waitForTimeout(14_000)
  await page.getByRole('button', { name: /fit to view/i }).first().click().catch(() => {})
  await page.waitForTimeout(3_000)

  const at = await onPathPoint(page)
  console.log(`[DCP] CONTROL onPathPointFound=${at !== null} at=${JSON.stringify(at)}`)
  expect(at, 'NOT-MEASURED: no on-path point that opens the popover').not.toBeNull()
  const p = at as NonNullable<typeof at>

  // ── ARM A · the ADVERTISED gesture, on the same point that works for hover ──
  await page.mouse.dblclick(p.x, p.y)
  await page.waitForTimeout(5_000)
  const a = await writers(page)
  console.log(`[DCP] ARM A  double-click  -> sliders=${a.sliders} liveWriters=${a.live}`)

  // Reset, then ── ARM B · the route that is KNOWN to work, as the control ─────
  await page.keyboard.press('Escape'); await page.waitForTimeout(1_500)
  await page.mouse.move(20, 20); await page.waitForTimeout(800)
  const at2 = await onPathPoint(page)
  if (at2) {
    await page.locator('[data-testid="edge-direct-strength-edit"]').first().click()
    await page.waitForTimeout(5_000)
  }
  const b = await writers(page)
  console.log(`[DCP] ARM B  "Set strength" -> sliders=${b.sliders} liveWriters=${b.live}`)

  const discriminating = b.sliders > 0
  console.log(`[DCP] CONTROL armBProducedTheEditor=${discriminating}`)
  if (!discriminating) {
    console.log('[DCP] VERDICT NOT-MEASURED — the known-good route did not produce the editor either, so ARM A proves nothing')
  } else {
    const verdict = a.sliders > 0 ? 'PASS — double-click produces the editor, the promise is kept' : 'FAIL — the advertised gesture does NOT produce the editor; only hover + "Set strength" does'
    console.log(`[DCP] VERDICT ${verdict}`)
  }
})
