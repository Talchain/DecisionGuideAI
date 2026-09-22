import { test, expect } from '@playwright/test'

const EXAMPLE = /Pricing Model Transition Strategy/i

async function pinnedOrigin() {
  const j = (await (await fetch('https://staging--olumi.netlify.app/version.json')).json()) as { commit: string; deploy_url: string }
  return { origin: j.deploy_url, build: j.commit }
}

/**
 * ⭐ AN OPTION HAS A REAL SERVER-GRAPH CARRIER AND THE PANEL SHOWS NO EDITOR.
 *
 * `option` IS a member of `AUTHORITY_OWNING_PANELS`, so `OptionPanel` is NOT
 * behind the blanket `<fieldset disabled>`, and `proposeOptionIntervention` is
 * a dispatching `option_intervention_edit` carrier. Yet the destination probe
 * found `option 0/4 reach a live editor` on arrival, while showing the
 * read-only fence COPY and no fenced fieldset — a combination that says the
 * capability is there and the reader cannot see it.
 *
 * ⛔ THE PROBE THAT REPORTED 0 MAY SIMPLY NOT HAVE OPENED WHAT HOLDS IT. That
 * is the exact error that produced five false FAILs on edges, so this one does
 * the opening: it expands every collapsible thing in the dock and re-counts,
 * and it reports the DIFFERENCE. A control that appears only after expansion is
 * a discoverability finding; one that never appears is a capability finding.
 * They are different claims and this separates them.
 *
 * Geometry-free: every action is `locator.click()` on a named element.
 */
test('OPTION EDITOR REACH — on arrival vs after expanding', async ({ page }) => {
  test.setTimeout(280_000)
  const { origin, build } = await pinnedOrigin()
  console.log(`[OE] servedUI=${build}`)
  await page.goto(origin, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /continue without an account/i }).click()
  const card = page.getByRole('button', { name: EXAMPLE })
  await card.waitFor({ state: 'visible', timeout: 45_000 })
  await card.click()
  await page.waitForTimeout(14_000)
  await page.getByRole('button', { name: /fit to view/i }).first().click().catch(() => {})
  await page.waitForTimeout(3_000)

  const options = await page.evaluate(() =>
    ((window as any).useCanvasStore.getState().nodes as Array<any>)
      .filter((n) => String(n.type ?? n.data?.kind) === 'option')
      .map((n) => ({ id: String(n.id), label: String(n.data?.label ?? '') })))

  const readDock = () => page.evaluate(() => {
    const flow = document.querySelector('.react-flow')
    const out = (e: Element) => !(flow && flow.contains(e))
    const all = Array.from(document.querySelectorAll('input,textarea,select,[role="slider"]')).filter(out)
    const live = all.filter((e) => {
      const i = e as HTMLInputElement
      if (i.readOnly || i.disabled || i.closest('fieldset[disabled]')) return false
      const lab = (i.getAttribute('aria-label') || i.getAttribute('placeholder') || '').toLowerCase()
      return !/message|ask olumi|type a|chat/.test(lab)
    })
    const collapsed = Array.from(document.querySelectorAll('[aria-expanded="false"]')).filter(out)
    return {
      live: live.length,
      liveNames: live.map((e) => (e.getAttribute('aria-label') || e.getAttribute('placeholder') || '?').slice(0, 44)),
      collapsed: collapsed.length,
      collapsedNames: collapsed.map((e) => (e.textContent || e.getAttribute('aria-label') || '?').replace(/\s+/g, ' ').trim().slice(0, 40)),
    }
  })

  const rows: Array<Record<string, unknown>> = []
  for (const o of options) {
    await page.locator(`[data-id="${o.id}"]`).first().click({ timeout: 8_000 }).catch(() => {})
    await page.waitForTimeout(1_500)
    const before = await readDock()
    // Open everything the dock says is shut — twice, since one group can reveal
    // another.
    for (let pass = 0; pass < 2; pass += 1) {
      const shut = page.locator('[aria-expanded="false"]')
      const n = await shut.count()
      for (let i = 0; i < n; i += 1) {
        await shut.nth(0).click({ timeout: 4_000 }).catch(() => {})
        await page.waitForTimeout(400)
      }
    }
    await page.waitForTimeout(1_200)
    const after = await readDock()
    rows.push({ ...o, liveBefore: before.live, liveAfter: after.live, collapsedBefore: before.collapsed, names: after.liveNames.slice(0, 6), shut: before.collapsedNames.slice(0, 6) })
    console.log(`[OE] ${o.id.padEnd(18)} liveOnArrival=${before.live} liveAfterExpanding=${after.live} collapsedOnArrival=${before.collapsed}`)
    console.log(`[OE]    shutOnArrival=${JSON.stringify(before.collapsedNames.slice(0, 6))}`)
    console.log(`[OE]    liveAfter=${JSON.stringify(after.liveNames.slice(0, 6))}`)
  }

  const anyArrival = rows.some((r) => (r.liveBefore as number) > 0)
  const anyAfter = rows.some((r) => (r.liveAfter as number) > 0)
  console.log(`[OE] CONTROL options=${rows.length} liveOnArrivalAnywhere=${anyArrival} liveAfterExpandingAnywhere=${anyAfter}`)
  console.log(
    `[OE] VERDICT ${rows.length === 0 ? 'NOT-MEASURED' : anyAfter && !anyArrival ? 'DISCOVERABILITY — the editor exists but arrives shut' : anyArrival ? 'PASS — an editor is live on arrival' : 'CAPABILITY — no editor appears even after expanding everything'}`,
  )
  expect(rows.length, 'NOT-MEASURED: no option nodes found').toBeGreaterThan(0)
})
