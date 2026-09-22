import { test, expect } from '@playwright/test'

const EXAMPLE = /Pricing Model Transition Strategy/i

async function pinnedOrigin() {
  const j = (await (await fetch('https://staging--olumi.netlify.app/version.json')).json()) as { commit: string; deploy_url: string }
  return { origin: j.deploy_url, build: j.commit }
}

/**
 * Every edge's accessible name ends *"Double-click to set its strength"*.
 * That is a PROMISE. This asks whether the product keeps it.
 *
 * ⚠ A real pointer double-click on the edge PATH, not `force: true` and not the
 * group — a React Flow edge's handler sits on the interaction layer and a
 * forced click never reaches it.
 */
test('EDGE PROMISE — does double-click actually open a strength editor', async ({ page }) => {
  test.setTimeout(240_000)
  const { origin, build } = await pinnedOrigin()
  console.log(`[PROMISE] servedUI=${build}`)
  await page.goto(origin, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /continue without an account/i }).click()
  const card = page.getByRole('button', { name: EXAMPLE })
  await card.waitFor({ state: 'visible', timeout: 45_000 })
  await card.click()
  await page.waitForTimeout(14_000)
  await page.getByRole('button', { name: /fit to view/i }).first().click().catch(() => {})
  await page.waitForTimeout(3_000)

  const before = await page.evaluate(() => ({
    dialogs: document.querySelectorAll('[role="dialog"]').length,
    inputs: document.querySelectorAll('input:not([readonly]):not([disabled])').length,
    edges: (((window as any).useCanvasStore.getState().edges) ?? []).length,
  }))
  console.log(`[PROMISE] before: dialogs=${before.dialogs} liveInputs=${before.inputs} edges=${before.edges}`)

  // Pick an edge that ADVERTISES the promise, and aim at its interaction path.
  const geo = await page.evaluate(() => {
    const doms = Array.from(document.querySelectorAll('.react-flow__edge')) as HTMLElement[]
    for (const g of doms) {
      const name = g.getAttribute('aria-label') ?? ''
      if (!/double-click to set its strength/i.test(name)) continue
      const path = g.querySelector('path.react-flow__edge-interaction') ?? g.querySelector('path')
      const r = (path as SVGPathElement | null)?.getBoundingClientRect()
      if (!r || r.width < 8 || r.height < 2) continue
      if (r.left < 0 || r.top < 0 || r.right > window.innerWidth || r.bottom > window.innerHeight) continue
      return { name: name.slice(0, 120), x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), w: Math.round(r.width), h: Math.round(r.height) }
    }
    return null
  })
  console.log(`[PROMISE] target=${JSON.stringify(geo)}`)
  expect(geo, 'CONTROL: no on-screen edge advertising the promise — leg is vacuous').not.toBeNull()

  const g = geo as NonNullable<typeof geo>
  await page.mouse.move(g.x, g.y)
  await page.waitForTimeout(600)
  await page.mouse.dblclick(g.x, g.y)
  await page.waitForTimeout(5_000)

  const after = await page.evaluate(() => {
    const dlgs = Array.from(document.querySelectorAll('[role="dialog"]')) as HTMLElement[]
    return {
      dialogs: dlgs.length,
      inputs: document.querySelectorAll('input:not([readonly]):not([disabled])').length,
      readOnlyInputs: document.querySelectorAll('input[readonly],input[disabled]').length,
      panelText: dlgs.map((d) => (d.textContent ?? '').replace(/\s+/g, ' ').trim()).sort((a, b) => b.length - a.length)[0]?.slice(0, 300) ?? '',
      strengthWriter: document.querySelectorAll('input[type="range"], [role="slider"]').length,
    }
  })
  console.log(`[PROMISE] after: dialogs=${after.dialogs} liveInputs=${after.inputs} readOnlyInputs=${after.readOnlyInputs} sliders=${after.strengthWriter}`)
  console.log(`[PROMISE] panel="${after.panelText}"`)

  const openedSomething = after.dialogs > before.dialogs
  const gainedAWriter = after.inputs > before.inputs || after.strengthWriter > 0
  const mentionsStrength = /strength/i.test(after.panelText)
  console.log(`[PROMISE] openedSomething=${openedSomething} gainedAWriter=${gainedAWriter} panelMentionsStrength=${mentionsStrength}`)
  const verdict = openedSomething && gainedAWriter ? 'PASS' : openedSomething ? 'PARTIAL — opened, but no live writer' : 'FAIL — the promise does nothing'
  console.log(`[PROMISE] VERDICT ${verdict}`)
})
