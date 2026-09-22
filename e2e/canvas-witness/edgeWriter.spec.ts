import { test, expect } from '@playwright/test'

const EXAMPLE = /Pricing Model Transition Strategy/i

async function pinnedOrigin() {
  const j = (await (await fetch('https://staging--olumi.netlify.app/version.json')).json()) as { commit: string; deploy_url: string }
  return { origin: j.deploy_url, build: j.commit }
}

/**
 * The edge promise is *"Double-click to set its strength"*. Double-click opens
 * the relationship inspector, which states *"The link strength saves to the
 * shared model"* — but no writer is mounted at that moment. This finishes the
 * measurement: how many further actions does the user need, and is there a
 * writer at the end of them?
 *
 * ⚠ Wire-independent by design. CEE staging is degraded, so this asks only what
 * the CANVAS offers, never whether a write lands.
 */
test('EDGE WRITER — how far from the promise to an actual writer', async ({ page }) => {
  test.setTimeout(240_000)
  const { origin, build } = await pinnedOrigin()
  console.log(`[EW] servedUI=${build}`)
  await page.goto(origin, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /continue without an account/i }).click()
  const card = page.getByRole('button', { name: EXAMPLE })
  await card.waitFor({ state: 'visible', timeout: 45_000 })
  await card.click()
  await page.waitForTimeout(14_000)
  await page.getByRole('button', { name: /fit to view/i }).first().click().catch(() => {})
  await page.waitForTimeout(3_000)

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

  const snap = async (stage: string) => {
    const s = await page.evaluate(() => {
      const dlgs = Array.from(document.querySelectorAll('[role="dialog"]')) as HTMLElement[]
      const panel = dlgs.map((d) => (d.textContent ?? '').replace(/\s+/g, ' ').trim()).sort((a, b) => b.length - a.length)[0] ?? ''
      return {
        dialogs: dlgs.length,
        live: document.querySelectorAll('input:not([readonly]):not([disabled]),textarea:not([readonly]):not([disabled]),[contenteditable="true"]').length,
        readonly: document.querySelectorAll('input[readonly],input[disabled]').length,
        sliders: document.querySelectorAll('input[type="range"],[role="slider"]').length,
        buttons: Array.from(document.querySelectorAll('[role="dialog"] button')).map((b) => (b.getAttribute('aria-label') || b.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 10),
        panel: panel.slice(0, 200),
      }
    })
    console.log(`[EW] ${stage}: dialogs=${s.dialogs} liveWriters=${s.live} readonly=${s.readonly} sliders=${s.sliders}`)
    console.log(`[EW]    buttons=${JSON.stringify(s.buttons)}`)
    return s
  }

  let clicks = 0
  await snap('0 · at rest')
  await page.mouse.move(g.x, g.y); await page.waitForTimeout(500)
  await page.mouse.dblclick(g.x, g.y); clicks += 2
  await page.waitForTimeout(4_500)
  const s1 = await snap(`${clicks} · after double-click`)

  // Follow the panel's own affordance, whatever it is called.
  const next = page.getByRole('button', { name: /^Change this$/i }).first()
  if (await next.count() > 0) {
    await next.click(); clicks += 1
    await page.waitForTimeout(4_000)
    const s2 = await snap(`${clicks} · after "Change this"`)
    const reached = s2.live > 0 || s2.sliders > 0
    console.log(`[EW] VERDICT ${reached ? 'PASS' : 'FAIL'} — writer reached after ${clicks} clicks (promise implies 2)`)
    console.log(`[EW] promiseHonest=${reached && clicks <= 2} extraActionsBeyondPromise=${Math.max(0, clicks - 2)}`)
  } else {
    console.log(`[EW] no "Change this" control in the panel; buttons were ${JSON.stringify(s1.buttons)}`)
    console.log(`[EW] VERDICT FAIL — the promise leads to no writer and no onward route`)
  }
})
