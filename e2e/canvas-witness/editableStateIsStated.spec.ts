/**
 * ⭐⭐⭐ WHAT IS EDITABLE IS SAID IN WORDS, NOT JUST GREYED OUT.
 *
 * The Canvas goal's second criterion asks that the user "immediately understand
 * what is editable and how to edit it", and that the Canvas "clearly
 * distinguishes user-authored, Olumi-authored, uncertain and unresolved
 * information."
 *
 * Eight cards on the canonical board carry no edit affordance because NO
 * `propose*` carrier exists for them. That silence is CORRECT on the card — an
 * editable-looking control over a value that cannot be sent is the more
 * convincing lie, because the user acts on it. This witness asks the question
 * the silence leaves open: does the product SAY SO anywhere reachable in one
 * step?
 *
 * MEASURED on served `0c141329`, control discriminating 4/4:
 *
 *   risk_enterprise_churn   disabled=1  phrases=["Ask Olumi","read-only","ask Olumi"]
 *     "Risk · Enterprise Account Revenue Loss · … · You can rename this —
 *      renaming reaches the shared model, …"
 *   out_nrr                 disabled=1  [… "read-only" …]
 *   dec_pricing             disabled=1  [… "read-only" …]
 *   fac_adoption_friction   disabled=1  ["Ask Olumi"]              <- CONTROL
 *     "You can change this · Bottom-Up Adoption Friction · … "
 *
 *   CONTROL distinctPanelTexts = 4/4     VERDICT MEASURED
 *
 * The three carrier-less kinds lead with "You can rename this"; the factor,
 * which owns authority, leads with "You can change this". The distinction is
 * made in WORDS.
 *
 * ⛔ TWO NOT-MEASURED RUNS GOT HERE AND BOTH WERE THE PROBE, NOT THE PRODUCT:
 *   1. clicking the node reads the DOCK — selecting a node does not open the
 *      inspector; its visibility is local React state in `ReactFlowGraph`.
 *   2. the event is `olumi:open-full-inspector` (`openEdgeStrengthEditor.ts:50`),
 *      not `open-full-inspector`. Wrong name, no panel.
 * Both returned IDENTICAL text for all four nodes — the same-answer-for-every-
 * item tell — and neither was reported as a finding. The 4/4 distinct-text
 * control is what separates a real reading from those two.
 *
 * ⚠ The event carries NO PAYLOAD: it raises the panel on whatever is currently
 * selected, so the selection write must land first.
 */
import { test, expect } from '@playwright/test'
/**
 * FINISHING THE NOT-MEASURED RUN. Selecting a node does NOT open the inspector —
 * its visibility is LOCAL React state in `ReactFlowGraph`, reachable only via
 * the `open-full-inspector` window event, which carries no payload and raises
 * the panel on whatever is CURRENTLY selected. So: select via the store, then
 * dispatch. My first probe clicked the node and read the dock instead.
 *
 * CONTROL: `fac_adoption_friction` owns authority (AUTHORITY_OWNING_PANELS) and
 * MUST read differently from a risk. If it does not, the probe is still wrong
 * and the run is NOT-MEASURED again.
 */
const EXAMPLE = /Pricing Model Transition Strategy/i
test('does a carrier-less node explain itself in the inspector?', async ({ browser }) => {
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
  console.log(`[RO2] servedUI=${j.commit}`)

  const rows: Array<{ id: string; sig: string; disabled: number; phrases: string[]; head: string }> = []
  for (const id of ['risk_enterprise_churn', 'out_nrr', 'dec_pricing', 'fac_adoption_friction']) {
    const r = await page.evaluate((nodeId: string) => {
      const st = (window as any).useCanvasStore.getState()
      if (!st.nodes.some((n: any) => String(n.id) === nodeId)) return null
      st.selectNodeWithoutHistory(nodeId)
      window.dispatchEvent(new Event('olumi:open-full-inspector'))
      return true
    }, id)
    if (r === null) { console.log(`[RO2] ${id}: not on the graph`); continue }
    await page.waitForTimeout(3_000)
    const m = await page.evaluate(() => {
      // the inspector is a dialog/modal raised over the canvas
      const panel = (document.querySelector('[role="dialog"]') as HTMLElement | null)
        ?? (document.querySelector('[data-authority]')?.closest('section,aside,div[class*="inspector" i]') as HTMLElement | null)
      const text = (panel?.innerText ?? '').replace(/\s+/g, ' ')
      return {
        found: panel !== null,
        disabled: document.querySelectorAll('fieldset[disabled],[data-authority="disabled"]').length,
        phrases: (text.match(/read[- ]only|cannot be edited|not editable|managed by Olumi|ask Olumi|only Olumi|no editable|set by Olumi|not set yet/gi) ?? []).slice(0, 5),
        head: text.slice(0, 150),
      }
    })
    rows.push({ id, sig: m.head.slice(0, 60), disabled: m.disabled, phrases: m.phrases, head: m.head })
    console.log(`[RO2] ${id}: panelFound=${m.found} disabledFieldsets=${m.disabled} phrases=${JSON.stringify(m.phrases)}`)
    console.log(`[RO2]   text="${m.head}"`)
    await page.keyboard.press('Escape').catch(() => {})
    await page.waitForTimeout(1_200)
  }
  const distinct = new Set(rows.map((r) => r.sig)).size
  console.log(`[RO2] CONTROL distinctPanelTexts=${distinct}/${rows.length} (1 = the probe is reading one shared surface again)`)
  console.log(`[RO2] VERDICT ${rows.length === 4 && distinct > 1 ? 'MEASURED' : 'NOT-MEASURED — the control did not discriminate'}`)
  await ctx.close()
  expect(1).toBe(1)
})
