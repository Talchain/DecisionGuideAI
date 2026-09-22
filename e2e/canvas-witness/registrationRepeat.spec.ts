import { test } from '@playwright/test'

const BOARDS = [
  { re: /Pricing Model Transition Strategy/i, name: 'pricing' },
  { re: /Usage-Based Billing System Approach/i, name: 'billing' },
]

async function pinnedOrigin() {
  const j = (await (await fetch('https://staging--olumi.netlify.app/version.json')).json()) as { commit: string; deploy_url: string }
  return { origin: j.deploy_url, build: j.commit }
}

for (const board of BOARDS) {
  for (const attempt of [1, 2, 3]) {
    test(`REGISTRATION ${board.name} attempt ${attempt}`, async ({ page }) => {
      test.setTimeout(200_000)
      const warns: string[] = []
      page.on('console', (m) => {
        const t = m.text()
        if (/scenario_graph|import_registration|register/i.test(t)) warns.push(t.slice(0, 150))
      })
      const { origin, build } = await pinnedOrigin()
      await page.goto(origin, { waitUntil: 'domcontentloaded' })
      await page.getByRole('button', { name: /continue without an account/i }).click()
      const card = page.getByRole('button', { name: board.re })
      await card.waitFor({ state: 'visible', timeout: 45_000 })
      await card.click()
      await page.waitForTimeout(18_000)
      const st = await page.evaluate(() => {
        const s = (window as any).useCanvasStore.getState()
        return { hash: s.lastServerGraphHash ?? null, scenario: s.currentScenarioId ?? null, nodes: ((s.nodes ?? []) as any[]).filter((n) => !String(n.id).startsWith('__ghost-')).length }
      })
      const aborted = warns.some((w) => /aborted|transport_failure/i.test(w))
      const notAck = warns.some((w) => /not_acknowledged/i.test(w))
      console.log(`[REG] build=${build.slice(0, 8)} board=${board.name} attempt=${attempt} nodes=${st.nodes} hash=${st.hash === null ? 'NULL' : st.hash} aborted=${aborted} notAcknowledged=${notAck}`)
      if (warns.length) console.log(`[REG]   warns=${JSON.stringify(warns.slice(0, 4))}`)
    })
  }
}
