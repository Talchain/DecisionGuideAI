import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

const EXAMPLE = /Pricing Model Transition Strategy/i

async function pinnedOrigin() {
  const j = (await (await fetch('https://staging--olumi.netlify.app/version.json')).json()) as { commit: string; deploy_url: string }
  return { origin: j.deploy_url, build: j.commit }
}
async function clickNode(page: Page, id: string): Promise<boolean> {
  const fit = page.getByRole('button', { name: /fit to view/i }).first()
  if (await fit.count() > 0) { await fit.click().catch(() => {}); await page.waitForTimeout(2_500) }
  const box = await page.locator(`[data-id="${id}"]`).boundingBox().catch(() => null)
  if (!box) return false
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down(); await page.mouse.up()
  await page.waitForTimeout(3_500)
  return true
}

test('WHY NO TURN — full wire + notices during a pricing value edit, and full edge labels', async ({ page }) => {
  test.setTimeout(280_000)
  const wire: string[] = []
  page.on('request', (r) => { const u = r.url(); if (/\/(proxy|bff|assist|orchestrate)\//.test(u)) wire.push(`${r.method()} ${u.replace(/^https?:\/\/[^/]+/, '')}`) })
  const console_: string[] = []
  page.on('console', (m) => { const t = m.text(); if (/sendTurn|factor|edit|blocked|refus|deferred|scenario/i.test(t)) console_.push(`${m.type()}: ${t.slice(0, 200)}`) })

  const { origin, build } = await pinnedOrigin()
  console.log(`[WHY] servedUI=${build}`)
  await page.goto(origin, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /continue without an account/i }).click()
  const card = page.getByRole('button', { name: EXAMPLE })
  await card.waitFor({ state: 'visible', timeout: 45_000 })
  await card.click()
  await page.waitForTimeout(14_000)

  // FULL edge accessible names — my earlier read truncated at 110 chars and
  // reported an absence it could not see. NOT-MEASURED became a false negative.
  const edgeLabels = await page.evaluate(() => {
    const doms = Array.from(document.querySelectorAll('.react-flow__edge'))
    const names = doms.map((e) => (e as HTMLElement).getAttribute('aria-label') ?? '').filter(Boolean)
    return { count: doms.length, unique: Array.from(new Set(names.map((n) => n.replace(/^Connection from .*?\. /, '')))).slice(0, 8), first: names.slice(0, 3) }
  })
  console.log(`[WHY] edges=${edgeLabels.count}`)
  for (const f of edgeLabels.first) console.log(`[WHY]   FULL edge label: "${f}"`)
  console.log(`[WHY]   distinct suffixes: ${JSON.stringify(edgeLabels.unique)}`)

  const pre = await page.evaluate(() => {
    const st = (window as any).useCanvasStore.getState()
    return {
      scenario: st.currentScenarioId ?? null,
      lastServerGraphHash: st.lastServerGraphHash ?? null,
      messages: (st.messages ?? []).length,
    }
  })
  console.log(`[WHY] pre: scenario=${pre.scenario} lastServerGraphHash=${pre.lastServerGraphHash} messages=${pre.messages}`)

  const target = 'fac_adoption_friction'
  expect(await clickNode(page, target), 'CONTROL: no box').toBe(true)
  const field = page.getByPlaceholder(/enter value/i).first()
  expect(await field.count(), 'CONTROL: no writer').toBeGreaterThan(0)
  const mark = wire.length
  await field.click(); await field.fill('0.42'); await page.keyboard.press('Enter')
  await page.waitForTimeout(14_000)

  const post = await page.evaluate(() => {
    const st = (window as any).useCanvasStore.getState()
    const msgs = (st.messages ?? []) as Array<any>
    return {
      lastServerGraphHash: st.lastServerGraphHash ?? null,
      messages: msgs.length,
      lastFew: msgs.slice(-3).map((m) => ({ role: m.role, synthetic: m.synthetic ?? false, content: String(m.content ?? '').slice(0, 180) })),
    }
  })
  console.log(`[WHY] wire AFTER the edit: ${JSON.stringify(wire.slice(mark))}`)
  console.log(`[WHY] post: lastServerGraphHash=${post.lastServerGraphHash} messages=${pre.messages} -> ${post.messages}`)
  for (const m of post.lastFew) console.log(`[WHY]   msg ${m.role}${m.synthetic ? '(synthetic)' : ''}: "${m.content}"`)
  console.log(`[WHY] console lines of interest: ${JSON.stringify(console_.slice(0, 8))}`)
})
