import { test } from '@playwright/test'

const EXAMPLE = /Pricing Model Transition Strategy/i

async function pinnedOrigin() {
  const j = (await (await fetch('https://staging--olumi.netlify.app/version.json')).json()) as { commit: string; deploy_url: string }
  return { origin: j.deploy_url, build: j.commit }
}

/**
 * The UI aborts the scenario-graph call at `DEFAULT_TIMEOUT_MS = 8000`
 * (`adapters/cee/scenarioGraph.ts:97`) and does so on 6 of 6 loads across both
 * boards. This asks the question that decides the fix: is 8 s a NEAR MISS, or
 * does the call never answer?
 *
 * Raising a timeout to cover a call that never returns is chasing a symptom;
 * raising one that misses by a second is the fix. The number decides it.
 */
test('REGISTER LATENCY — near miss or hopeless', async ({ page }) => {
  test.setTimeout(240_000)
  const started = new Map<string, number>()
  const results: Array<{ path: string; ms: number; status: number | 'ABORTED/FAILED' }> = []
  page.on('request', (r) => {
    const u = r.url()
    if (/\/bff\/cee\/scenarios\/[^/]+\/graph|graph\/register|graph-readiness|proxy\/v5\/turn/.test(u)) {
      started.set(r.url() + r.method() + Math.random().toString(36).slice(2), Date.now())
      ;(r as any).__t = Date.now()
    }
  })
  page.on('requestfinished', (r) => {
    const u = r.url()
    if (!/\/bff\/cee\/scenarios\/[^/]+\/graph|graph\/register|graph-readiness|proxy\/v5\/turn/.test(u)) return
    const t = (r as any).__t as number | undefined
    r.response().then((resp) => {
      results.push({ path: u.replace(/^https?:\/\/[^/]+/, '').slice(0, 64), ms: t ? Date.now() - t : -1, status: resp?.status() ?? -1 })
    }).catch(() => {})
  })
  page.on('requestfailed', (r) => {
    const u = r.url()
    if (!/\/bff\/cee\/scenarios\/[^/]+\/graph|graph\/register|graph-readiness|proxy\/v5\/turn/.test(u)) return
    const t = (r as any).__t as number | undefined
    results.push({ path: u.replace(/^https?:\/\/[^/]+/, '').slice(0, 64), ms: t ? Date.now() - t : -1, status: 'ABORTED/FAILED' })
  })

  const { origin, build } = await pinnedOrigin()
  console.log(`[LAT] servedUI=${build}`)
  await page.goto(origin, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /continue without an account/i }).click()
  const card = page.getByRole('button', { name: EXAMPLE })
  await card.waitFor({ state: 'visible', timeout: 45_000 })
  await card.click()
  // Observe for 75 s — far beyond the 8 s deadline, so a late answer is visible.
  await page.waitForTimeout(75_000)

  for (const r of results) console.log(`[LAT] ${String(r.status).padEnd(14)} ${String(r.ms).padStart(6)}ms  ${r.path}`)
  const aborted = results.filter((r) => r.status === 'ABORTED/FAILED')
  const ok = results.filter((r) => typeof r.status === 'number' && r.status === 200)
  console.log(`[LAT] TALLY total=${results.length} ok200=${ok.length} abortedOrFailed=${aborted.length}`)
  if (ok.length) {
    const ms = ok.map((r) => r.ms).sort((a, b) => a - b)
    console.log(`[LAT] successful call durations ms: min=${ms[0]} median=${ms[Math.floor(ms.length / 2)]} max=${ms[ms.length - 1]}`)
  }
  const st = await page.evaluate(() => {
    const s = (window as any).useCanvasStore.getState()
    return { hash: s.lastServerGraphHash ?? null }
  })
  console.log(`[LAT] after 75s: lastServerGraphHash=${st.hash === null ? 'STILL NULL' : st.hash}`)
})
