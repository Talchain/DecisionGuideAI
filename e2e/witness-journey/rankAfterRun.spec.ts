import { test, expect } from '@playwright/test'
const EXAMPLE = /Usage-Based Billing System Approach/i
async function pinnedOrigin() {
  const j = (await (await fetch('https://staging--olumi.netlify.app/version.json')).json()) as { commit: string; deploy_url: string }
  return { origin: j.deploy_url, build: j.commit.slice(0, 8) }
}
test('DELIBERATE PAID RUN — does a valueless factor carry a rank after analysis', async ({ page }) => {
  test.setTimeout(300_000)
  const { origin, build } = await pinnedOrigin()
  console.log(`[RUN] build=${build}`)
  await page.goto(origin, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /continue without an account/i }).click()
  const card = page.getByRole('button', { name: EXAMPLE })
  await card.waitFor({ state: 'visible', timeout: 45_000 }); await card.click()
  await page.waitForTimeout(12_000)

  const pre = await page.evaluate(() => {
    const nodes = ((window as any).useCanvasStore.getState().nodes ?? []) as Array<any>
    return nodes.filter((n) => (n.type === 'factor' || n.data?.kind === 'factor') && !String(n.id).startsWith('__ghost-'))
      .map((n) => ({ id: String(n.id), hasValue: typeof (n.data?.observedState ?? {}).value === 'number' }))
  })
  console.log(`[RUN] pre: factors=${pre.length} valueless=${pre.filter((p) => !p.hasValue).length}`)

  const runBtn = page.getByRole('button', { name: /^Run the analysis$/i }).first()
  expect(await runBtn.count(), 'CONTROL: no Run control — the paid leg is unreachable').toBeGreaterThan(0)
  await runBtn.click()
  console.log('[RUN] clicked Run the analysis')

  // Poll for completion rather than guessing a duration.
  let phase = 'unknown'
  for (let i = 0; i < 48; i++) {
    await page.waitForTimeout(5_000)
    phase = await page.evaluate(() => {
      const t = (document.body.textContent ?? '').replace(/\s+/g, ' ')
      if (/Analysis complete|Results|most influential/i.test(t) && !/Preparing|Running the analysis/i.test(t)) return 'complete'
      if (/Preparing|Running the analysis|Analysing/i.test(t)) return 'running'
      return 'idle'
    })
    if (phase === 'complete') { console.log(`[RUN] complete at ~${(i + 1) * 5}s`); break }
  }
  console.log(`[RUN] final phase=${phase}`)

  const rows = await page.evaluate(() => {
    const nodes = ((window as any).useCanvasStore.getState().nodes ?? []) as Array<any>
    return nodes.filter((n) => (n.type === 'factor' || n.data?.kind === 'factor') && !String(n.id).startsWith('__ghost-'))
      .map((n) => {
        const obs = n.data?.observedState ?? n.data?.observed_state ?? {}
        const el = document.querySelector(`[data-id="${String(n.id)}"]`) as HTMLElement | null
        const cardText = (el?.textContent ?? '').replace(/\s+/g, ' ').trim()
        return {
          id: String(n.id),
          label: String(n.data?.label ?? '').slice(0, 40),
          hasValue: typeof obs.value === 'number',
          rankPhrase: (cardText.match(/(most influential[^.]{0,50}|of \d+ factors[^.]{0,20}|influence \d+%)/i) || [])[0] ?? null,
          pct: (cardText.match(/(\d{1,3})%/) || [])[0] ?? null,
        }
      })
  })
  for (const r of rows) {
    console.log(`[RUN] ${r.hasValue ? 'VALUE ' : 'NOVALUE'} ${r.id} "${r.label}" rank=${JSON.stringify(r.rankPhrase)} pct=${JSON.stringify(r.pct)}`)
  }
  const anyRank = rows.some((r) => r.rankPhrase !== null)
  const offenders = rows.filter((r) => !r.hasValue && r.rankPhrase !== null)
  console.log(`[RUN] CONTROL anyRankSeenAtAll=${anyRank}`)
  console.log(`[RUN] VERDICT valueless=${rows.filter((r) => !r.hasValue).length} valuelessWithRank=${offenders.length}`)
  if (!anyRank) console.log('[RUN] ⛔ VACUOUS — no rank rendered anywhere, so the zero above proves nothing')
})
