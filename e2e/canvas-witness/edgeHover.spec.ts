import { test, expect } from '@playwright/test'

const EXAMPLE = /Pricing Model Transition Strategy/i

async function pinnedOrigin() {
  const j = (await (await fetch('https://staging--olumi.netlify.app/version.json')).json()) as { commit: string; deploy_url: string }
  return { origin: j.deploy_url, build: j.commit }
}

/**
 * THE CONTROL I WAS MISSING, and it is the fourth correction on this question.
 *
 * The edge quick-action cluster lives inside a HOVER POPOVER
 * (`StyledEdge.tsx` ~2455, `data-testid="edge-hover-popover-unset"`). So
 * "no controls in the edge-label renderer" is ambiguous between
 *   (a) the popover rendered and holds no direct control  -> FAIL is licensed
 *   (b) my hover never opened the popover at all          -> NOT-MEASURED
 * and I had no way to tell them apart. This establishes (a) vs (b) FIRST, by
 * requiring a popover to appear for SOME edge before any absence is reported.
 */
test('EDGE HOVER — establish the popover opens before claiming what is in it', async ({ page }) => {
  test.setTimeout(240_000)
  const { origin, build } = await pinnedOrigin()
  console.log(`[EH] servedUI=${build}`)
  await page.goto(origin, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /continue without an account/i }).click()
  const card = page.getByRole('button', { name: EXAMPLE })
  await card.waitFor({ state: 'visible', timeout: 45_000 })
  await card.click()
  await page.waitForTimeout(14_000)
  await page.getByRole('button', { name: /fit to view/i }).first().click().catch(() => {})
  await page.waitForTimeout(3_000)

  // Candidate points along several on-screen edges' interaction paths.
  const cands = await page.evaluate(() => {
    const out: Array<{ id: string; x: number; y: number }> = []
    const doms = Array.from(document.querySelectorAll('.react-flow__edge')) as HTMLElement[]
    for (const g of doms) {
      const p = g.querySelector('path.react-flow__edge-interaction') ?? g.querySelector('path')
      const el = p as SVGPathElement | null
      if (!el) continue
      try {
        const len = el.getTotalLength()
        for (const frac of [0.5, 0.35, 0.65]) {
          const pt = el.getPointAtLength(len * frac)
          const svg = el.ownerSVGElement
          if (!svg) continue
          const m = el.getScreenCTM()
          if (!m) continue
          const sx = m.a * pt.x + m.c * pt.y + m.e
          const sy = m.b * pt.x + m.d * pt.y + m.f
          if (sx > 40 && sy > 40 && sx < window.innerWidth - 40 && sy < window.innerHeight - 40) {
            out.push({ id: g.getAttribute('data-id') ?? g.className.toString().slice(0, 20), x: Math.round(sx), y: Math.round(sy) })
            break
          }
        }
      } catch { /* a path with no length is not a candidate */ }
      if (out.length >= 10) break
    }
    return out
  })
  console.log(`[EH] candidate hover points on screen: ${cands.length}`)
  expect(cands.length, 'CONTROL: no edge path yielded an on-screen point').toBeGreaterThan(0)

  let popoverSeen = false
  let directSeen = false
  let inventory: string[] = []
  for (const c of cands) {
    await page.mouse.move(c.x - 30, c.y - 30)
    await page.waitForTimeout(200)
    await page.mouse.move(c.x, c.y)
    await page.waitForTimeout(1_800)
    const s = await page.evaluate(() => {
      const pops = Array.from(document.querySelectorAll('[data-testid^="edge-hover-popover"], [data-testid*="edge-hover"]'))
      const direct = document.querySelectorAll('[data-testid="edge-direct-strength-edit"]').length
      const region = document.querySelectorAll('.react-flow__edgelabel-renderer')
      const ctrls = Array.from(region).flatMap((r) => Array.from(r.querySelectorAll('button,[role="button"],input,[role="slider"]')))
        .map((e) => `${e.tagName.toLowerCase()}[${e.getAttribute('data-testid') ?? ''}]:"${((e as HTMLElement).textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 30)}"`)
      return { pops: pops.length, popText: (pops[0]?.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 160), direct, ctrls: Array.from(new Set(ctrls)).slice(0, 10) }
    })
    if (s.pops > 0 || s.ctrls.length > 0) {
      popoverSeen = popoverSeen || s.pops > 0
      if (s.ctrls.length) inventory = s.ctrls
      if (s.direct > 0) directSeen = true
      console.log(`[EH] at (${c.x},${c.y}) edge=${c.id}: popovers=${s.pops} direct=${s.direct} ctrls=${JSON.stringify(s.ctrls)}`)
      if (s.popText) console.log(`[EH]    popText="${s.popText}"`)
      if (directSeen) break
    }
  }
  console.log(`[EH] CONTROL popoverEverOpened=${popoverSeen} anyEdgeLabelControlSeen=${inventory.length > 0}`)
  if (!popoverSeen && inventory.length === 0) {
    console.log('[EH] VERDICT NOT-MEASURED — no edge popover ever opened, so absence of the direct control is unproven')
  } else {
    console.log(`[EH] VERDICT ${directSeen ? 'PASS — direct control present on hover' : 'FAIL — popover opens and the direct control is absent'}`)
    console.log(`[EH]   what the popover DOES offer: ${JSON.stringify(inventory)}`)
  }
})
