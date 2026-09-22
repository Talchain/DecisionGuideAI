import { test, expect } from '@playwright/test'

const EXAMPLE = /Pricing Model Transition Strategy/i

async function pinnedOrigin() {
  const j = (await (await fetch('https://staging--olumi.netlify.app/version.json')).json()) as { commit: string; deploy_url: string }
  return { origin: j.deploy_url, build: j.commit }
}

/**
 * ⛔ CORRECTING MY OWN SCOPE ERROR. I measured "no edge writer" by looking only
 * inside the inspector dialog after a double-click, and was about to publish
 * FAIL. `edges/StyledEdge.tsx:2530` renders a DIRECT BUTTON —
 * `EDGE_AFFORDANCE_DIRECT_ACTION = 'Set strength'` — and its module docblock
 * records exactly why: on 19 Sep the founder had an edge under the pointer for
 * 34 minutes, took 27 actions, and never found a direct edit.
 *
 * So this searches the WHOLE PAGE for the direct control at each stage — at
 * rest, on hover, on single click, on double-click — because "discoverable"
 * depends entirely on which of those it takes, and that is R2's actual question.
 */
test('EDGE SET STRENGTH — where the direct control lives, and what it takes to find it', async ({ page }) => {
  test.setTimeout(240_000)
  const { origin, build } = await pinnedOrigin()
  console.log(`[ESS] servedUI=${build}`)
  await page.goto(origin, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /continue without an account/i }).click()
  const card = page.getByRole('button', { name: EXAMPLE })
  await card.waitFor({ state: 'visible', timeout: 45_000 })
  await card.click()
  await page.waitForTimeout(14_000)
  await page.getByRole('button', { name: /fit to view/i }).first().click().catch(() => {})
  await page.waitForTimeout(3_000)

  const look = async (stage: string) => {
    const s = await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll('button,[role="button"],[role="tab"],[role="slider"],input,textarea'))
      const named = all.map((e) => ({
        t: (e.getAttribute('aria-label') || (e as HTMLElement).textContent || (e as HTMLInputElement).placeholder || '').replace(/\s+/g, ' ').trim(),
        tag: e.tagName.toLowerCase(),
        vis: (e as HTMLElement).offsetParent !== null || (e as HTMLElement).getClientRects().length > 0,
      }))
      const setStrength = named.filter((n) => /^set strength$/i.test(n.t))
      const adjust = named.filter((n) => /adjust strength|ask olumi to adjust/i.test(n.t))
      const sliders = document.querySelectorAll('[role="slider"],input[type="range"]').length
      return {
        setStrength: setStrength.map((s2) => `${s2.tag}${s2.vis ? '(visible)' : '(hidden)'}`),
        adjust: adjust.map((s2) => `${s2.t}:${s2.tag}${s2.vis ? '(visible)' : '(hidden)'}`),
        sliders,
      }
    })
    console.log(`[ESS] ${stage}: "Set strength"=${JSON.stringify(s.setStrength)} adjustRoutes=${JSON.stringify(s.adjust)} sliders=${s.sliders}`)
    return s
  }

  const geo = await page.evaluate(() => {
    const doms = Array.from(document.querySelectorAll('.react-flow__edge')) as HTMLElement[]
    for (const g of doms) {
      if (!/double-click to set its strength/i.test(g.getAttribute('aria-label') ?? '')) continue
      const p = g.querySelector('path.react-flow__edge-interaction') ?? g.querySelector('path')
      const r = (p as SVGPathElement | null)?.getBoundingClientRect()
      if (!r || r.width < 8) continue
      if (r.left < 0 || r.top < 0 || r.right > window.innerWidth || r.bottom > window.innerHeight) continue
      return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }
    }
    return null
  })
  expect(geo, 'CONTROL: no on-screen edge advertising the promise').not.toBeNull()
  const g = geo as NonNullable<typeof geo>

  const s0 = await look('0 · at rest')
  await page.mouse.move(g.x, g.y); await page.waitForTimeout(2_500)
  const s1 = await look('1 · on HOVER')
  await page.mouse.click(g.x, g.y); await page.waitForTimeout(3_000)
  const s2 = await look('2 · after SINGLE click (selected)')
  await page.mouse.dblclick(g.x, g.y); await page.waitForTimeout(4_000)
  const s3 = await look('3 · after DOUBLE click')

  const firstStage = s0.setStrength.length ? 'at rest' : s1.setStrength.length ? 'hover' : s2.setStrength.length ? 'single click' : s3.setStrength.length ? 'double click' : 'NEVER'
  console.log(`[ESS] "Set strength" first appears at: ${firstStage}`)

  if (firstStage !== 'NEVER') {
    const btn = page.getByRole('button', { name: /^Set strength$/i }).first()
    if (await btn.count() > 0) {
      await btn.click()
      await page.waitForTimeout(4_000)
      const s4 = await look('4 · after clicking "Set strength"')
      const reached = s4.sliders > 0 || (await page.locator('input[type="number"],input[type="range"],[role="slider"]').count()) > 0
      console.log(`[ESS] VERDICT ${reached ? 'PASS — the promise is kept' : 'FAIL — the direct control opens no writer'}`)
    } else {
      console.log(`[ESS] VERDICT NOT-MEASURED — present in the DOM but not reachable by role=button`)
    }
  } else {
    console.log(`[ESS] VERDICT FAIL — the direct control never appears through rest/hover/click/double-click`)
  }
})
