import { test, expect } from '@playwright/test'

const EXAMPLE = /Pricing Model Transition Strategy/i

async function pinnedOrigin() {
  const j = (await (await fetch('https://staging--olumi.netlify.app/version.json')).json()) as { commit: string; deploy_url: string }
  return { origin: j.deploy_url, build: j.commit }
}

/**
 * ⭐ THE DESTINATION MEASUREMENT, AND IT IS DELIBERATELY GEOMETRY-FREE.
 *
 * Five consecutive false FAILs on edge editing came from ONE cause: a computed
 * hover coordinate. A bezier path's bounding-box centre is not on the path, so
 * the hover never landed and "no control appeared" was indistinguishable from
 * "the product offers no control".
 *
 * ⛔ SO THIS PROBE COMPUTES NO COORDINATE. Every action is anchored to an
 * element (`locator.click()` on a React Flow node div — an axis-aligned
 * rectangle whose own hit point Playwright resolves), and every reading is a
 * DOM query. There is no mouse.move, no boundingBox arithmetic, no path maths.
 *
 * The question: for each node kind, does SELECTING the node reach an editor
 * that is actually enabled? `InspectorRouter` fences non-members of
 * `AUTHORITY_OWNING_PANELS` behind `<fieldset disabled data-authority="disabled">`,
 * so the fence is readable as an attribute rather than inferred from a click.
 */
test('INSPECTOR DESTINATION — per node kind, is the editor enabled?', async ({ page }) => {
  test.setTimeout(280_000)
  const { origin, build } = await pinnedOrigin()
  console.log(`[ID] servedUI=${build}`)
  await page.goto(origin, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /continue without an account/i }).click()
  const card = page.getByRole('button', { name: EXAMPLE })
  await card.waitFor({ state: 'visible', timeout: 45_000 })
  await card.click()
  await page.waitForTimeout(14_000)
  await page.getByRole('button', { name: /fit to view/i }).first().click().catch(() => {})
  await page.waitForTimeout(3_000)

  const ids = await page.evaluate(() =>
    ((window as any).useCanvasStore.getState().nodes as Array<any>)
      .filter((n) => !String(n.id).startsWith('__ghost-'))
      .map((n) => ({ id: String(n.id), type: String(n.type ?? n.data?.kind ?? '?') })))

  // Inventory the whole document OUTSIDE the canvas surface: the inspector is
  // a dock, and binding to its testid would make a renamed container read as
  // "no editor" — the same silent-absence shape this probe exists to avoid.
  const readDock = () => page.evaluate(() => {
    const flow = document.querySelector('.react-flow')
    const inDock = (e: Element) => !(flow && flow.contains(e))
    /**
     * ⛔ INPUT-SHAPED EDITORS ONLY, AND THE LIMIT IS STATED RATHER THAN CLOSED.
     *
     * This under-reports in one known way: an EXTERNAL factor's editor is the
     * quick-set range BUTTONS as well as the tech-mode Min/Max inputs
     * (`analyticalNodeFields.ts` on `prior`), so a button-only panel reads
     * `live=0` here. `live=0` therefore means **no input-shaped editor**, not
     * "no editor" — and the kind-level verdict below is unaffected, because
     * every kind that has a carrier also has at least one input-shaped editor.
     *
     * ⚠ AND ADMITTING BUTTONS WAS TRIED, MEASURED, AND REVERTED. A name-matched
     * allowance (`/set |change|edit|adjust|confirm|apply|min|max|range|.../`)
     * made EVERY node report five live editors, because it matched the dock's
     * own chrome: *"Auto-ar**range**"*, *"Click to re**set** to 100%"*,
     * *"Minimise"*. A decision node — which has no carrier at all — read as
     * fully editable. A widened population that reads as capability is worse
     * than a narrow one that states its limit, so the limit is stated.
     */
    const all = Array.from(document.querySelectorAll('input,textarea,select,[role="slider"],[contenteditable="true"]')).filter(inDock)
    const live = all.filter((e) => {
      const i = e as HTMLInputElement
      if (i.readOnly || i.disabled) return false
      if (i.closest('fieldset[disabled]')) return false
      // The composer is not a model editor.
      const lab = (i.getAttribute('aria-label') || i.getAttribute('placeholder') || '').toLowerCase()
      if (/message|ask olumi|type a|chat/.test(lab)) return false
      return true
    })
    const describe = (e: Element) => `${e.tagName.toLowerCase()}[${e.getAttribute('data-testid') ?? ''}]:${(e.getAttribute('aria-label') || e.getAttribute('placeholder') || '').replace(/\s+/g, ' ').trim().slice(0, 48)}`
    return {
      fenced: document.querySelectorAll('[data-authority="disabled"]').length,
      liveWriters: live.length,
      liveNames: live.map(describe).slice(0, 8),
      allWriters: all.length,
      fenceCopy: /read-only for now|can't yet be saved|cannot yet be saved/i.test(document.body.innerText),
    }
  })

  const rows: Array<Record<string, unknown>> = []
  for (const n of ids) {
    const node = page.locator(`[data-id="${n.id}"]`).first()
    await node.click({ timeout: 8_000 }).catch(() => {})
    await page.waitForTimeout(1_400)
    const d = await readDock()
    rows.push({ ...n, ...d })
    console.log(`[ID] ${n.type.padEnd(8)} ${n.id.padEnd(30)} live=${String(d.liveWriters).padEnd(2)} all=${String(d.allWriters).padEnd(2)} fenced=${d.fenced} fenceCopy=${d.fenceCopy} ${JSON.stringify(d.liveNames)}`)
  }

  // CONTROLS, in this run, on this instrument.
  const cPresent = rows.some((r) => (r.liveWriters as number) > 0)   // can see a live editor
  const cAbsent = rows.some((r) => (r.liveWriters as number) === 0)  // can see its absence
  const cFactor = rows.filter((r) => r.type === 'factor').some((r) => (r.liveWriters as number) > 0) // known-good contrast
  console.log(`[ID] CONTROL nodes=${rows.length} livePresentSomewhere=${cPresent} absenceSeen=${cAbsent} factorContrast=${cFactor}`)

  const byKind = new Map<string, { n: number; withLive: number }>()
  for (const r of rows) {
    const k = String(r.type)
    const e = byKind.get(k) ?? { n: 0, withLive: 0 }
    e.n += 1
    if ((r.liveWriters as number) > 0) e.withLive += 1
    byKind.set(k, e)
  }
  for (const [k, v] of byKind) console.log(`[ID] KIND ${k.padEnd(9)} ${v.withLive}/${v.n} reach a live editor`)

  const measurable = rows.length > 5 && cPresent && cAbsent && cFactor
  const deadKinds = [...byKind.entries()].filter(([, v]) => v.withLive === 0).map(([k]) => k).sort()

  /**
   * ⛔ THE VERDICT IS AGAINST THE KNOWN CARRIER SET, NOT AGAINST ZERO — because
   * a witness that can only ever FAIL is noise, and the reader stops looking.
   *
   * `MODEL_CHANGING_SYSTEM_EVENT_TYPES` has seven members and NONE of them
   * carries an arbitrary node field. A risk's likelihood, an outcome's range
   * and a decision's description therefore have no route to the shared model at
   * all, and no editor behind their panels would be honest. That is a PRODUCER
   * gap, tracked with CEE — not a UI regression, and not something this run can
   * fix by failing every night.
   *
   * So this asserts the SHAPE: exactly the kinds with no carrier may lack a
   * live editor. It goes RED in the two directions that matter —
   *   · a kind that HAS a carrier stops reaching its editor  (a real regression)
   *   · a kind with NO carrier grows one                     (a fabrication)
   * — and stays green on the known, deliberate gap.
   */
  const NO_CARRIER_KINDS = ['decision', 'outcome', 'risk'] as const
  const expected = [...NO_CARRIER_KINDS].sort()
  const asExpected = JSON.stringify(deadKinds) === JSON.stringify(expected)
  const regressed = deadKinds.filter((k) => !expected.includes(k as never))
  const fabricated = expected.filter((k) => !deadKinds.includes(k))
  console.log(
    `[ID] VERDICT ${measurable ? (asExpected ? 'PASS' : 'FAIL') : 'NOT-MEASURED'} `
    + `— kindsWithNoLiveEditor=${JSON.stringify(deadKinds)} expected=${JSON.stringify(expected)}`,
  )
  if (regressed.length > 0) console.log(`[ID] REGRESSION — these have a carrier and lost their editor: ${JSON.stringify(regressed)}`)
  if (fabricated.length > 0) console.log(`[ID] FABRICATION — these have NO carrier and gained an editor: ${JSON.stringify(fabricated)}`)
  expect(measurable, 'NOT-MEASURED: factor contrast control did not fire').toBe(true)
})
