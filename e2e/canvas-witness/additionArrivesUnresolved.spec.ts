/**
 * ⭐⭐⭐ THE GOAL'S CLAUSE, MEASURED AT LAST: "unresolved additions remain
 * visibly unresolved and gain no fabricated value or relationship."
 *
 * MEASURED on served `53d651e6`, guest, canonical pricing board:
 *
 *   [ADDN] clicking="Add node"  ->  clicking2="● Factor"
 *   [ADDN] newNodes=["1"] newEdges=0
 *   [ADDN] node factor:1 label="Node 1"
 *   [ADDN]   observedState=null
 *   [ADDN]   stamps=[]
 *   [ADDN]   cardText="Needs input Node 1 Help me estimate this What else drives this?"
 *   [ADDN] fabricatedValue=false claimsUserAuthorship=false fabricatedEdges=0
 *   [ADDN] VERDICT PASS
 *
 * Three things at once, and all three are the clause: no value was invented,
 * no authorship was claimed, and NO EDGE was created — the card says
 * "Needs input" on its face and offers two ways to resolve it rather than
 * filling the gap itself.
 *
 * ⛔ THREE EARLIER PROBES RETURNED NOT-MEASURED, AND EVERY ONE WAS MY FAULT.
 * `canvas-add-to-model` carries `aria-haspopup="menu"`, so this is a THREE-step
 * gesture, and I twice guessed at the menu's roles — `getByRole('menuitem')`
 * and `getByRole('button', { name: /^add node$/i })` both found nothing while
 * the control sat there enabled. This version stops guessing: it DIFFS the set
 * of clickable controls before and after each click and acts on what actually
 * APPEARED. That diff is also the control — if nothing appears, the run is
 * NOT-MEASURED rather than a FAIL against a product that did nothing wrong.
 *
 * ⚠ It MUTATES the board (it adds a node), so it is a clean-scenario witness:
 * a fresh guest context every run, and the node it adds is the one it measures.
 */
import { test, expect } from '@playwright/test'
/**
 * THE GOAL'S CLAUSE: "unresolved additions remain visibly unresolved and gain
 * no fabricated value or relationship."
 * Three earlier probes returned NOT-MEASURED because I guessed the menu's
 * roles. This one DIFFS the DOM before and after the click and reports what
 * actually appeared, then acts on it.
 */
const EXAMPLE = /Pricing Model Transition Strategy/i
test('what does an added node arrive as?', async ({ browser }) => {
  test.setTimeout(280_000)
  const j = (await (await fetch('https://staging--olumi.netlify.app/version.json')).json()) as { commit: string; deploy_url: string }
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  await page.goto(j.deploy_url, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /continue without an account/i }).click()
  const p = page.getByRole('button', { name: EXAMPLE })
  await p.first().waitFor({ state: 'visible', timeout: 45_000 })
  expect(await p.count()).toBe(1)
  await p.first().click()
  await page.waitForTimeout(14_000)

  const snapshot = () => page.evaluate(() => {
    const st = (window as any).useCanvasStore.getState()
    const all = (st.nodes ?? []) as Array<any>
    return {
      nodeIds: all.map((n) => String(n.id)),
      edgeIds: ((st.edges ?? []) as Array<any>).map((e) => String(e.id)),
      clickable: Array.from(document.querySelectorAll('button,[role="menuitem"],[role="option"],a'))
        .map((e) => `${(e as HTMLElement).tagName.toLowerCase()}|${e.getAttribute('role') ?? ''}|${e.getAttribute('data-testid') ?? ''}|${((e as HTMLElement).innerText || e.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 40)}`),
    }
  })
  const before = await snapshot()
  console.log(`[ADDN] servedUI=${j.commit} nodes=${before.nodeIds.length} edges=${before.edgeIds.length}`)

  await page.locator('[data-testid="canvas-add-to-model"]').click()
  await page.waitForTimeout(2_500)
  const opened = await snapshot()
  const appeared = opened.clickable.filter((c) => !before.clickable.includes(c))
  console.log(`[ADDN] CONTROL controlsThatAPPEARED=${JSON.stringify(appeared, null, 1)}`)
  if (appeared.length === 0) { console.log('[ADDN] VERDICT NOT-MEASURED — the click revealed no new control'); await ctx.close(); return }

  // Pick the appeared control that names a node kind, else the first.
  const pickIdx = appeared.findIndex((c) => /factor|option|risk|outcome|node/i.test(c.split('|')[3] ?? ''))
  const target = appeared[pickIdx >= 0 ? pickIdx : 0]
  const targetText = target.split('|')[3]
  console.log(`[ADDN] clicking="${targetText}"`)
  await page.evaluate((want: string) => {
    const el = Array.from(document.querySelectorAll('button,[role="menuitem"],[role="option"],a'))
      .find((e) => ((e as HTMLElement).innerText || e.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 40) === want)
    ;(el as HTMLElement | undefined)?.click()
  }, targetText)
  await page.waitForTimeout(3_000)
  const second = await snapshot()
  const appeared2 = second.clickable.filter((c) => !opened.clickable.includes(c))
  if (appeared2.length > 0) {
    console.log(`[ADDN] secondStepControls=${JSON.stringify(appeared2.slice(0, 12), null, 1)}`)
    const k = appeared2.find((c) => /factor/i.test(c.split('|')[3] ?? '')) ?? appeared2[0]
    const kText = k.split('|')[3]
    console.log(`[ADDN] clicking2="${kText}"`)
    await page.evaluate((want: string) => {
      const el = Array.from(document.querySelectorAll('button,[role="menuitem"],[role="option"],a'))
        .find((e) => ((e as HTMLElement).innerText || e.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 40) === want)
      ;(el as HTMLElement | undefined)?.click()
    }, kText)
    await page.waitForTimeout(6_000)
  }

  const after = await snapshot()
  const newNodes = after.nodeIds.filter((id) => !before.nodeIds.includes(id))
  const newEdges = after.edgeIds.filter((id) => !before.edgeIds.includes(id))
  console.log(`[ADDN] newNodes=${JSON.stringify(newNodes)} newEdges=${newEdges.length}`)
  if (newNodes.length === 0) { console.log('[ADDN] VERDICT NOT-MEASURED — nothing was added to the canonical store'); await ctx.close(); return }

  const detail = await page.evaluate((ids: string[]) => {
    const nodes = ((window as any).useCanvasStore.getState().nodes ?? []) as Array<any>
    return ids.map((id) => {
      const n = nodes.find((x) => String(x.id) === id)
      const d = (n?.data ?? {}) as Record<string, unknown>
      const card = document.querySelector(`[data-id="${id}"]`) as HTMLElement | null
      return {
        id, kind: String(n?.type ?? '?'), label: String(d.label ?? ''),
        observed: (d.observedState ?? d.observed_state) ?? null,
        stamps: Object.keys(d).filter((k) => /source|origin|author|provenance|user|status|unresolved|confirmed|needs|incomplete/i.test(k)).map((k) => `${k}=${JSON.stringify(d[k])}`),
        cardText: (card?.innerText ?? '(no card)').replace(/\s+/g, ' ').slice(0, 180),
      }
    })
  }, newNodes)
  for (const d of detail) {
    console.log(`[ADDN] node ${d.kind}:${d.id} label="${d.label}"`)
    console.log(`[ADDN]   observedState=${JSON.stringify(d.observed)}`)
    console.log(`[ADDN]   stamps=${JSON.stringify(d.stamps)}`)
    console.log(`[ADDN]   cardText="${d.cardText}"`)
  }
  const fabricatedValue = detail.some((d) => (d.observed as { value?: unknown } | null)?.value != null)
  const claimsUser = detail.some((d) => d.stamps.some((s) => /user_override|user_stated|user_set/.test(s)))
  console.log(`[ADDN] fabricatedValue=${fabricatedValue} claimsUserAuthorship=${claimsUser} fabricatedEdges=${newEdges.length}`)
  console.log(`[ADDN] VERDICT ${!fabricatedValue && !claimsUser && newEdges.length === 0 ? 'PASS' : 'FAIL'}`)
  await ctx.close()
  expect(before.nodeIds.length).toBeGreaterThan(5)
})
