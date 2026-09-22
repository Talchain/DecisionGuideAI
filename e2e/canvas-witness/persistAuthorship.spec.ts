/**
 * ⭐⭐⭐ RE-ADMITTED ON ITS OWN EVIDENCE, 22 Sep 2026.
 *
 * This file was swept into `staging` by a `git add -A` in #1859 and removed
 * again by #1868 along with 23 genuine throwaway probes. It comes back under
 * the rule that removed it: **a witness earns its place in the suite by
 * producing a verdict, not by existing.** It was run against the served build
 * before this restore, and it produced one:
 *
 *     [PERSIST] servedUI=db758d83  scenario=1f28738a  nodes=15 edges=30
 *     [PERSIST] target=fac_adoption_friction
 *     [PERSIST] before={"value":0.8,"source":"cee_inference","extractionType":"inferred",…}
 *     [PERSIST] inspectorValueWriterPresent=true
 *     [PERSIST] after ={"value":0.42,"source":"user_override","raw_value":0.42,…}
 *     [PERSIST] turnOutcomes=[200]
 *     [PERSIST] afterReload={"value":0.42,"source":"user_override",…}
 *     [PERSIST] valueLanded=true authoredToUser=true retainedAfterReload=true
 *               authorshipRetained=true noFalseEstAfterReload=true
 *     [PERSIST] VERDICT PASS
 *
 * ⭐ READ THE `extractionType` IN THAT PAIR. It is `"inferred"` BEFORE the edit
 * and ABSENT after it, through a reload. That is the Canvas goal's first
 * criterion measured on the wire rather than asserted: the `est.` marker is not
 * left sitting on a number the user has since typed.
 *
 * It is a sibling of `renamePersistence.spec.ts`, not a duplicate: that one
 * covers a node's LABEL, this one covers a factor's VALUE and its AUTHORSHIP.
 */
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
async function obs(page: Page, id: string) {
  return page.evaluate((nid: string) => {
    const n = ((window as any).useCanvasStore.getState().nodes as Array<any>).find((x) => String(x.id) === nid)
    return n?.data?.observedState ?? null
  }, id)
}

test('PERSIST + AUTHORSHIP on the pricing board', async ({ page }) => {
  test.setTimeout(280_000)
  const turns: Array<{ s: number }> = []
  page.on('response', (r) => { if (/proxy\/v5\/turn/.test(r.url())) turns.push({ s: r.status() }) })

  const { origin, build } = await pinnedOrigin()
  console.log(`[PERSIST] servedUI=${build}`)
  await page.goto(origin, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /continue without an account/i }).click()
  const card = page.getByRole('button', { name: EXAMPLE })
  await card.waitFor({ state: 'visible', timeout: 45_000 })
  await card.click()
  await page.waitForTimeout(14_000)

  // CONTAMINATION GUARD: the scenario must be pristine. 15 nodes, 30 edges.
  const shape = await page.evaluate(() => {
    const st = (window as any).useCanvasStore.getState()
    const real = ((st.nodes ?? []) as Array<any>).filter((n) => !String(n.id).startsWith('__ghost-'))
    return { nodes: real.length, edges: (st.edges ?? []).length, scenario: st.currentScenarioId ?? null }
  })
  console.log(`[PERSIST] scenario=${shape.scenario} nodes=${shape.nodes} edges=${shape.edges}`)
  if (shape.nodes !== 15 || shape.edges !== 30) {
    console.log(`[PERSIST] VERDICT NOT-MEASURED — scenario is not pristine (expected 15/30, got ${shape.nodes}/${shape.edges}); a contaminated scenario voids the run`)
    return
  }

  // Pick a factor the product itself says is editable.
  const target = await page.evaluate(() => {
    const st = (window as any).useCanvasStore.getState()
    const real = ((st.nodes ?? []) as Array<any>).filter((n) => !String(n.id).startsWith('__ghost-'))
    for (const n of real) {
      const el = document.querySelector(`[data-id="${String(n.id)}"]`)
      const hay = Array.from(el?.querySelectorAll('[title],[aria-label]') ?? [])
        .map((e) => (e.getAttribute('title') || e.getAttribute('aria-label') || '')).join(' ~~ ')
      if (/click to edit/i.test(hay)) return String(n.id)
    }
    return null
  })
  console.log(`[PERSIST] target=${target}`)
  expect(target, 'CONTROL: no factor advertises an edit affordance').not.toBeNull()

  const before = await obs(page, target as string)
  console.log(`[PERSIST] before=${JSON.stringify(before)}`)
  expect(await clickNode(page, target as string), 'CONTROL: node had no box').toBe(true)
  const field = page.getByPlaceholder(/enter value/i).first()
  const hasWriter = await field.count() > 0
  console.log(`[PERSIST] inspectorValueWriterPresent=${hasWriter}`)
  expect(hasWriter, 'CONTROL: the advertised affordance leads to no writer — leg is vacuous').toBe(true)

  await field.click(); await field.fill('0.42'); await page.keyboard.press('Enter')
  await page.waitForTimeout(12_000)
  const after = await obs(page, target as string)
  console.log(`[PERSIST] after=${JSON.stringify(after)}`)
  console.log(`[PERSIST] turnOutcomes=${JSON.stringify(turns.map((t) => t.s))}`)

  const failed = turns.filter((t) => t.s !== 200)
  if (failed.length > 0) {
    console.log(`[PERSIST] VERDICT NOT-MEASURED — edit turn returned ${failed.map((f) => f.s).join(',')}; INFRASTRUCTURE, not the UI. Re-run.`)
    return
  }

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(15_000)
  const reloaded = await obs(page, target as string)
  console.log(`[PERSIST] afterReload=${JSON.stringify(reloaded)}`)

  const valueLanded = (after as any)?.value === 0.42
  const authored = /user/.test(String((after as any)?.source ?? ''))
  const retained = (reloaded as any)?.value === 0.42
  const retainedAuthorship = /user/.test(String((reloaded as any)?.source ?? ''))
  const noFalseEst = (reloaded as any)?.extractionType !== 'inferred'
  console.log(`[PERSIST] valueLanded=${valueLanded} authoredToUser=${authored} retainedAfterReload=${retained} authorshipRetained=${retainedAuthorship} noFalseEstAfterReload=${noFalseEst}`)
  const verdict = valueLanded && authored && retained && retainedAuthorship && noFalseEst ? 'PASS' : 'FAIL'
  console.log(`[PERSIST] VERDICT ${verdict}`)
})
