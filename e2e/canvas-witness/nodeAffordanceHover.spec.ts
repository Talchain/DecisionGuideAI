import { test, expect } from '@playwright/test'

const EXAMPLE = /Pricing Model Transition Strategy/i

async function pinnedOrigin() {
  const j = (await (await fetch('https://staging--olumi.netlify.app/version.json')).json()) as { commit: string; deploy_url: string }
  return { origin: j.deploy_url, build: j.commit }
}

/**
 * ⛔ RE-MEASURING MY OWN HEADLINE. I reported "9 of 15 nodes are silently
 * uneditable" from an AT-REST scan. On edges, the same at-rest method produced
 * FIVE consecutive false FAILs: the direct control lives in a HOVER popover, and
 * my hover point was the bezier's bounding-box centre, which is not on the curve.
 * So "no affordance at rest" may be "an affordance I never triggered".
 *
 * This hovers each node's real centre and inventories controls at BOTH stages.
 * A node counts as having an affordance if one appears at rest OR on hover, and
 * the difference between the two is itself the discoverability finding R2 asks
 * about — "immediately understand" is not the same as "findable on hover".
 */
test('NODE AFFORDANCE — at rest vs on hover, per node', async ({ page }) => {
  test.setTimeout(280_000)
  const { origin, build } = await pinnedOrigin()
  console.log(`[NA] servedUI=${build}`)
  await page.goto(origin, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /continue without an account/i }).click()
  const card = page.getByRole('button', { name: EXAMPLE })
  await card.waitFor({ state: 'visible', timeout: 45_000 })
  await card.click()
  await page.waitForTimeout(14_000)
  await page.getByRole('button', { name: /fit to view/i }).first().click().catch(() => {})
  await page.waitForTimeout(3_500)

  const ids = await page.evaluate(() =>
    ((window as any).useCanvasStore.getState().nodes as Array<any>)
      .filter((n) => !String(n.id).startsWith('__ghost-'))
      .map((n) => ({ id: String(n.id), type: String(n.type ?? n.data?.kind ?? '?') })))

  const probe = (id: string) => page.evaluate((nid: string) => {
    const el = document.querySelector(`[data-id="${nid}"]`) as HTMLElement | null
    if (!el) return null
    const titles = Array.from(el.querySelectorAll('[title]')).map((e) => e.getAttribute('title') ?? '')
    const ctrls = Array.from(el.querySelectorAll('button,[role="button"],input,[role="slider"],[contenteditable="true"]'))
      .map((e) => `${e.tagName.toLowerCase()}[${e.getAttribute('data-testid') ?? ''}]:${(e.getAttribute('aria-label') || (e as HTMLElement).textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40)}`)
    const hay = [...titles, ...ctrls].join(' ~~ ')
    return {
      editish: /click to edit|set strength|set value|edit|change this/i.test(hay),
      statesWhyNot: /outside your control|read.?only|cannot be edited|not editable|baseline/i.test(hay),
      liveWriters: Array.from(el.querySelectorAll('input,textarea,[role="slider"]')).filter((i) => { const e = i as HTMLInputElement; return !e.readOnly && !e.disabled }).length,
      ctrlCount: ctrls.length,
      sample: ctrls.filter((c) => /edit|set |change/i.test(c)).slice(0, 3),
    }
  }, id)

  const rows: Array<Record<string, unknown>> = []
  for (const n of ids) {
    const rest = await probe(n.id)
    const box = await page.locator(`[data-id="${n.id}"]`).boundingBox().catch(() => null)
    let hov = rest
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      await page.waitForTimeout(1_200)
      hov = await probe(n.id)
      await page.mouse.move(5, 5); await page.waitForTimeout(250)
    }
    rows.push({ ...n, restEdit: rest?.editish ?? false, hovEdit: hov?.editish ?? false, restCtrls: rest?.ctrlCount ?? 0, hovCtrls: hov?.ctrlCount ?? 0, statesWhyNot: (rest?.statesWhyNot || hov?.statesWhyNot) ?? false, sample: hov?.sample ?? [] })
    console.log(`[NA] ${n.type.padEnd(8)} ${n.id.padEnd(30)} rest:edit=${String(rest?.editish).padEnd(5)} ctrls=${String(rest?.ctrlCount).padEnd(2)} | hover:edit=${String(hov?.editish).padEnd(5)} ctrls=${String(hov?.ctrlCount).padEnd(2)} | statesWhyNot=${(rest?.statesWhyNot || hov?.statesWhyNot)} ${JSON.stringify(hov?.sample ?? [])}`)
  }

  const gained = rows.filter((r) => !r.restEdit && r.hovEdit)
  const silent = rows.filter((r) => !r.restEdit && !r.hovEdit && !r.statesWhyNot)
  const c1 = rows.length > 5
  const c2 = rows.some((r) => r.hovEdit)          // probe CAN see an affordance
  const c3 = rows.some((r) => !r.hovEdit)         // and CAN see its absence
  const c4 = rows.some((r) => (r.hovCtrls as number) > 0)
  console.log(`[NA] CONTROL nodes=${rows.length} affordanceSeen=${c2} absenceSeen=${c3} controlsReadable=${c4}`)
  console.log(`[NA] gainedOnHoverOnly=${gained.length}: ${JSON.stringify(gained.map((g) => g.id))}`)
  const measurable = c1 && c2 && c3 && c4
  console.log(`[NA] VERDICT ${measurable ? (silent.length === 0 ? 'PASS' : 'FAIL') : 'NOT-MEASURED'} — silentlyUneditable=${silent.length}/${rows.length}: ${JSON.stringify(silent.map((s) => s.type + ':' + s.id))}`)
  expect(measurable, 'NOT-MEASURED: a control did not fire').toBe(true)
})
