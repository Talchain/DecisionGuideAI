import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

const EXAMPLE = /Pricing Model Transition Strategy/i

async function pinnedOrigin() {
  const j = (await (await fetch('https://staging--olumi.netlify.app/version.json')).json()) as { commit: string; deploy_url: string }
  return { origin: j.deploy_url, build: j.commit }
}

/**
 * ⭐ HOW TO HOVER AN SVG EDGE, banked because four false FAILs came from getting
 * it wrong: the BOUNDING-BOX CENTRE of a bezier path is usually NOT ON THE PATH.
 * For a curved edge the box centre sits in empty space, so the hover never
 * registers and every downstream absence reads as a product defect.
 * `getPointAtLength(len * 0.5)` mapped through `getScreenCTM()` lands on the
 * curve itself and worked first try.
 */
async function hoverEdge(page: Page): Promise<{ x: number; y: number } | null> {
  const cands = await page.evaluate(() => {
    const out: Array<{ x: number; y: number }> = []
    for (const g of Array.from(document.querySelectorAll('.react-flow__edge'))) {
      const el = (g.querySelector('path.react-flow__edge-interaction') ?? g.querySelector('path')) as SVGPathElement | null
      if (!el) continue
      try {
        const len = el.getTotalLength()
        const m = el.getScreenCTM()
        if (!m) continue
        for (const f of [0.5, 0.35, 0.65]) {
          const p = el.getPointAtLength(len * f)
          const x = m.a * p.x + m.c * p.y + m.e
          const y = m.b * p.x + m.d * p.y + m.f
          if (x > 40 && y > 40 && x < window.innerWidth - 40 && y < window.innerHeight - 40) { out.push({ x: Math.round(x), y: Math.round(y) }); break }
        }
      } catch { /* zero-length path */ }
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

test('EDGE EDITOR — what the direct control opens, and can a strength be committed', async ({ page }) => {
  test.setTimeout(240_000)
  const { origin, build } = await pinnedOrigin()
  console.log(`[EE] servedUI=${build}`)
  await page.goto(origin, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /continue without an account/i }).click()
  const card = page.getByRole('button', { name: EXAMPLE })
  await card.waitFor({ state: 'visible', timeout: 45_000 })
  await card.click()
  await page.waitForTimeout(14_000)
  await page.getByRole('button', { name: /fit to view/i }).first().click().catch(() => {})
  await page.waitForTimeout(3_000)

  const at = await hoverEdge(page)
  console.log(`[EE] CONTROL hoverOpenedDirectControl=${at !== null} at=${JSON.stringify(at)}`)
  expect(at, 'NOT-MEASURED: could not open the edge popover, so nothing below is licensed').not.toBeNull()

  await page.locator('[data-testid="edge-direct-strength-edit"]').first().click()
  await page.waitForTimeout(4_500)

  const ed = await page.evaluate(() => {
    const live = Array.from(document.querySelectorAll('input,textarea,[role="slider"],[contenteditable="true"]'))
      .filter((i) => { const e = i as HTMLInputElement; return !e.readOnly && !e.disabled })
      .filter((i) => !/Ask about this model/i.test((i as HTMLInputElement).placeholder ?? ''))
    const dlgs = Array.from(document.querySelectorAll('[role="dialog"]')) as HTMLElement[]
    const editor = dlgs.filter((d) => /strength/i.test(d.textContent ?? '')).sort((a, b) => (b.textContent ?? '').length - (a.textContent ?? '').length)[0] ?? null
    return {
      liveWriters: live.length,
      kinds: live.map((w) => `${w.tagName.toLowerCase()}:${(w as HTMLInputElement).type ?? ''}`).slice(0, 6),
      values: live.map((w) => (w as HTMLInputElement).value ?? '').slice(0, 6),
      sliders: document.querySelectorAll('[role="slider"],input[type="range"]').length,
      editorFound: editor != null,
      editorText: (editor?.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 260),
      buttons: Array.from(editor?.querySelectorAll('button') ?? []).map((b) => (b.getAttribute('aria-label') || b.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 8),
    }
  })
  console.log(`[EE] after clicking "Set strength": liveWriters=${ed.liveWriters} kinds=${JSON.stringify(ed.kinds)} values=${JSON.stringify(ed.values)} sliders=${ed.sliders}`)
  console.log(`[EE] editorFound=${ed.editorFound} text="${ed.editorText}"`)
  console.log(`[EE] editorButtons=${JSON.stringify(ed.buttons)}`)
  const verdict = ed.liveWriters > 0 || ed.sliders > 0 ? 'PASS — a live strength writer is reachable' : 'FAIL — the direct control opens no writer'
  console.log(`[EE] VERDICT ${verdict}`)
})
