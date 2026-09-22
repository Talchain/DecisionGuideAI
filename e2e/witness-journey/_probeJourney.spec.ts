import { test } from '@playwright/test'
const ORIGIN = process.env.WITNESS_ORIGIN ?? 'https://staging--olumi.netlify.app'
test('probe: open a real example and find the edit affordance', async ({ page }) => {
  await page.goto(ORIGIN, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /continue without an account/i }).click()
  await page.waitForTimeout(4000)
  // The user-facing example name, not the internal starter id.
  await page.getByText(/Usage-Based Billing System Approach/i).first().click().catch(() => {})
  await page.waitForLoadState('networkidle', { timeout: 40000 }).catch(() => {})
  await page.waitForTimeout(6000)
  const m1 = await page.evaluate(() => ({
    nodes: document.querySelectorAll('.react-flow__node').length,
    kinds: Array.from(document.querySelectorAll('.react-flow__node'))
      .map((e) => e.getAttribute('data-id') || '').filter(Boolean).slice(0, 24),
  }))
  console.log(`[J] board loaded nodes=${m1.nodes}`)
  console.log(`[J] ids=${JSON.stringify(m1.kinds)}`)
  if (m1.nodes === 0) { console.log('[J] ⛔ board did not load — stopping'); return }

  // Click a FACTOR by store id.
  const facId = await page.evaluate(() => {
    const st = (window as any).useCanvasStore?.getState?.()
    const f = st?.nodes?.find((n: any) => (n.type === 'factor' || n.data?.kind === 'factor') && !String(n.id).startsWith('__ghost-'))
    return f ? String(f.id) : null
  })
  console.log(`[J] factor id=${facId}`)
  if (facId) {
    await page.locator(`[data-id="${facId}"]`).click({ force: true }).catch(() => {})
    await page.waitForTimeout(3500)
  }
  const m2 = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input,textarea,select,[contenteditable="true"]')) as HTMLElement[]
    const nm = (e: Element) => (e.getAttribute('aria-label') || e.getAttribute('placeholder') || e.getAttribute('name') || '').trim().slice(0, 44)
    return {
      writers: inputs.map((e) => ({ tag: e.tagName.toLowerCase(), name: nm(e), ro: (e as HTMLInputElement).readOnly === true, dis: (e as HTMLInputElement).disabled === true })),
      panelText: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 520),
      readOnlyNotice: /read.?only|cannot be (edited|changed)|ask olumi/i.test(document.body.innerText || ''),
    }
  })
  console.log(`[J] writers after selecting a factor = ${JSON.stringify(m2.writers)}`)
  console.log(`[J] readOnlyNoticePresent=${m2.readOnlyNotice}`)
  console.log(`[J] text="${m2.panelText}"`)
})
