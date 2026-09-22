import { test, expect } from '@playwright/test'
const EXAMPLE = /Usage-Based Billing System Approach/i
async function pinnedOrigin() {
  const j = (await (await fetch('https://staging--olumi.netlify.app/version.json')).json()) as { commit: string; deploy_url: string }
  return { origin: j.deploy_url, build: j.commit.slice(0, 8) }
}
test('does any VALUELESS factor carry a rank badge on screen', async ({ page }) => {
  const { origin, build } = await pinnedOrigin()
  console.log(`[RANK] build=${build}`)
  await page.goto(origin, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /continue without an account/i }).click()
  const card = page.getByRole('button', { name: EXAMPLE })
  await card.waitFor({ state: 'visible', timeout: 45_000 }); await card.click()
  await page.waitForTimeout(12_000)
  const rows = await page.evaluate(() => {
    const nodes = ((window as any).useCanvasStore.getState().nodes ?? []) as Array<any>
    return nodes
      .filter((n) => (n.type === 'factor' || n.data?.kind === 'factor') && !String(n.id).startsWith('__ghost-'))
      .map((n) => {
        const obs = n.data?.observedState ?? n.data?.observed_state ?? {}
        const el = document.querySelector(`[data-id="${String(n.id)}"]`) as HTMLElement | null
        // FULL textContent, never a windowed regex — a truncation and a terse
        // answer are byte-identical.
        const card = (el?.textContent ?? '').replace(/\s+/g, ' ').trim()
        return {
          id: String(n.id),
          label: String(n.data?.label ?? '').slice(0, 44),
          hasValue: typeof obs.value === 'number',
          value: obs.value,
          displayValue: n.data?.display_value ?? null,
          // The licensed rank readouts, matched on the product's own words.
          rankOnCard: /most influential|influence|of \d+ factors|#\d/i.test(card),
          rankPhrase: (card.match(/(most influential[^.]{0,40}|influence[^.]{0,30}|of \d+ factors)/i) || [])[0] ?? null,
          needsInput: /needs input|not estimated|no value/i.test(card),
        }
      })
  })
  console.log(`[RANK] factors=${rows.length}`)
  for (const r of rows) {
    console.log(`[RANK] ${r.hasValue ? 'VALUE ' : 'NOVALUE'} ${r.id} "${r.label}" value=${JSON.stringify(r.value)} display=${JSON.stringify(r.displayValue)} rankOnCard=${r.rankOnCard} phrase=${JSON.stringify(r.rankPhrase)} needsInput=${r.needsInput}`)
  }
  const offenders = rows.filter((r) => !r.hasValue && r.rankOnCard)
  console.log(`[RANK] VERDICT valueless=${rows.filter((r) => !r.hasValue).length} valuelessWithRank=${offenders.length}`)
  // CONTROL: the probe must be able to SEE a rank somewhere, or a zero above is vacuous.
  console.log(`[RANK] CONTROL anyRankSeenAtAll=${rows.some((r) => r.rankOnCard)}`)
  expect(rows.length, 'CONTROL: no factors read — board did not load').toBeGreaterThan(3)
})
