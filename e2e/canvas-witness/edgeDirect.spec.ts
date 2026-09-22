import { test, expect } from '@playwright/test'

const EXAMPLE = /Pricing Model Transition Strategy/i

async function pinnedOrigin() {
  const j = (await (await fetch('https://staging--olumi.netlify.app/version.json')).json()) as { commit: string; deploy_url: string }
  return { origin: j.deploy_url, build: j.commit }
}

/**
 * ⛔⛔ BOUND BY IDENTITY, after THREE locator misses on this one question.
 *
 *  1. `getByRole('button', {name:/^Change this$/})` — it is a TAB, not a button.
 *  2. counted a live `<input>` as an edge writer — it was the Olumi composer.
 *  3. searched `/^set strength$/` against `aria-label || textContent` — the
 *     button's VISIBLE text is "Set strength" but its aria-label is
 *     "Set the strength of the relationship between X and Y", so aria-label won
 *     and the pattern could never match.
 *
 * Each miss produced a confident FAIL about the product. The anchor that cannot
 * drift is the one the component declares:
 * `data-testid="edge-direct-strength-edit"` (`StyledEdge.tsx:2521`).
 *
 * ⭐ And every stage ALSO dumps what is actually present, so an absence is read
 * from a list rather than from a pattern that might not fit.
 */
test('EDGE DIRECT — bound by testid, with the full control inventory at each stage', async ({ page }) => {
  test.setTimeout(240_000)
  const { origin, build } = await pinnedOrigin()
  console.log(`[ED] servedUI=${build}`)
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
      const byTestId = document.querySelectorAll('[data-testid="edge-direct-strength-edit"]')
      const edgeLabelArea = Array.from(document.querySelectorAll('.react-flow__edgelabel-renderer *'))
      const controls = edgeLabelArea
        .filter((e) => /^(button|input|a)$/i.test(e.tagName) || e.getAttribute('role'))
        .map((e) => `${e.tagName.toLowerCase()}[${e.getAttribute('data-testid') ?? ''}]:"${((e as HTMLElement).textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 34)}"`)
      return {
        directByTestId: byTestId.length,
        directVisible: Array.from(byTestId).filter((e) => (e as HTMLElement).getClientRects().length > 0).length,
        edgeLabelControls: Array.from(new Set(controls)).slice(0, 10),
        sliders: document.querySelectorAll('[role="slider"],input[type="range"]').length,
        numberInputs: document.querySelectorAll('input[type="number"]').length,
      }
    })
    console.log(`[ED] ${stage}: directByTestId=${s.directByTestId} (visible ${s.directVisible}) sliders=${s.sliders} numberInputs=${s.numberInputs}`)
    console.log(`[ED]    edgeLabelControls=${JSON.stringify(s.edgeLabelControls)}`)
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

  const stages: Array<[string, () => Promise<void>]> = [
    ['0 · at rest', async () => {}],
    ['1 · HOVER', async () => { await page.mouse.move(g.x, g.y); await page.waitForTimeout(2_500) }],
    ['2 · SINGLE click', async () => { await page.mouse.click(g.x, g.y); await page.waitForTimeout(3_000) }],
    ['3 · DOUBLE click', async () => { await page.mouse.dblclick(g.x, g.y); await page.waitForTimeout(4_000) }],
  ]
  let firstSeen = 'NEVER'
  for (const [name, act] of stages) {
    await act()
    const s = await look(name)
    if (firstSeen === 'NEVER' && s.directVisible > 0) firstSeen = name
  }
  console.log(`[ED] direct control first VISIBLE at: ${firstSeen}`)

  if (firstSeen !== 'NEVER') {
    await page.locator('[data-testid="edge-direct-strength-edit"]').first().click()
    await page.waitForTimeout(4_500)
    const s4 = await look('4 · after clicking the direct control')
    const reached = s4.sliders > 0 || s4.numberInputs > 0
    console.log(`[ED] VERDICT ${reached ? 'PASS — the promise is kept' : 'FAIL — the direct control opens no writer'}`)
  } else {
    console.log(`[ED] VERDICT FAIL — bound by testid, the direct control never becomes visible; the accessible name still promises it`)
  }
})
