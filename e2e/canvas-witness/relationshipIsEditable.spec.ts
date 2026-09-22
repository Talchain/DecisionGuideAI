/**
 * ⭐⭐⭐ CRITERION 2's LAST EDIT TYPE: RELATIONSHIPS.
 *
 * The goal asks that "common edits — values, labels, nodes and RELATIONSHIPS
 * where supported — are discoverable and low-friction". Values, labels and
 * nodes each have a witness. Relationships had none.
 *
 * MEASURED on served `df0e86ad`, guest, canonical pricing board, every control
 * firing:
 *
 *   CONTROL zoom=1.0368 lodRung=full      (labels do not render below `full`)
 *   CONTROL causalEdges=14/30  sampling=["e-4","e-5","e-6"]
 *           NOT ["e-0","e-1","e-2"] — those are decision->option STRUCTURAL
 *           edges, weight 1, quiet by design
 *   CONTROL fabricated=0        CONTROL distinctPanelTexts=3/3
 *
 *   e-4  panel=true  operableControls=2  disabledFieldsets=1
 *     "Relationship · Bottom-Up Adoption Friction -> Bottom-Up New Logo
 *      Acquisition · 88% · Ask Olumi · Change this · Its analysis ·
 *      THE LINK STRENGTH SAVES TO THE SHARED MODEL. OTHER EDITS HERE ARE NOT
 *      SENT YET. Labels, details and coaching still work."
 *
 *   VERDICT MEASURED — the editor opens, carries live controls, and states the
 *   carrier boundary IN WORDS.
 *
 * ⛔ THIS LANE HAS FIVE FALSE FAILS ON EDGES, all one cause: the bounding-box
 * centre of a curved edge is not ON the edge, so the hover never landed.
 * NOTHING HERE HOVERS A PATH. It binds to `data-testid` anchors and drives the
 * editor through `openEdgeStrengthEditor`'s own route — select via the store,
 * then `olumi:open-full-inspector`.
 *
 * ⛔ AND FOUR MORE WRONG POPULATIONS WERE CAUGHT BY CONTROLS BEFORE THIS READ:
 *   1. looked for edge labels at the OPENING rung (`quiet`) — they need `full`.
 *   2. treated 0 labels at rest as a missing population — the design system
 *      rules the board QUIET AT REST; numbers arrive on selection.
 *   3. sampled edges[0..2] — decision->option STRUCTURAL edges, not the thing
 *      the criterion asks about. Reporting "0 operable controls" from those
 *      would have been the sixth false FAIL.
 *   4. filtered on `data.strength` / `data.strength_mean` — neither exists.
 *      The field is `data.weight`, DUMPED rather than guessed.
 * Each was caught because a control did not discriminate. None was published.
 */
import { test, expect } from '@playwright/test'
/**
 * CRITERION 2, THE UNMEASURED CLAUSE: "common edits — values, labels, nodes and
 * RELATIONSHIPS where supported — are discoverable and low-friction."
 *
 * ⛔ THIS LANE HAS FIVE FALSE FAILS ON EDGES, all one cause: the bounding-box
 * centre of a curved edge is not ON the edge, so the hover never landed. So
 * nothing here hovers a path. It binds to `data-testid` anchors, and it drives
 * the editor through `openEdgeStrengthEditor`'s OWN route (select via the
 * store, then the `olumi:open-full-inspector` event) — the route the product
 * uses. A control that does not fire is NOT-MEASURED.
 */
const EXAMPLE = /Pricing Model Transition Strategy/i
test('is editing a relationship discoverable?', async ({ browser }) => {
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
  console.log(`[EDGE] servedUI=${j.commit}`)

  // ⛔ ZOOM TO THE `full` RUNG FIRST. The board opens at `quiet` (0.417-0.714)
  // and the first version of this probe found 0 label anchors there — looking
  // for a population the rung does not render is the same wrong-population
  // error that produced this lane's five false edge FAILs.
  for (let i = 0; i < 4; i++) {
    await page.getByRole('button', { name: /zoom in/i }).first().click().catch(() => {})
    await page.waitForTimeout(700)
  }
  await page.waitForTimeout(2_500)
  const rung = await page.evaluate(() => {
    const vp = document.querySelector('.react-flow__viewport') as HTMLElement | null
    const m = /scale\(([-0-9.]+)\)/.exec(vp?.style.transform ?? '')
    return { zoom: m ? Number(m[1]) : null, lodRung: (window as any).useCanvasStore.getState().lodRung ?? '(none)' }
  })
  console.log(`[EDGE] CONTROL zoom=${rung.zoom} lodRung=${rung.lodRung} (need 'full' / >=0.714)`)

  // ---- discoverability: what does an edge SAY on the board? -----------------
  const board = await page.evaluate(() => {
    const st = (window as any).useCanvasStore.getState()
    const edges = (st.edges ?? []) as Array<any>
    const labels = Array.from(document.querySelectorAll('[data-testid="edge-influence-label"],[data-testid="causal-edge-label"],[data-testid="evidence-edge-label"],[data-testid="edge-label-leader"]')) as HTMLElement[]
    const says = labels.map((e) => ({
      title: (e.getAttribute('title') ?? '').replace(/\s+/g, ' ').slice(0, 110),
      aria: (e.getAttribute('aria-label') ?? '').replace(/\s+/g, ' ').slice(0, 110),
    }))
    const VOCAB = /click to edit|set strength|change|edit|adjust|double-click/i
    return {
      edges: edges.length,
      // ⛔ THE FIELD IS `weight`, DUMPED not guessed. Four earlier predicates
      // (`strength`, `strength_mean`) matched nothing and produced causal=0.
      causal: edges.filter((e: any) => typeof e.data?.weight === 'number' && e.data.weight !== 1).length,
      labelEls: labels.length,
      advertising: says.filter((s) => VOCAB.test(s.title) || VOCAB.test(s.aria)).length,
      sample: says.slice(0, 3),
      fabricated: /frobnicate the edge/i.test(document.body.innerHTML) ? 1 : 0,
      firstEdgeId: String(edges[0]?.id ?? ''),
      // ⛔ CAUSAL edges only. The first version sampled edges[0..3], which on
      // this board are decision->option STRUCTURAL edges — strength 1, quiet by
      // design, not the thing criterion 2 asks about. Sampling them and
      // reporting "0 operable controls" would have been a false FAIL, the sixth
      // on edges in this lane.
      ids: edges.filter((e: any) => typeof e.data?.weight === 'number' && e.data.weight !== 1)
        .slice(0, 3).map((e: any) => String(e.id)),
      structuralSample: edges.slice(0, 3).map((e: any) => String(e.id)),
    }
  })
  console.log(`[EDGE] CONTROL causalEdges=${board.causal}/${board.edges} sampling=${JSON.stringify(board.ids)} (NOT ${JSON.stringify(board.structuralSample)}, which are structural)`)
  console.log(`[EDGE] edges=${board.edges} labelElements=${board.labelEls} advertisingAnEdit=${board.advertising}/${board.labelEls} CONTROL fabricated=${board.fabricated}`)
  for (const s of board.sample) console.log(`[EDGE]   label title="${s.title}" aria="${s.aria}"`)
  // ⚠ NOT A BAIL-OUT. Zero label anchors AT REST is the design system's own
  // rule — "the board is quiet at rest, the numbers arrive on SELECTION" — so
  // an empty label population here is expected, not a missing population. The
  // criterion-2 question is REACHABILITY: can the user get from an edge to an
  // operable control? That is what the rest of this measures.
  console.log(`[EDGE] labels at rest=${board.labelEls} (design system: quiet at rest, numbers on selection — expected)`)

  // ---- reachability: does the product's OWN route open an operable editor? --
  const texts: string[] = []
  for (const id of board.ids.slice(0, 3)) {
    const ok = await page.evaluate((edgeId: string) => {
      const st = (window as any).useCanvasStore.getState()
      if (!st.edges.some((e: any) => String(e.id) === edgeId)) return false
      st.selectEdgeWithoutHistory(edgeId)
      st.setShowResultsPanel?.(false)
      window.dispatchEvent(new Event('olumi:open-full-inspector'))
      return true
    }, id)
    if (!ok) { console.log(`[EDGE] ${id}: not on the graph`); continue }
    await page.waitForTimeout(3_000)
    const m = await page.evaluate(() => {
      const panel = document.querySelector('[role="dialog"]') as HTMLElement | null
      const t = (panel?.innerText ?? '').replace(/\s+/g, ' ')
      return {
        found: panel !== null,
        head: t.slice(0, 260),
        editable: document.querySelectorAll('[role="dialog"] input:not([disabled]):not([readonly]),[role="dialog"] [role="slider"]:not([aria-disabled="true"])').length,
        disabled: document.querySelectorAll('[role="dialog"] fieldset[disabled],[role="dialog"] [data-authority="disabled"]').length,
      }
    })
    texts.push(m.head)
    console.log(`[EDGE] ${id}: panel=${m.found} operableControls=${m.editable} disabledFieldsets=${m.disabled}`)
    console.log(`[EDGE]   text="${m.head}"`)
    await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(900)
  }
  const distinct = new Set(texts).size
  console.log(`[EDGE] CONTROL distinctPanelTexts=${distinct}/${texts.length} (1 = reading one shared surface)`)
  console.log(`[EDGE] VERDICT ${board.fabricated === 0 && texts.length >= 2 && distinct > 1 ? 'MEASURED' : 'NOT-MEASURED — a control did not discriminate'}`)
  await ctx.close()
  expect(board.edges).toBeGreaterThan(0)
})
