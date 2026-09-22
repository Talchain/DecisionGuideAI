import { test, expect } from '@playwright/test'
const EXAMPLE = /Usage-Based Billing System Approach/i
async function pinnedOrigin() {
  const j = (await (await fetch('https://staging--olumi.netlify.app/version.json')).json()) as { commit: string; deploy_url: string }
  return { origin: j.deploy_url, build: j.commit.slice(0, 8) }
}
test('FULL card text, valued vs valueless, after an analysis', async ({ page }) => {
  test.setTimeout(300_000)
  const { origin, build } = await pinnedOrigin()
  console.log(`[CARD] build=${build}`)
  await page.goto(origin, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /continue without an account/i }).click()
  const card = page.getByRole('button', { name: EXAMPLE })
  await card.waitFor({ state: 'visible', timeout: 45_000 }); await card.click()
  await page.waitForTimeout(12_000)
  const runBtn = page.getByRole('button', { name: /^Run the analysis$/i }).first()
  if (await runBtn.count() > 0) {
    await runBtn.click()
    for (let i = 0; i < 40; i++) {
      await page.waitForTimeout(5_000)
      const done = await page.evaluate(() => /most influential/i.test(document.body.textContent ?? ''))
      if (done) { console.log(`[CARD] analysis surfaced at ~${(i + 1) * 5}s`); break }
    }
  } else {
    console.log('[CARD] no Run control — board may already carry a result')
  }
  const dump = await page.evaluate(() => {
    const nodes = ((window as any).useCanvasStore.getState().nodes ?? []) as Array<any>
    const facs = nodes.filter((n) => (n.type === 'factor' || n.data?.kind === 'factor') && !String(n.id).startsWith('__ghost-'))
    const pick = (want: boolean) => facs.find((n) => (typeof (n.data?.observedState ?? {}).value === 'number') === want)
    const render = (n: any) => {
      if (!n) return null
      const el = document.querySelector(`[data-id="${String(n.id)}"]`) as HTMLElement | null
      // Strip sr-only first: innerText unions the visible and screen-reader
      // documents, which inflates any duplication reading.
      const clone = el?.cloneNode(true) as HTMLElement | undefined
      clone?.querySelectorAll('.sr-only').forEach((e) => e.remove())
      return {
        id: String(n.id),
        obs: n.data?.observedState ?? null,
        visible: (clone?.textContent ?? '').replace(/\s+/g, ' ').trim(),
        srOnly: Array.from(el?.querySelectorAll('.sr-only') ?? []).map((e) => (e.textContent ?? '').replace(/\s+/g, ' ').trim()),
      }
    }
    return { valued: render(pick(true)), valueless: render(pick(false)) }
  })
  console.log(`[CARD] === VALUED ===`)
  console.log(`[CARD] obs=${JSON.stringify(dump.valued?.obs)}`)
  console.log(`[CARD] visible="${dump.valued?.visible}"`)
  console.log(`[CARD] srOnly=${JSON.stringify(dump.valued?.srOnly)}`)
  console.log(`[CARD] === VALUELESS ===`)
  console.log(`[CARD] obs=${JSON.stringify(dump.valueless?.obs)}`)
  console.log(`[CARD] visible="${dump.valueless?.visible}"`)
  console.log(`[CARD] srOnly=${JSON.stringify(dump.valueless?.srOnly)}`)
  expect(dump.valued, 'CONTROL: no valued factor found').not.toBeNull()
})
